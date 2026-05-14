import { redirect } from "next/navigation";
import { buildClient } from "@/lib/s3/client";
import { presignDownload } from "@/lib/s3/operations";
import { decodeShare, publicInfo, type SharePublicInfo } from "@/lib/share/token";
import { ShareLanding } from "./share-landing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = {
    params: Promise<{ token: string }>;
};

export default async function SharePage({ params }: Props) {
    const { token } = await params;

    let payload;
    try {
        payload = decodeShare(token);
    } catch {
        return <ShareLanding state="invalid" token={token} info={null} />;
    }

    const info: SharePublicInfo = publicInfo(payload);
    if (info.expired) {
        return <ShareLanding state="expired" token={token} info={info} />;
    }

    if (info.passwordRequired) {
        return <ShareLanding state="password" token={token} info={info} />;
    }

    // No password — mint a presigned URL right now and redirect.
    const client = buildClient(payload.conn);
    let url: string;
    try {
        url = await presignDownload(client, payload.conn, { key: payload.key, expiresIn: 60 * 15 });
    } catch {
        return <ShareLanding state="invalid" token={token} info={info} />;
    } finally {
        client.destroy();
    }
    redirect(url);
}
