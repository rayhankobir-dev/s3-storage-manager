import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as unknown as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getSecret(): string {
    const value = process.env.SHARE_SECRET;
    if (!value || value.length < 16) {
        throw new Error(
            "SHARE_SECRET env var is missing or too short. Set a 32+ character random string in .env to enable sharing.",
        );
    }
    return value;
}

function deriveKey(): Buffer {
    return createHash("sha256").update(getSecret()).digest();
}

function toBase64Url(buffer: Buffer): string {
    return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Buffer {
    const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
    return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function encryptToken(payload: object): string {
    const key = deriveKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const plaintext = Buffer.from(JSON.stringify(payload), "utf-8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return toBase64Url(Buffer.concat([iv, authTag, ciphertext]));
}

export function decryptToken<T>(token: string): T {
    const key = deriveKey();
    const raw = fromBase64Url(token);
    if (raw.length < IV_LENGTH + AUTH_TAG_LENGTH) {
        throw new Error("Malformed share token");
    }
    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf-8")) as T;
}

/** scrypt-hash a password. Returns a string "salt:hash" both base64url. */
export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const hash = await scrypt(password, salt, 64);
    return `${toBase64Url(salt)}:${toBase64Url(hash)}`;
}

/** Verify a password against a stored "salt:hash" string. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    const [saltPart, hashPart] = stored.split(":");
    if (!saltPart || !hashPart) return false;
    const salt = fromBase64Url(saltPart);
    const expected = fromBase64Url(hashPart);
    const actual = await scrypt(password, salt, expected.length);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
}
