import { withClient } from "@/lib/s3/route-helpers";
import { uploadStream } from "@/lib/s3/operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withClient(async (request, { client, conn }) => {
    const formData = await request.formData();
    const file = formData.get("file");
    const keyEntry = formData.get("key");

    if (!(file instanceof File)) {
        return Response.json({ error: "file is required" }, { status: 400 });
    }
    if (typeof keyEntry !== "string" || keyEntry.length === 0) {
        return Response.json({ error: "key is required" }, { status: 400 });
    }

    await uploadStream(client, conn, {
        key: keyEntry,
        body: file.stream(),
        contentType: file.type || "application/octet-stream",
    });

    return Response.json({ ok: true, key: keyEntry });
});
