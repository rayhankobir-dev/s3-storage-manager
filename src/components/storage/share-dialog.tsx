"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy01, Infinity, Lock01, Share01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Input } from "@/components/base/input/input";
import { Toggle } from "@/components/base/toggle/toggle";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { useConnection } from "@/stores/connection";
import { cx } from "@/utils/cx";

type Props = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    /** Object key to share (null when closed). */
    objectKey: string | null;
    /** Display name. */
    name: string | null;
};

type ExpiryOption = { id: string; label: string; seconds: number | null };

const EXPIRY_OPTIONS: ExpiryOption[] = [
    { id: "1h", label: "1 hour", seconds: 60 * 60 },
    { id: "24h", label: "24 hours", seconds: 24 * 60 * 60 },
    { id: "7d", label: "7 days", seconds: 7 * 24 * 60 * 60 },
    { id: "never", label: "Never", seconds: null },
];

export function ShareDialog({ isOpen, onOpenChange, objectKey, name }: Props) {
    const { credentialsHeader } = useConnection();
    const [expiryId, setExpiryId] = useState<string>("24h");
    const [usePassword, setUsePassword] = useState(false);
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generated, setGenerated] = useState<{ url: string; exp: number | null } | null>(null);
    const [copied, setCopied] = useState(false);

    // Reset state each time the dialog opens for a new key.
    useEffect(() => {
        if (isOpen) {
            setExpiryId("24h");
            setUsePassword(false);
            setPassword("");
            setError(null);
            setGenerated(null);
            setCopied(false);
        }
    }, [isOpen, objectKey]);

    const expiry = useMemo(() => EXPIRY_OPTIONS.find((o) => o.id === expiryId) ?? EXPIRY_OPTIONS[1], [expiryId]);

    async function handleGenerate() {
        if (!credentialsHeader || !objectKey) return;
        setSubmitting(true);
        setError(null);
        try {
            const response = await fetch("/api/share", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-storage-credentials": credentialsHeader,
                },
                body: JSON.stringify({
                    key: objectKey,
                    expiresInSeconds: expiry.seconds,
                    password: usePassword && password.length > 0 ? password : null,
                }),
            });
            if (!response.ok) {
                const body = (await response.json().catch(() => null)) as { error?: string } | null;
                throw new Error(body?.error || `Failed to create share (${response.status})`);
            }
            const data = (await response.json()) as { url: string; exp: number | null };
            setGenerated(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create share");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCopy() {
        if (!generated) return;
        try {
            await navigator.clipboard.writeText(generated.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError("Could not copy to clipboard");
        }
    }

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
            <Modal>
                <Dialog>
                    <div className="relative w-full max-w-lg rounded-2xl bg-primary p-6 shadow-xl ring-1 ring-secondary">
                        <CloseButton size="sm" className="absolute top-3 right-3" onClick={() => onOpenChange(false)} />

                        <div className="flex items-start gap-4">
                            <FeaturedIcon icon={Share01} color="brand" theme="light" size="md" />
                            <div className="flex-1 min-w-0">
                                <h2 className="text-lg font-semibold text-primary">Share file</h2>
                                <p className="mt-1 truncate text-sm text-tertiary">{name ?? objectKey ?? ""}</p>
                            </div>
                        </div>

                        {!generated ? (
                            <>
                                <fieldset className="mt-6">
                                    <legend className="mb-2 text-sm font-medium text-secondary">Expiry</legend>
                                    <div className="grid grid-cols-2 gap-2">
                                        {EXPIRY_OPTIONS.map((option) => {
                                            const active = option.id === expiryId;
                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => setExpiryId(option.id)}
                                                    className={cx(
                                                        "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition",
                                                        active
                                                            ? "border-brand bg-brand-primary text-brand-secondary ring-2 ring-brand"
                                                            : "border-secondary bg-primary text-secondary hover:bg-secondary",
                                                    )}
                                                >
                                                    {option.id === "never" && <Infinity className="size-4" />}
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="mt-2 text-xs text-tertiary">
                                        Each access generates a fresh 15-minute presigned URL — the share link itself controls how long it stays valid.
                                    </p>
                                </fieldset>

                                <div className="mt-5 flex items-start justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2.5">
                                    <div className="flex items-start gap-2">
                                        <Lock01 className="mt-0.5 size-4 shrink-0 text-fg-quaternary" />
                                        <div>
                                            <p className="text-sm font-medium text-secondary">Password protection</p>
                                            <p className="text-xs text-tertiary">Recipients must enter the password before downloading.</p>
                                        </div>
                                    </div>
                                    <Toggle isSelected={usePassword} onChange={setUsePassword} size="sm" />
                                </div>

                                {usePassword && (
                                    <div className="mt-3">
                                        <Input
                                            label="Password"
                                            type="password"
                                            value={password}
                                            onChange={setPassword}
                                            placeholder="At least 4 characters"
                                            isRequired
                                        />
                                    </div>
                                )}

                                {error && <p className="mt-3 text-sm text-error-primary">{error}</p>}

                                <div className="mt-6 flex justify-end gap-2">
                                    <Button color="secondary" size="md" onClick={() => onOpenChange(false)} isDisabled={submitting}>
                                        Cancel
                                    </Button>
                                    <Button
                                        color="primary"
                                        size="md"
                                        iconLeading={Share01}
                                        isLoading={submitting}
                                        isDisabled={usePassword && password.length < 4}
                                        onClick={handleGenerate}
                                    >
                                        Generate link
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="mt-6">
                                    <label className="mb-1 block text-sm font-medium text-secondary">Share link</label>
                                    <div className="flex items-stretch gap-2">
                                        <input
                                            readOnly
                                            value={generated.url}
                                            className="min-w-0 flex-1 rounded-lg border border-secondary bg-secondary/40 px-3 py-2 font-mono text-xs text-secondary"
                                            onFocus={(e) => e.currentTarget.select()}
                                        />
                                        <Button
                                            color={copied ? "secondary" : "primary"}
                                            size="sm"
                                            iconLeading={copied ? Check : Copy01}
                                            onClick={handleCopy}
                                        >
                                            {copied ? "Copied" : "Copy"}
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-3 rounded-lg bg-secondary/40 p-3 text-xs text-tertiary">
                                    <p>
                                        Expires:{" "}
                                        <span className="font-medium text-secondary">
                                            {generated.exp === null ? "never" : new Date(generated.exp).toLocaleString()}
                                        </span>
                                    </p>
                                    {usePassword && password.length > 0 && (
                                        <p className="mt-1">
                                            Password: <span className="font-mono text-secondary">{password}</span>
                                            <span className="ml-1">— share this separately from the link.</span>
                                        </p>
                                    )}
                                </div>

                                {error && <p className="mt-3 text-sm text-error-primary">{error}</p>}

                                <div className="mt-6 flex justify-end gap-2">
                                    <Button color="secondary" size="md" onClick={() => setGenerated(null)}>
                                        Generate another
                                    </Button>
                                    <Button color="primary" size="md" onClick={() => onOpenChange(false)}>
                                        Done
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
