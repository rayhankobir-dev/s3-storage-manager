import "server-only";
import { decryptToken, encryptToken } from "@/lib/share/crypto";
import type { Connection } from "@/lib/s3/types";
import type { ConnectionPreview, SealedConnection } from "./types";

export type { ConnectionPreview, SealedConnection };

function maskAccessKeyId(accessKeyId: string): string {
    if (accessKeyId.length <= 8) return "•".repeat(accessKeyId.length);
    return `${accessKeyId.slice(0, 4)}…${accessKeyId.slice(-4)}`;
}

export function buildPreview(conn: Connection): ConnectionPreview {
    return {
        bucket: conn.bucket,
        accountId: conn.accountId,
        endpoint: conn.endpoint,
        region: conn.region,
        accessKeyIdMasked: maskAccessKeyId(conn.accessKeyId),
    };
}

export function sealConnection(conn: Connection): SealedConnection {
    return {
        token: encryptToken(conn),
        preview: buildPreview(conn),
    };
}

export function unsealConnection(token: string): Connection {
    const raw = decryptToken<Connection>(token);
    if (
        !raw ||
        typeof raw.bucket !== "string" ||
        typeof raw.accessKeyId !== "string" ||
        typeof raw.secretAccessKey !== "string"
    ) {
        throw new Error("Sealed token is missing required fields");
    }
    return raw;
}
