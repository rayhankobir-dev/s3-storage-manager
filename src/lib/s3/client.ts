import "server-only";
import { S3Client } from "@aws-sdk/client-s3";
import { unsealConnection } from "@/lib/credentials/vault";
import type { Connection } from "./types";

export const CREDENTIALS_HEADER = "x-storage-credentials";

export function resolveEndpoint(conn: Pick<Connection, "accountId" | "endpoint">): string | undefined {
    if (conn.endpoint && conn.endpoint.length > 0) return conn.endpoint;
    if (conn.accountId && conn.accountId.length > 0) {
        return `https://${conn.accountId}.r2.cloudflarestorage.com`;
    }
    return undefined;
}

export function buildClient(conn: Connection): S3Client {
    const endpoint = resolveEndpoint(conn);
    return new S3Client({
        region: conn.region || "auto",
        endpoint,
        credentials: {
            accessKeyId: conn.accessKeyId,
            secretAccessKey: conn.secretAccessKey,
        },
        forcePathStyle: Boolean(endpoint),
    });
}

export class CredentialsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CredentialsError";
    }
}

/**
 * Parse the sealed credentials token from the request and decrypt it in memory.
 * The header carries an AES-256-GCM ciphertext minted by /api/credentials/seal;
 * raw credentials never appear on the wire after the initial seal handshake.
 */
export function parseCredentials(request: Request): Connection {
    const header = request.headers.get(CREDENTIALS_HEADER);
    if (!header) {
        throw new CredentialsError("Missing storage credentials header");
    }
    try {
        return unsealConnection(header);
    } catch {
        throw new CredentialsError("Storage credentials are invalid or expired. Reconnect to continue.");
    }
}
