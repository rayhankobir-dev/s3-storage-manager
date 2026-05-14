"use client";

import { useState } from "react";
import { Download01, Lock01, AlertTriangle } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import type { SharePublicInfo } from "@/lib/share/token";

type Props = {
    state: "password" | "expired" | "invalid";
    token: string;
    info: SharePublicInfo | null;
};

function formatExpiry(exp: number | null): string {
    if (exp === null) return "This link does not expire.";
    const date = new Date(exp);
    return `Expires ${date.toLocaleString()}`;
}

export function ShareLanding({ state, token, info }: Props) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (state !== "password") return;
        setSubmitting(true);
        setError(null);
        try {
            const response = await fetch("/api/share/access", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ token, password }),
            });
            if (!response.ok) {
                const body = (await response.json().catch(() => null)) as { error?: string } | null;
                setError(body?.error || `Could not access (${response.status})`);
                return;
            }
            const { url } = (await response.json()) as { url: string };
            window.location.href = url;
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unexpected error");
        } finally {
            setSubmitting(false);
        }
    }

    if (state === "invalid") {
        return (
            <Wrapper>
                <FeaturedIcon icon={AlertTriangle} color="error" theme="light" size="lg" />
                <h1 className="mt-5 text-xl font-semibold text-primary">Link not recognized</h1>
                <p className="mt-2 text-sm text-tertiary">
                    This share link is invalid or has been tampered with. Ask the sender for a new one.
                </p>
            </Wrapper>
        );
    }

    if (state === "expired") {
        return (
            <Wrapper>
                <FeaturedIcon icon={AlertTriangle} color="warning" theme="light" size="lg" />
                <h1 className="mt-5 text-xl font-semibold text-primary">This link has expired</h1>
                <p className="mt-2 text-sm text-tertiary">
                    The sender set this link to expire. Ask them to issue a new one.
                </p>
            </Wrapper>
        );
    }

    return (
        <Wrapper>
            <FeaturedIcon icon={Lock01} color="brand" theme="light" size="lg" />
            <h1 className="mt-5 text-xl font-semibold text-primary">Password required</h1>
            {info?.name && <p className="mt-1 text-md font-medium text-secondary">{info.name}</p>}
            <p className="mt-1 text-sm text-tertiary">{formatExpiry(info?.exp ?? null)}</p>

            <form onSubmit={handleSubmit} className="mt-6 flex w-full flex-col gap-3">
                <Input
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    placeholder="Enter the password"
                    autoFocus
                    isRequired
                />
                {error && <p className="text-sm text-error-primary">{error}</p>}
                <Button type="submit" size="md" iconLeading={Download01} isLoading={submitting} isDisabled={password.length === 0}>
                    Unlock and download
                </Button>
            </form>
        </Wrapper>
    );
}

function Wrapper({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-dvh items-center justify-center bg-secondary/30 p-6">
            <div className="w-full max-w-md rounded-2xl bg-primary p-8 text-center shadow-xl ring-1 ring-secondary">
                <div className="flex flex-col items-center">{children}</div>
            </div>
        </div>
    );
}
