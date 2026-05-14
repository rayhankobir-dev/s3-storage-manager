import "server-only";

type AnyError = Error & { code?: string; name?: string; $metadata?: { httpStatusCode?: number }; cause?: unknown };

/**
 * Walk the error.cause chain so we see network-level codes hidden under SDK errors.
 */
function flatten(error: unknown): AnyError[] {
    const out: AnyError[] = [];
    let current: unknown = error;
    while (current && out.length < 6) {
        if (current instanceof Error) {
            out.push(current as AnyError);
            current = (current as AnyError).cause;
        } else {
            break;
        }
    }
    return out;
}

function matchAny(errors: AnyError[], needle: RegExp): boolean {
    return errors.some((e) => needle.test(`${e.name ?? ""} ${e.code ?? ""} ${e.message ?? ""}`));
}

/**
 * Map an SDK / network error to a human-friendly message.
 * Falls back to the original message if we can't recognise it.
 */
export function friendlyMessage(error: unknown): string {
    if (!error) return "Unknown error";

    const chain = flatten(error);
    if (chain.length === 0) {
        return typeof error === "string" ? error : "Unknown error";
    }

    // ---- S3 / R2 application-level errors (these come back from AWS SDK with .name set) ----
    if (matchAny(chain, /InvalidAccessKeyId/)) {
        return "The access key ID you entered isn't recognised by this bucket's provider.";
    }
    if (matchAny(chain, /SignatureDoesNotMatch/)) {
        return "The secret access key is incorrect for this access key ID.";
    }
    if (matchAny(chain, /NoSuchBucket/)) {
        return "The bucket you specified doesn't exist on this account.";
    }
    if (matchAny(chain, /NoSuchKey/)) {
        return "The file you're trying to access no longer exists.";
    }
    if (matchAny(chain, /AccessDenied|Forbidden/)) {
        return "Access denied. The key may not have permission for this operation.";
    }
    if (matchAny(chain, /BucketAlreadyOwnedByYou|BucketAlreadyExists/)) {
        return "A bucket with this name already exists.";
    }
    if (matchAny(chain, /PreconditionFailed/)) {
        return "The object changed before your request completed. Refresh and try again.";
    }
    if (matchAny(chain, /RequestTimeTooSkewed/)) {
        return "Your computer's clock is too far off — sync your system time and try again.";
    }
    if (matchAny(chain, /SlowDown|RequestThrottled|TooManyRequests/)) {
        return "The storage provider is rate-limiting requests. Wait a moment and try again.";
    }

    // ---- Network / TLS errors ----
    if (matchAny(chain, /EPROTO|SSL routines|handshake failure|wrong version number/i)) {
        return "Couldn't establish a secure (TLS) connection to the storage endpoint. Double-check the account ID or custom endpoint URL — for R2 the endpoint should be https://<account-id>.r2.cloudflarestorage.com.";
    }
    if (matchAny(chain, /ENOTFOUND|getaddrinfo/i)) {
        return "Couldn't find the storage endpoint host. Double-check the account ID or endpoint URL.";
    }
    if (matchAny(chain, /ECONNREFUSED/i)) {
        return "The storage endpoint refused the connection.";
    }
    if (matchAny(chain, /ETIMEDOUT|ESOCKETTIMEDOUT|Timeout/i)) {
        return "The request to the storage endpoint timed out.";
    }
    if (matchAny(chain, /ECONNRESET|EPIPE|socket hang up/i)) {
        return "The connection to the storage endpoint was interrupted. Try again.";
    }
    if (matchAny(chain, /CERT_HAS_EXPIRED|UNABLE_TO_VERIFY_LEAF_SIGNATURE|self signed certificate/i)) {
        return "The storage endpoint's TLS certificate could not be verified.";
    }

    // HTTP status fallbacks
    const sdkError = chain.find((e) => e.$metadata?.httpStatusCode);
    const status = sdkError?.$metadata?.httpStatusCode;
    if (status === 401 || status === 403) {
        return "Access denied. Check your access key, secret, and bucket permissions.";
    }
    if (status === 404) {
        return "Not found. Check the bucket name and that the object exists.";
    }
    if (status && status >= 500) {
        return "The storage provider returned a server error. Try again in a moment.";
    }
    // R2 commonly returns a 400 with the opaque name "UnknownError" when signing fails
    // (e.g. wrong access key id or secret).
    if (status === 400 && matchAny(chain, /\bUnknownError\b/)) {
        return "The storage provider rejected the request. This usually means the access key ID or secret is wrong.";
    }
    if (status === 400) {
        return "The storage provider rejected the request. Check your credentials and bucket configuration.";
    }

    // Final fallback: the SDK's own message, trimmed.
    const raw = chain[0].message ?? "Unknown error";
    return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
}

/** Best-effort HTTP status to surface to the client. */
export function statusFromError(error: unknown): number {
    for (const e of flatten(error)) {
        const code = e.$metadata?.httpStatusCode;
        if (code) return code;
    }
    // TLS / DNS / connection errors deserve a 502-ish — they're upstream issues.
    if (matchAny(flatten(error), /EPROTO|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|SSL routines/i)) {
        return 502;
    }
    return 500;
}
