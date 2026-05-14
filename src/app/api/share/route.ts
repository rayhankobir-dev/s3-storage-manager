import { CredentialsError, parseCredentials } from "@/lib/s3/client";
import { encodeShare } from "@/lib/share/token";
import { hashPassword } from "@/lib/share/crypto";

export const runtime = "nodejs";

type CreateBody = {
    key?: string;
    /** Number of seconds until expiry. null/undefined = no expiry. */
    expiresInSeconds?: number | null;
    /** Optional password to gate access. */
    password?: string | null;
};

export async function POST(request: Request): Promise<Response> {
    let conn;
    try {
        conn = parseCredentials(request);
    } catch (error) {
        const message = error instanceof CredentialsError ? error.message : "Invalid credentials";
        return Response.json({ error: message }, { status: 401 });
    }

    let body: CreateBody;
    try {
        body = (await request.json()) as CreateBody;
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.key || typeof body.key !== "string") {
        return Response.json({ error: "key is required" }, { status: 400 });
    }

    const exp =
        body.expiresInSeconds === null || body.expiresInSeconds === undefined
            ? null
            : Date.now() + Math.max(60, Math.floor(body.expiresInSeconds)) * 1000;

    let passwordHash: string | null = null;
    if (typeof body.password === "string" && body.password.length > 0) {
        try {
            passwordHash = await hashPassword(body.password);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to hash password";
            return Response.json({ error: message }, { status: 500 });
        }
    }

    const name = body.key.split("/").filter(Boolean).pop() ?? body.key;

    let token: string;
    try {
        token = encodeShare({
            conn,
            key: body.key,
            name,
            exp,
            passwordHash,
            iat: Date.now(),
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create share token";
        return Response.json({ error: message }, { status: 500 });
    }

    const origin = new URL(request.url).origin;
    return Response.json({
        token,
        url: `${origin}/s/${token}`,
        name,
        exp,
        passwordRequired: passwordHash !== null,
    });
}
