"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type PropsWithChildren } from "react";
import type { ConnectionPreview, SealedConnection } from "@/lib/credentials/types";

const STORAGE_KEY = "object-storage:sealed-v1";
const subscribers = new Set<() => void>();

function subscribe(callback: () => void): () => void {
    subscribers.add(callback);
    return () => {
        subscribers.delete(callback);
    };
}

function notify() {
    for (const cb of subscribers) cb();
}

function getSnapshot(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
}

function getServerSnapshot(): string | null {
    return null;
}

type Status = "idle" | "ready" | "missing";

/** Returns true once React has hydrated on the client; false during SSR and the first client render. */
function useHydrated(): boolean {
    return useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    );
}

type ConnectionContextValue = {
    status: Status;
    /** Non-secret preview fields safe to render in the UI. */
    connection: ConnectionPreview | null;
    /** Opaque encrypted token to send as the x-storage-credentials header. */
    credentialsHeader: string | null;
    setSealed: (sealed: SealedConnection) => void;
    clearConnection: () => void;
};

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

function parseStored(raw: string | null): SealedConnection | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as SealedConnection;
        if (
            parsed &&
            typeof parsed.token === "string" &&
            parsed.preview &&
            typeof parsed.preview.bucket === "string"
        ) {
            return parsed;
        }
    } catch {
        return null;
    }
    return null;
}

export function ConnectionProvider({ children }: PropsWithChildren) {
    const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const hydrated = useHydrated();

    const sealed = useMemo(() => parseStored(raw), [raw]);

    const setSealed = useCallback((next: SealedConnection) => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        notify();
    }, []);

    const clearConnection = useCallback(() => {
        window.localStorage.removeItem(STORAGE_KEY);
        notify();
    }, []);

    const value = useMemo<ConnectionContextValue>(
        () => ({
            status: !hydrated ? "idle" : sealed ? "ready" : "missing",
            connection: sealed?.preview ?? null,
            credentialsHeader: sealed?.token ?? null,
            setSealed,
            clearConnection,
        }),
        [hydrated, sealed, setSealed, clearConnection],
    );

    return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection(): ConnectionContextValue {
    const ctx = useContext(ConnectionContext);
    if (!ctx) {
        throw new Error("useConnection must be used within ConnectionProvider");
    }
    return ctx;
}

export async function storageFetch(
    credentialsHeader: string,
    input: string,
    init: RequestInit = {},
): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("x-storage-credentials", credentialsHeader);
    if (init.body && !headers.has("content-type") && !(init.body instanceof FormData)) {
        headers.set("content-type", "application/json");
    }
    return fetch(input, { ...init, headers });
}
