import { withClient } from "@/lib/s3/route-helpers";
import { getObjectText } from "@/lib/s3/operations";
import { TEXT_PREVIEW_MAX_BYTES } from "@/lib/preview";

export const runtime = "nodejs";

export const POST = withClient(async (request, { client, conn }) => {
    const body = (await request.json()) as { key?: string };
    if (!body.key || typeof body.key !== "string") {
        return Response.json({ error: "key is required" }, { status: 400 });
    }

    const result = await getObjectText(client, conn, {
        key: body.key,
        maxBytes: TEXT_PREVIEW_MAX_BYTES,
    });

    return Response.json(result);
});
