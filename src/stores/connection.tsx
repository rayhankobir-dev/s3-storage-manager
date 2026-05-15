"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type PropsWithChildren } from "react";
import type { Connection } from "@/lib/s3/types";

const STORAGE_KEY = "object-storage:connection";
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
    connection: Connection | null;
    setConnection: (connection: Connection) => void;
    clearConnection: () => void;
};

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: PropsWithChildren) {
    const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const hydrated = useHydrated();

    const connection = useMemo<Connection | null>(() => {
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw) as Connection;
            if (parsed && typeof parsed.bucket === "string") return parsed;
        } catch {
            return null;
        }
        return null;
    }, [raw]);

    const setConnection = useCallback((next: Connection) => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        notify();
    }, []);

    const clearConnection = useCallback(() => {
        window.localStorage.removeItem(STORAGE_KEY);
        notify();
    }, []);

    const value = useMemo<ConnectionContextValue>(
        () => ({
            status: !hydrated ? "idle" : connection ? "ready" : "missing",
            connection,
            setConnection,
            clearConnection,
        }),
        [hydrated, connection, setConnection, clearConnection],
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

export function encodeCredentialsHeader(connection: Connection): string {
    if (typeof window === "undefined") {
        return Buffer.from(JSON.stringify(connection), "utf-8").toString("base64");
    }
    return btoa(JSON.stringify(connection));
}

export async function storageFetch(connection: Connection, input: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("x-storage-credentials", encodeCredentialsHeader(connection));
    if (init.body && !headers.has("content-type") && !(init.body instanceof FormData)) {
        headers.set("content-type", "application/json");
    }
    return fetch(input, { ...init, headers });
}
