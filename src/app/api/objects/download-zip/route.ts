import { GetObjectCommand, ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3";
import { buildClient } from "@/lib/s3/client";
import { decryptToken } from "@/lib/share/crypto";
import { friendlyMessage, statusFromError } from "@/lib/s3/errors";
import { createZipStream, type ZipEntrySource } from "@/lib/zip/stream";
import type { Connection } from "@/lib/s3/types";
import type { ZipTokenPayload } from "./prepare/route";

export const runtime = "nodejs";
// Streaming the response — Next must not buffer this through any caching/static layer.
export const dynamic = "force-dynamic";

function stripPrefix(prefix: string, key: string): string {
    if (!prefix) return key;
    return key.startsWith(prefix) ? key.slice(prefix.length) : key;
}

function leafOfPrefix(prefix: string): string {
    const trimmed = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    const idx = trimmed.lastIndexOf("/");
    return idx === -1 ? trimmed : trimmed.slice(idx + 1);
}

async function* listAllKeys(client: S3Client, conn: Connection, prefix: string): AsyncGenerator<string> {
    let continuationToken: string | undefined;
    do {
        const response = await client.send(
            new ListObjectsV2Command({
                Bucket: conn.bucket,
                Prefix: prefix,
                ContinuationToken: continuationToken,
                MaxKeys: 1000,
            }),
        );
        for (const obj of response.Contents ?? []) {
            const key = obj.Key;
            // Skip the folder placeholder (zero-byte "foo/" entry) — it has no useful content.
            if (!key || key.endsWith("/")) continue;
            yield key;
        }
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);
}

async function* objectBody(client: S3Client, conn: Connection, key: string): AsyncGenerator<Uint8Array> {
    const response = await client.send(new GetObjectCommand({ Bucket: conn.bucket, Key: key }));
    const body = response.Body;
    if (!body) return;
    // SmithyMessageDecoderStream<*> exposes an async iterator of Uint8Array chunks.
    // @ts-expect-error — the SDK union typing doesn't expose [Symbol.asyncIterator] on the public type.
    for await (const chunk of body) {
        yield chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    }
}

function leafOfKey(key: string): string {
    const idx = key.lastIndexOf("/");
    return idx === -1 ? key : key.slice(idx + 1);
}

export async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (!token) {
        return new Response("Missing token", { status: 400 });
    }

    let payload: ZipTokenPayload;
    try {
        payload = decryptToken<ZipTokenPayload>(token);
    } catch {
        return new Response("Invalid token", { status: 401 });
    }
    if (payload.exp < Date.now()) {
        return new Response("Token expired", { status: 401 });
    }

    const client = buildClient(payload.conn);

    // Build the entry source: yield one ZipEntrySource per object.
    async function* source(): AsyncGenerator<ZipEntrySource> {
        // Plain keys land at the archive root.
        for (const key of payload.keys) {
            yield {
                path: leafOfKey(key),
                body: objectBody(client, payload.conn, key),
            };
        }
        // Folder prefixes land under their own subdir to preserve structure.
        for (const rawPrefix of payload.prefixes) {
            const prefix = rawPrefix.endsWith("/") ? rawPrefix : `${rawPrefix}/`;
            const folderName = leafOfPrefix(prefix);
            for await (const key of listAllKeys(client, payload.conn, prefix)) {
                const relative = stripPrefix(prefix, key);
                yield {
                    path: `${folderName}/${relative}`,
                    body: objectBody(client, payload.conn, key),
                };
            }
        }
    }

    let stream: ReadableStream<Uint8Array>;
    try {
        stream = createZipStream(source());
    } catch (error) {
        client.destroy();
        return Response.json({ error: friendlyMessage(error) }, { status: statusFromError(error) });
    }

    // Wrap the stream so we destroy the S3 client when the consumer disconnects.
    const wrapped = new ReadableStream<Uint8Array>({
        async start(controller) {
            const reader = stream.getReader();
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    controller.enqueue(value);
                }
                controller.close();
            } catch (err) {
                controller.error(err);
            } finally {
                client.destroy();
            }
        },
        cancel() {
            client.destroy();
        },
    });

    const filename = `${payload.name}.zip`.replace(/[\r\n"]/g, "");
    return new Response(wrapped, {
        status: 200,
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    });
}
