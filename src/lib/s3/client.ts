import "server-only";
import { S3Client } from "@aws-sdk/client-s3";
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

export function parseCredentials(request: Request): Connection {
    const header = request.headers.get(CREDENTIALS_HEADER);
    if (!header) {
        throw new CredentialsError("Missing storage credentials header");
    }

    let decoded: string;
    try {
        decoded = atob(header);
    } catch {
        throw new CredentialsError("Credentials header is not valid base64");
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(decoded);
    } catch {
        throw new CredentialsError("Credentials header is not valid JSON");
    }

    if (!parsed || typeof parsed !== "object") {
        throw new CredentialsError("Credentials must be an object");
    }

    const obj = parsed as Record<string, unknown>;
    const required = ["bucket", "accessKeyId", "secretAccessKey"] as const;
    for (const key of required) {
        if (typeof obj[key] !== "string" || (obj[key] as string).length === 0) {
            throw new CredentialsError(`Credentials missing field: ${key}`);
        }
    }

    return {
        bucket: obj.bucket as string,
        accessKeyId: obj.accessKeyId as string,
        secretAccessKey: obj.secretAccessKey as string,
        accountId: typeof obj.accountId === "string" ? obj.accountId : undefined,
        endpoint: typeof obj.endpoint === "string" ? obj.endpoint : undefined,
        region: typeof obj.region === "string" ? obj.region : undefined,
    };
}
