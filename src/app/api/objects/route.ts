import { withClient } from "@/lib/s3/route-helpers";
import { deleteKeys, deletePrefix, listPrefix } from "@/lib/s3/operations";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export const GET = withClient(async (request, { client, conn }) => {
    const url = (request as NextRequest).nextUrl;
    const prefix = url.searchParams.get("prefix") ?? "";
    const continuationToken = url.searchParams.get("token") ?? undefined;

    const result = await listPrefix(client, conn, { prefix, continuationToken });
    return Response.json(result);
});

export const DELETE = withClient(async (request, { client, conn }) => {
    const body = (await request.json()) as { keys?: string[]; prefixes?: string[] };
    const keys = Array.isArray(body.keys) ? body.keys.filter((k): k is string => typeof k === "string") : [];
    const prefixes = Array.isArray(body.prefixes) ? body.prefixes.filter((p): p is string => typeof p === "string") : [];

    if (keys.length > 0) {
        await deleteKeys(client, conn, keys);
    }
    for (const prefix of prefixes) {
        await deletePrefix(client, conn, prefix);
    }

    return Response.json({ deleted: keys.length, prefixes: prefixes.length });
});
