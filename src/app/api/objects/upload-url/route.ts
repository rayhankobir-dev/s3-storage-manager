import { withClient } from "@/lib/s3/route-helpers";
import { presignUpload } from "@/lib/s3/operations";

export const runtime = "nodejs";

export const POST = withClient(async (request, { client, conn }) => {
    const body = (await request.json()) as { key?: string; contentType?: string };
    if (!body.key || typeof body.key !== "string") {
        return Response.json({ error: "key is required" }, { status: 400 });
    }
    const url = await presignUpload(client, conn, { key: body.key, contentType: body.contentType });
    return Response.json({ url, key: body.key });
});
