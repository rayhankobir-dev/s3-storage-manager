"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ArrowLeft,
    ChevronRight,
    Copy01,
    Folder,
    FolderPlus,
    Home01,
    Move,
} from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Input } from "@/components/base/input/input";
import { storageFetch, useConnection } from "@/stores/connection";
import type { Connection, ListResult } from "@/lib/s3/types";

export type TransferMode = "copy" | "move";

export type TransferSelection = {
    keys: string[];
    prefixes: string[];
    /** Source prefix the items were picked from. Used to default the picker location and skip a no-op move. */
    sourcePrefix: string;
    /** Human-readable summary like "3 items" — shown in the dialog. */
    summary: string;
};

type Props = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    mode: TransferMode;
    selection: TransferSelection | null;
    onDone: () => void;
};

function parentOf(prefix: string): string {
    if (!prefix) return "";
    const trimmed = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    const idx = trimmed.lastIndexOf("/");
    return idx === -1 ? "" : trimmed.slice(0, idx + 1);
}

function leafOfPrefix(prefix: string): string {
    const trimmed = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    const idx = trimmed.lastIndexOf("/");
    return idx === -1 ? trimmed : trimmed.slice(idx + 1);
}

export function DestinationPicker({ isOpen, onOpenChange, mode, selection, onDone }: Props) {
    const { connection } = useConnection();
    const [current, setCurrent] = useState("");
    const [listing, setListing] = useState<ListResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");

    // Reset picker location when (re)opened.
    useEffect(() => {
        if (!isOpen || !selection) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrent(selection.sourcePrefix);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError(null);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCreatingFolder(false);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNewFolderName("");
    }, [isOpen, selection]);

    const fetchListing = useCallback(
        async (conn: Connection, prefix: string) => {
            setLoading(true);
            setError(null);
            try {
                const response = await storageFetch(conn, `/api/objects?prefix=${encodeURIComponent(prefix)}`);
                if (!response.ok) {
                    const body = (await response.json().catch(() => null)) as { error?: string } | null;
                    throw new Error(body?.error || `Failed to list (${response.status})`);
                }
                const data = (await response.json()) as ListResult;
                setListing(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to list");
                setListing(null);
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    useEffect(() => {
        if (!isOpen || !connection) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchListing(connection, current);
    }, [isOpen, connection, current, fetchListing]);

    const segments = current.length === 0 ? [] : current.replace(/\/$/, "").split("/");
    const folders = listing?.folders ?? [];

    const sourcePrefixes = useMemo(() => {
        if (!selection) return new Set<string>();
        return new Set(selection.prefixes.map((p) => (p.endsWith("/") ? p : `${p}/`)));
    }, [selection]);

    // Disable destinations that would put a folder inside itself or its descendants.
    const isDescendantOfSource = useCallback(
        (candidate: string): boolean => {
            for (const source of sourcePrefixes) {
                if (candidate === source || candidate.startsWith(source)) return true;
            }
            return false;
        },
        [sourcePrefixes],
    );

    const canSubmit =
        selection !== null &&
        !submitting &&
        !loading &&
        // Move into the same folder is a no-op.
        !(mode === "move" && current === selection.sourcePrefix) &&
        !isDescendantOfSource(current);

    async function handleCreateFolder() {
        if (!connection) return;
        const cleaned = newFolderName.trim().replace(/^\/+|\/+$/g, "");
        if (!cleaned) return;
        const newPrefix = `${current}${cleaned}/`;
        try {
            const response = await storageFetch(connection, "/api/objects/folder", {
                method: "POST",
                body: JSON.stringify({ prefix: newPrefix }),
            });
            if (!response.ok) {
                const body = (await response.json().catch(() => null)) as { error?: string } | null;
                throw new Error(body?.error || "Failed to create folder");
            }
            setCreatingFolder(false);
            setNewFolderName("");
            setCurrent(newPrefix);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create folder");
        }
    }

    async function handleSubmit() {
        if (!connection || !selection) return;
        setSubmitting(true);
        setError(null);
        try {
            const response = await storageFetch(connection, "/api/objects/transfer", {
                method: "POST",
                body: JSON.stringify({
                    mode,
                    destination: current,
                    keys: selection.keys,
                    prefixes: selection.prefixes,
                }),
            });
            if (!response.ok) {
                const body = (await response.json().catch(() => null)) as { error?: string } | null;
                throw new Error(body?.error || `Failed to ${mode}`);
            }
            onDone();
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : `${mode} failed`);
        } finally {
            setSubmitting(false);
        }
    }

    const title = mode === "copy" ? "Copy to…" : "Move to…";
    const submitLabel = mode === "copy" ? "Copy here" : "Move here";

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
            <Modal>
                <Dialog>
                    <div className="relative w-full max-w-xl rounded-2xl bg-primary p-6 shadow-xl ring-1 ring-secondary">
                        <CloseButton size="sm" className="absolute top-3 right-3" onClick={() => onOpenChange(false)} />
                        <div className="flex items-start gap-4">
                            <FeaturedIcon icon={mode === "copy" ? Copy01 : Move} color="brand" theme="light" size="md" />
                            <div className="flex-1 min-w-0">
                                <h2 className="text-lg font-semibold text-primary">{title}</h2>
                                <p className="mt-1 text-sm text-tertiary">
                                    {selection ? (
                                        <>
                                            {mode === "copy" ? "Copy" : "Move"}{" "}
                                            <span className="font-medium text-secondary">{selection.summary}</span> from{" "}
                                            <span className="font-medium text-secondary">{selection.sourcePrefix || "/"}</span> into the folder
                                            you pick below.
                                        </>
                                    ) : null}
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 rounded-xl ring-1 ring-secondary">
                            <div className="flex items-center justify-between gap-2 border-b border-secondary px-3 py-2">
                                <nav aria-label="Destination breadcrumbs" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
                                    <button
                                        type="button"
                                        onClick={() => setCurrent("")}
                                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-tertiary hover:bg-secondary hover:text-primary"
                                    >
                                        <Home01 className="size-4" />
                                        <span>{connection?.bucket}</span>
                                    </button>
                                    {segments.map((segment, index) => {
                                        const nextPrefix = `${segments.slice(0, index + 1).join("/")}/`;
                                        const isLast = index === segments.length - 1;
                                        return (
                                            <span key={nextPrefix} className="inline-flex items-center gap-1">
                                                <ChevronRight className="size-4 text-fg-quaternary" />
                                                <button
                                                    type="button"
                                                    onClick={() => setCurrent(nextPrefix)}
                                                    className={`rounded-md px-2 py-1 ${
                                                        isLast ? "font-semibold text-primary" : "text-tertiary hover:bg-secondary hover:text-primary"
                                                    }`}
                                                >
                                                    {segment}
                                                </button>
                                            </span>
                                        );
                                    })}
                                </nav>
                                <Button
                                    color="tertiary"
                                    size="xs"
                                    iconLeading={ArrowLeft}
                                    onClick={() => setCurrent(parentOf(current))}
                                    isDisabled={current === ""}
                                >
                                    Up
                                </Button>
                            </div>

                            <div className="max-h-72 overflow-y-auto">
                                {loading ? (
                                    <div className="flex items-center justify-center py-10">
                                        <LoadingIndicator size="sm" type="line-spinner" label="Loading…" />
                                    </div>
                                ) : folders.length === 0 ? (
                                    <p className="px-4 py-8 text-center text-sm text-tertiary">No subfolders here.</p>
                                ) : (
                                    <ul className="divide-y divide-secondary">
                                        {folders.map((folder) => {
                                            const disabled = isDescendantOfSource(folder.prefix);
                                            return (
                                                <li key={folder.prefix}>
                                                    <button
                                                        type="button"
                                                        onClick={() => !disabled && setCurrent(folder.prefix)}
                                                        disabled={disabled}
                                                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-secondary_subtle disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        <Folder className="size-5 shrink-0 text-fg-brand-secondary" />
                                                        <span className="flex-1 truncate text-primary">{leafOfPrefix(folder.prefix)}</span>
                                                        {disabled && <span className="text-xs text-quaternary">source</span>}
                                                        <ChevronRight className="size-4 text-fg-quaternary" />
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>

                            <div className="border-t border-secondary p-3">
                                {creatingFolder ? (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            size="sm"
                                            placeholder="Folder name"
                                            value={newFolderName}
                                            onChange={setNewFolderName}
                                            autoFocus
                                            wrapperClassName="flex-1"
                                        />
                                        <Button color="secondary" size="sm" onClick={() => setCreatingFolder(false)}>
                                            Cancel
                                        </Button>
                                        <Button color="primary" size="sm" onClick={() => void handleCreateFolder()} isDisabled={newFolderName.trim().length === 0}>
                                            Create
                                        </Button>
                                    </div>
                                ) : (
                                    <Button color="tertiary" size="sm" iconLeading={FolderPlus} onClick={() => setCreatingFolder(true)}>
                                        New folder here
                                    </Button>
                                )}
                            </div>
                        </div>

                        {error && (
                            <p role="alert" className="mt-3 rounded-lg bg-error-primary px-3 py-2 text-sm text-error-primary ring-1 ring-error_subtle">
                                {error}
                            </p>
                        )}

                        <div className="mt-6 flex justify-end gap-2">
                            <Button color="secondary" size="md" onClick={() => onOpenChange(false)} isDisabled={submitting}>
                                Cancel
                            </Button>
                            <Button
                                color="primary"
                                size="md"
                                iconLeading={mode === "copy" ? Copy01 : Move}
                                isLoading={submitting}
                                isDisabled={!canSubmit}
                                onClick={() => void handleSubmit()}
                            >
                                {submitLabel}
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
