import { buildClient } from "@/lib/s3/client";
import { presignDownload } from "@/lib/s3/operations";
import { verifyPassword } from "@/lib/share/crypto";
import { decodeShare, publicInfo } from "@/lib/share/token";

export const runtime = "nodejs";

type AccessBody = {
    token?: string;
    password?: string;
};

export async function POST(request: Request): Promise<Response> {
    let body: AccessBody;
    try {
        body = (await request.json()) as AccessBody;
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.token) {
        return Response.json({ error: "token is required" }, { status: 400 });
    }

    let payload;
    try {
        payload = decodeShare(body.token);
    } catch {
        return Response.json({ error: "Share link is invalid or has been tampered with." }, { status: 400 });
    }

    const info = publicInfo(payload);
    if (info.expired) {
        return Response.json({ error: "This share link has expired." }, { status: 410 });
    }

    if (info.passwordRequired) {
        if (!body.password) {
            return Response.json({ error: "Password is required." }, { status: 401 });
        }
        const valid = await verifyPassword(body.password, payload.passwordHash as string);
        if (!valid) {
            return Response.json({ error: "Incorrect password." }, { status: 401 });
        }
    }

    const client = buildClient(payload.conn);
    try {
        const url = await presignDownload(client, payload.conn, { key: payload.key, expiresIn: 60 * 15 });
        return Response.json({ url, name: payload.name });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate download URL.";
        return Response.json({ error: message }, { status: 500 });
    } finally {
        client.destroy();
    }
}
