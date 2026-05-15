import "server-only";
import {
    CopyObjectCommand,
    DeleteObjectsCommand,
    GetObjectCommand,
    HeadBucketCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    type S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Connection, ListResult } from "./types";

export async function verifyBucket(client: S3Client, conn: Connection): Promise<void> {
    await client.send(new HeadBucketCommand({ Bucket: conn.bucket }));
}

export async function listPrefix(
    client: S3Client,
    conn: Connection,
    options: { prefix: string; continuationToken?: string; pageSize?: number },
): Promise<ListResult> {
    const response = await client.send(
        new ListObjectsV2Command({
            Bucket: conn.bucket,
            Prefix: options.prefix || undefined,
            Delimiter: "/",
            ContinuationToken: options.continuationToken,
            MaxKeys: options.pageSize ?? 1000,
        }),
    );

    const folders = (response.CommonPrefixes ?? [])
        .map((p) => p.Prefix)
        .filter((p): p is string => Boolean(p))
        .map((prefix) => ({ prefix }));

    const objects = (response.Contents ?? [])
        // Hide the folder placeholder itself (e.g. "photos/" inside "photos/" listing).
        .filter((c) => c.Key && c.Key !== options.prefix)
        .map((c) => ({
            key: c.Key as string,
            size: c.Size ?? 0,
            lastModified: c.LastModified ? c.LastModified.toISOString() : null,
            etag: c.ETag ?? null,
        }));

    return {
        folders,
        objects,
        isTruncated: Boolean(response.IsTruncated),
        nextContinuationToken: response.NextContinuationToken ?? null,
    };
}

export async function deleteKeys(client: S3Client, conn: Connection, keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    // DeleteObjects supports up to 1000 keys per request.
    for (let i = 0; i < keys.length; i += 1000) {
        const batch = keys.slice(i, i + 1000);
        await client.send(
            new DeleteObjectsCommand({
                Bucket: conn.bucket,
                Delete: { Objects: batch.map((k) => ({ Key: k })) },
            }),
        );
    }
}

export async function deletePrefix(client: S3Client, conn: Connection, prefix: string): Promise<void> {
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
        const keys = (response.Contents ?? []).map((c) => c.Key).filter((k): k is string => Boolean(k));
        if (keys.length > 0) {
            await deleteKeys(client, conn, keys);
        }
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);
}

export async function createFolder(client: S3Client, conn: Connection, prefix: string): Promise<void> {
    const key = prefix.endsWith("/") ? prefix : `${prefix}/`;
    await client.send(
        new PutObjectCommand({
            Bucket: conn.bucket,
            Key: key,
            Body: "",
        }),
    );
}

export async function uploadStream(
    client: S3Client,
    conn: Connection,
    options: { key: string; body: ReadableStream<Uint8Array> | Uint8Array | Buffer; contentType?: string },
): Promise<void> {
    const upload = new Upload({
        client,
        params: {
            Bucket: conn.bucket,
            Key: options.key,
            Body: options.body,
            ContentType: options.contentType,
        },
        // Multipart parts of 8 MB; lib-storage uses single PutObject if total < partSize.
        partSize: 8 * 1024 * 1024,
        queueSize: 4,
        leavePartsOnError: false,
    });
    await upload.done();
}

export async function presignUpload(
    client: S3Client,
    conn: Connection,
    options: { key: string; contentType?: string; expiresIn?: number },
): Promise<string> {
    return getSignedUrl(
        client,
        new PutObjectCommand({
            Bucket: conn.bucket,
            Key: options.key,
            ContentType: options.contentType,
        }),
        { expiresIn: options.expiresIn ?? 60 * 15 },
    );
}

export async function getObjectText(
    client: S3Client,
    conn: Connection,
    options: { key: string; maxBytes: number },
): Promise<{ text: string; contentType: string | null; size: number; truncated: boolean }> {
    const response = await client.send(
        new GetObjectCommand({
            Bucket: conn.bucket,
            Key: options.key,
            // Only fetch up to maxBytes (range is inclusive, hence -1).
            Range: `bytes=0-${options.maxBytes - 1}`,
        }),
    );

    if (!response.Body) {
        return { text: "", contentType: response.ContentType ?? null, size: 0, truncated: false };
    }

    const bytes = await response.Body.transformToByteArray();
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

    // ContentRange looks like "bytes 0-X/total" — pull the total to decide if we truncated.
    const range = response.ContentRange ?? null;
    let total = bytes.length;
    if (range) {
        const match = /\/(\d+)$/.exec(range);
        if (match) total = parseInt(match[1], 10);
    } else if (typeof response.ContentLength === "number") {
        total = response.ContentLength;
    }

    return {
        text,
        contentType: response.ContentType ?? null,
        size: total,
        truncated: total > bytes.length,
    };
}

export async function presignDownload(
    client: S3Client,
    conn: Connection,
    options: { key: string; expiresIn?: number },
): Promise<string> {
    return getSignedUrl(
        client,
        new GetObjectCommand({
            Bucket: conn.bucket,
            Key: options.key,
        }),
        { expiresIn: options.expiresIn ?? 60 * 15 },
    );
}

export async function copyKey(client: S3Client, conn: Connection, sourceKey: string, destinationKey: string): Promise<void> {
    await client.send(
        new CopyObjectCommand({
            Bucket: conn.bucket,
            CopySource: encodeURI(`${conn.bucket}/${sourceKey}`),
            Key: destinationKey,
        }),
    );
}

export async function moveKey(client: S3Client, conn: Connection, sourceKey: string, destinationKey: string): Promise<void> {
    if (sourceKey === destinationKey) return;
    await copyKey(client, conn, sourceKey, destinationKey);
    await deleteKeys(client, conn, [sourceKey]);
}

export async function copyPrefix(client: S3Client, conn: Connection, sourcePrefix: string, destinationPrefix: string): Promise<void> {
    if (sourcePrefix === destinationPrefix) return;
    let continuationToken: string | undefined;
    do {
        const response = await client.send(
            new ListObjectsV2Command({
                Bucket: conn.bucket,
                Prefix: sourcePrefix,
                ContinuationToken: continuationToken,
                MaxKeys: 1000,
            }),
        );
        const sources = (response.Contents ?? []).map((c) => c.Key).filter((k): k is string => Boolean(k));
        for (const source of sources) {
            const dest = `${destinationPrefix}${source.slice(sourcePrefix.length)}`;
            await copyKey(client, conn, source, dest);
        }
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);
}

export async function movePrefix(client: S3Client, conn: Connection, sourcePrefix: string, destinationPrefix: string): Promise<void> {
    if (sourcePrefix === destinationPrefix) return;
    let continuationToken: string | undefined;
    do {
        const response = await client.send(
            new ListObjectsV2Command({
                Bucket: conn.bucket,
                Prefix: sourcePrefix,
                ContinuationToken: continuationToken,
                MaxKeys: 1000,
            }),
        );
        const sources = (response.Contents ?? []).map((c) => c.Key).filter((k): k is string => Boolean(k));
        for (const source of sources) {
            const dest = `${destinationPrefix}${source.slice(sourcePrefix.length)}`;
            await copyKey(client, conn, source, dest);
        }
        if (sources.length > 0) {
            await deleteKeys(client, conn, sources);
        }
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);
}
