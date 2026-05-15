import { encryptToken } from "@/lib/share/crypto";
import { CredentialsError, parseCredentials } from "@/lib/s3/client";

export const runtime = "nodejs";

type Body = {
    /** Folder prefix to archive. */
    prefix?: string;
    /** Specific object keys to include (in addition to anything under `prefix`). */
    keys?: string[];
    /** Additional folder prefixes to include. */
    prefixes?: string[];
    /** Suggested filename without extension. */
    name?: string;
};

export type ZipTokenPayload = {
    conn: ReturnType<typeof parseCredentials>;
    keys: string[];
    prefixes: string[];
    name: string;
    exp: number;
};

export async function POST(request: Request): Promise<Response> {
    let conn: ReturnType<typeof parseCredentials>;
    try {
        conn = parseCredentials(request);
    } catch (error) {
        const message = error instanceof CredentialsError ? error.message : "Invalid credentials";
        return Response.json({ error: message }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as Partial<Body> | null;
    if (!body) {
        return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    const keys = Array.isArray(body.keys) ? body.keys.filter((k): k is string => typeof k === "string") : [];
    const prefixes = [
        ...(typeof body.prefix === "string" && body.prefix.length > 0 ? [body.prefix] : []),
        ...(Array.isArray(body.prefixes) ? body.prefixes.filter((p): p is string => typeof p === "string") : []),
    ];
    if (keys.length === 0 && prefixes.length === 0) {
        return Response.json({ error: "Provide at least one prefix or key" }, { status: 400 });
    }

    const name = (typeof body.name === "string" && body.name.trim().length > 0 ? body.name.trim() : "download").slice(0, 120);

    const payload: ZipTokenPayload = {
        conn,
        keys,
        prefixes,
        name,
        // 5 minutes — just enough for the browser to start the download.
        exp: Date.now() + 5 * 60 * 1000,
    };
    const token = encryptToken(payload);
    return Response.json({ token, name });
}
