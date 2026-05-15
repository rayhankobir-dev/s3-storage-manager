"use client";

import { useEffect, useState } from "react";
import { FileIcon } from "@untitledui/file-icons";
import { Download01, Share01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { useConnection } from "@/stores/connection";
import { friendlyMimeType, humanSize, inferFileIconType } from "@/lib/file-type";
import { previewKind, type PreviewKind } from "@/lib/preview";

type Props = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    objectKey: string | null;
    name: string | null;
    size?: number | null;
    onShare?: (key: string, name: string) => void;
};

type Loaded =
    | { kind: "image" | "video" | "audio" | "pdf"; url: string }
    | { kind: "text"; text: string; truncated: boolean; size: number; contentType: string | null }
    | { kind: "none" };

export function PreviewModal({ isOpen, onOpenChange, objectKey, name, size, onShare }: Props) {
    const { credentialsHeader } = useConnection();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState<Loaded | null>(null);

    useEffect(() => {
        if (!isOpen || !objectKey || !credentialsHeader) {
            setLoaded(null);
            setError(null);
            return;
        }
        const kind: PreviewKind = previewKind(objectKey);
        if (kind === "none") {
            setLoaded({ kind: "none" });
            setError(null);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);
        setLoaded(null);

        (async () => {
            try {
                if (kind === "text") {
                    const response = await fetch("/api/objects/content", {
                        method: "POST",
                        headers: {
                            "content-type": "application/json",
                            "x-storage-credentials": credentialsHeader,
                        },
                        body: JSON.stringify({ key: objectKey }),
                    });
                    if (!response.ok) {
                        const body = (await response.json().catch(() => null)) as { error?: string } | null;
                        throw new Error(body?.error || `Could not load preview (${response.status})`);
                    }
                    const data = (await response.json()) as {
                        text: string;
                        truncated: boolean;
                        size: number;
                        contentType: string | null;
                    };
                    if (!cancelled) setLoaded({ kind: "text", ...data });
                } else {
                    const response = await fetch("/api/objects/download-url", {
                        method: "POST",
                        headers: {
                            "content-type": "application/json",
                            "x-storage-credentials": credentialsHeader,
                        },
                        body: JSON.stringify({ key: objectKey }),
                    });
                    if (!response.ok) {
                        const body = (await response.json().catch(() => null)) as { error?: string } | null;
                        throw new Error(body?.error || `Could not sign URL (${response.status})`);
                    }
                    const { url } = (await response.json()) as { url: string };
                    if (!cancelled) setLoaded({ kind, url });
                }
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : "Preview failed");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isOpen, objectKey, credentialsHeader]);

    async function handleDownload() {
        if (!credentialsHeader || !objectKey) return;
        const response = await fetch("/api/objects/download-url", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-storage-credentials": credentialsHeader,
            },
            body: JSON.stringify({ key: objectKey }),
        });
        if (!response.ok) return;
        const { url } = (await response.json()) as { url: string };
        window.open(url, "_blank", "noopener,noreferrer");
    }

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
            <Modal className="max-w-5xl!">
                <Dialog>
                    <div className="relative flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-primary shadow-xl ring-1 ring-secondary">
                        <header className="flex items-center justify-between gap-4 border-b border-secondary px-5 py-4">
                            <div className="flex min-w-0 items-center gap-3">
                                <FileIcon
                                    type={objectKey ? inferFileIconType(objectKey) : "empty"}
                                    variant="solid"
                                    className="size-8 shrink-0"
                                />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-primary">{name}</p>
                                    <p className="truncate text-xs text-tertiary">
                                        {objectKey ? friendlyMimeType(objectKey) : ""}
                                        {typeof size === "number" && size > 0 ? ` · ${humanSize(size)}` : ""}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {onShare && objectKey && name && (
                                    <Button
                                        color="secondary"
                                        size="sm"
                                        iconLeading={Share01}
                                        onClick={() => onShare(objectKey, name)}
                                    >
                                        Share
                                    </Button>
                                )}
                                <Button color="primary" size="sm" iconLeading={Download01} onClick={() => void handleDownload()}>
                                    Download
                                </Button>
                                <CloseButton size="sm" onClick={() => onOpenChange(false)} />
                            </div>
                        </header>

                        <div className="relative flex flex-1 items-center justify-center overflow-auto bg-secondary/40 p-4 sm:p-6">
                            {loading && <p className="text-sm text-tertiary">Loading preview…</p>}
                            {!loading && error && (
                                <p role="alert" className="rounded-lg bg-error-primary px-4 py-2 text-sm text-error-primary ring-1 ring-error_subtle">
                                    {error}
                                </p>
                            )}
                            {!loading && !error && loaded && <PreviewBody loaded={loaded} name={name ?? ""} />}
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}

function PreviewBody({ loaded, name }: { loaded: Loaded; name: string }) {
    if (loaded.kind === "image") {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={loaded.url} alt={name} className="max-h-[70dvh] max-w-full rounded-lg object-contain shadow-sm" />;
    }
    if (loaded.kind === "video") {
        return <video src={loaded.url} controls className="max-h-[70dvh] max-w-full rounded-lg shadow-sm" />;
    }
    if (loaded.kind === "audio") {
        return <audio src={loaded.url} controls className="w-full max-w-xl" />;
    }
    if (loaded.kind === "pdf") {
        return <iframe title={name} src={loaded.url} className="h-[75dvh] w-full rounded-lg border border-secondary bg-primary" />;
    }
    if (loaded.kind === "text") {
        return (
            <div className="w-full">
                {loaded.truncated && (
                    <p className="mb-2 text-xs text-tertiary">
                        File is {humanSize(loaded.size)}. Showing the first {humanSize(loaded.text.length)} only — download for the full contents.
                    </p>
                )}
                <pre className="max-h-[70dvh] overflow-auto rounded-lg bg-primary p-4 font-mono text-xs leading-relaxed text-primary ring-1 ring-secondary">
                    <code>{loaded.text}</code>
                </pre>
            </div>
        );
    }
    return (
        <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-medium text-secondary">No inline preview for this file type.</p>
            <p className="text-xs text-tertiary">Use Download to view it locally.</p>
        </div>
    );
}
