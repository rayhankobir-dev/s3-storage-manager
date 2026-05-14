import { withClient } from "@/lib/s3/route-helpers";
import { createFolder } from "@/lib/s3/operations";

export const runtime = "nodejs";

export const POST = withClient(async (request, { client, conn }) => {
    const body = (await request.json()) as { prefix?: string };
    if (!body.prefix || typeof body.prefix !== "string") {
        return Response.json({ error: "prefix is required" }, { status: 400 });
    }
    await createFolder(client, conn, body.prefix);
    return Response.json({ ok: true, prefix: body.prefix.endsWith("/") ? body.prefix : `${body.prefix}/` });
});
