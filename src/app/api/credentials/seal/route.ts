import "server-only";
import { buildClient } from "@/lib/s3/client";
import { verifyBucket } from "@/lib/s3/operations";
import { friendlyMessage, statusFromError } from "@/lib/s3/errors";
import { sealConnection } from "@/lib/credentials/vault";
import type { Connection } from "@/lib/s3/types";

export const runtime = "nodejs";

function pickString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseBody(body: unknown): Connection {
    if (!body || typeof body !== "object") {
        throw new Error("Request body must be a JSON object");
    }
    const o = body as Record<string, unknown>;

    const bucket = pickString(o.bucket);
    const accessKeyId = pickString(o.accessKeyId);
    const secretAccessKey = pickString(o.secretAccessKey);
    if (!bucket || !accessKeyId || !secretAccessKey) {
        throw new Error("bucket, accessKeyId, and secretAccessKey are required");
    }

    const accountId = pickString(o.accountId);
    const endpoint = pickString(o.endpoint);
    if (!accountId && !endpoint) {
        throw new Error("Provide either accountId or a custom endpoint");
    }

    return {
        bucket,
        accessKeyId,
        secretAccessKey,
        accountId,
        endpoint,
        region: pickString(o.region) ?? "auto",
    };
}

export async function POST(request: Request): Promise<Response> {
    let conn: Connection;
    try {
        const body = (await request.json().catch(() => null)) as unknown;
        conn = parseBody(body);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid request body";
        return Response.json({ error: message }, { status: 400 });
    }

    const client = buildClient(conn);
    try {
        await verifyBucket(client, conn);
    } catch (error) {
        console.error("[credentials/seal] verify failed", error);
        return Response.json({ error: friendlyMessage(error) }, { status: statusFromError(error) });
    } finally {
        client.destroy();
    }

    try {
        const sealed = sealConnection(conn);
        return Response.json(sealed);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to seal credentials";
        return Response.json({ error: message }, { status: 500 });
    }
}
