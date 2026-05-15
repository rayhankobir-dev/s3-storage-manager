import { withClient } from "@/lib/s3/route-helpers";
import { copyKey, copyPrefix, moveKey, movePrefix } from "@/lib/s3/operations";

export const runtime = "nodejs";

type TransferBody = {
    mode: "copy" | "move";
    destination: string;
    keys?: string[];
    prefixes?: string[];
};

function leafOfKey(key: string): string {
    const idx = key.lastIndexOf("/");
    return idx === -1 ? key : key.slice(idx + 1);
}

function leafOfPrefix(prefix: string): string {
    const trimmed = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    const idx = trimmed.lastIndexOf("/");
    return idx === -1 ? trimmed : trimmed.slice(idx + 1);
}

export const POST = withClient(async (request, { client, conn }) => {
    const body = (await request.json()) as Partial<TransferBody>;
    const mode = body.mode === "copy" ? "copy" : body.mode === "move" ? "move" : null;
    if (!mode) {
        return Response.json({ error: "mode must be 'copy' or 'move'" }, { status: 400 });
    }
    if (typeof body.destination !== "string") {
        return Response.json({ error: "destination is required" }, { status: 400 });
    }
    const destPrefix = body.destination.length === 0 || body.destination.endsWith("/") ? body.destination : `${body.destination}/`;

    const keys = Array.isArray(body.keys) ? body.keys.filter((k): k is string => typeof k === "string") : [];
    const prefixes = Array.isArray(body.prefixes) ? body.prefixes.filter((p): p is string => typeof p === "string") : [];

    if (keys.length === 0 && prefixes.length === 0) {
        return Response.json({ error: "no items to transfer" }, { status: 400 });
    }

    // Refuse to move/copy a folder into itself or a descendant; that would loop forever.
    for (const prefix of prefixes) {
        const sourcePrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
        if (destPrefix === sourcePrefix || destPrefix.startsWith(sourcePrefix)) {
            return Response.json({ error: `Cannot ${mode} folder into itself or a descendant.` }, { status: 400 });
        }
    }

    for (const key of keys) {
        const dest = `${destPrefix}${leafOfKey(key)}`;
        if (dest === key) continue;
        if (mode === "copy") await copyKey(client, conn, key, dest);
        else await moveKey(client, conn, key, dest);
    }
    for (const prefix of prefixes) {
        const sourcePrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
        const dest = `${destPrefix}${leafOfPrefix(sourcePrefix)}/`;
        if (dest === sourcePrefix) continue;
        if (mode === "copy") await copyPrefix(client, conn, sourcePrefix, dest);
        else await movePrefix(client, conn, sourcePrefix, dest);
    }

    return Response.json({ ok: true, mode, keys: keys.length, prefixes: prefixes.length });
});
