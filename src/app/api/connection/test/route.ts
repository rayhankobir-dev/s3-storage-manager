import { withClient } from "@/lib/s3/route-helpers";
import { verifyBucket } from "@/lib/s3/operations";

export const runtime = "nodejs";

export const POST = withClient(async (_request, { client, conn }) => {
    await verifyBucket(client, conn);
    return Response.json({ ok: true, bucket: conn.bucket });
});
