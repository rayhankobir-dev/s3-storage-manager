import { withClient } from "@/lib/s3/route-helpers";
import { moveKey, movePrefix } from "@/lib/s3/operations";

export const runtime = "nodejs";

type MoveBody = {
    source: string;
    destination: string;
    /** When true, treat source/destination as prefixes (folder move). */
    isPrefix?: boolean;
};

export const POST = withClient(async (request, { client, conn }) => {
    const body = (await request.json()) as Partial<MoveBody>;
    if (!body.source || !body.destination) {
        return Response.json({ error: "source and destination are required" }, { status: 400 });
    }
    if (body.isPrefix) {
        const source = body.source.endsWith("/") ? body.source : `${body.source}/`;
        const destination = body.destination.endsWith("/") ? body.destination : `${body.destination}/`;
        await movePrefix(client, conn, source, destination);
    } else {
        await moveKey(client, conn, body.source, body.destination);
    }
    return Response.json({ ok: true });
});
