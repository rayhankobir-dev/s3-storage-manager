import "server-only";
import { decryptToken, encryptToken } from "./crypto";
import type { Connection } from "@/lib/s3/types";

export type SharePayload = {
    /** Bucket + creds the server should use when generating presigned URLs. */
    conn: Connection;
    /** Object key being shared. */
    key: string;
    /** Display name shown on the public landing page. */
    name: string;
    /** Optional expiry as a Unix epoch (ms). null means no expiry. */
    exp: number | null;
    /** scrypt "salt:hash" string. null means no password required. */
    passwordHash: string | null;
    /** When the share was created, for display. */
    iat: number;
};

export type SharePublicInfo = {
    name: string;
    exp: number | null;
    passwordRequired: boolean;
    iat: number;
    expired: boolean;
};

export function encodeShare(payload: SharePayload): string {
    return encryptToken(payload);
}

export function decodeShare(token: string): SharePayload {
    return decryptToken<SharePayload>(token);
}

export function publicInfo(payload: SharePayload): SharePublicInfo {
    const expired = payload.exp !== null && Date.now() > payload.exp;
    return {
        name: payload.name,
        exp: payload.exp,
        passwordRequired: Boolean(payload.passwordHash),
        iat: payload.iat,
        expired,
    };
}
