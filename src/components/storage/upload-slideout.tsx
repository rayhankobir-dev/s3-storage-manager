"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UploadCloud02 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { FileUpload, FileListItemProgressBar } from "@/components/application/file-upload/file-upload-base";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { encodeCredentialsHeader, useConnection } from "@/stores/connection";
import { inferFileIconType } from "@/lib/file-type";

type QueuedFile = {
    id: string;
    file: File;
    progress: number;
    status: "queued" | "uploading" | "done" | "failed";
    error?: string;
    xhr?: XMLHttpRequest;
};

type Props = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    prefix: string;
    onUploaded: () => void;
    /** Files to enqueue once. The `token` lets the parent push the same File objects again later. */
    pendingFiles?: { token: number; files: File[] } | null;
};

function makeId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function UploadSlideout({ isOpen, onOpenChange, prefix, onUploaded, pendingFiles }: Props) {
    const { connection } = useConnection();
    const [items, setItems] = useState<QueuedFile[]>([]);
    const itemsRef = useRef(items);
    itemsRef.current = items;

    const pendingCount = useMemo(() => items.filter((i) => i.status === "uploading" || i.status === "queued").length, [items]);
    const doneCount = useMemo(() => items.filter((i) => i.status === "done").length, [items]);
    const failedCount = useMemo(() => items.filter((i) => i.status === "failed").length, [items]);

    const uploadOne = useCallback(
        async (id: string, file: File) => {
            if (!connection) return;
            setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "uploading", progress: 0, error: undefined } : i)));

            try {
                const key = `${prefix}${file.name}`;
                const formData = new FormData();
                formData.append("key", key);
                formData.append("file", file, file.name);

                await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open("POST", "/api/objects/upload");
                    xhr.setRequestHeader("x-storage-credentials", encodeCredentialsHeader(connection));
                    xhr.upload.onprogress = (event) => {
                        if (event.lengthComputable) {
                            const progress = Math.round((event.loaded / event.total) * 100);
                            setItems((prev) => prev.map((i) => (i.id === id ? { ...i, progress } : i)));
                        }
                    };
                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve();
                        } else {
                            let message = `Upload failed (${xhr.status})`;
                            try {
                                const parsed = JSON.parse(xhr.responseText) as { error?: string };
                                if (parsed.error) message = parsed.error;
                            } catch {
                                // Body wasn't JSON.
                            }
                            reject(new Error(message));
                        }
                    };
                    xhr.onerror = () => reject(new Error("Network error"));
                    xhr.onabort = () => reject(new Error("Cancelled"));

                    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, xhr } : i)));
                    xhr.send(formData);
                });

                setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "done", progress: 100, xhr: undefined } : i)));
                onUploaded();
            } catch (err) {
                const message = err instanceof Error ? err.message : "Upload failed";
                setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "failed", error: message, xhr: undefined } : i)));
            }
        },
        [connection, prefix, onUploaded],
    );

    const addFiles = useCallback(
        (files: FileList | File[]) => {
            const fresh: QueuedFile[] = Array.from(files).map((file) => ({
                id: makeId(),
                file,
                progress: 0,
                status: "queued",
            }));
            setItems((prev) => [...prev, ...fresh]);
            // Kick off uploads sequentially per file but in parallel across files.
            for (const item of fresh) void uploadOne(item.id, item.file);
        },
        [uploadOne],
    );

    // Enqueue files passed in via `pendingFiles` (drag-and-drop from outside the slideout).
    const consumedToken = useRef<number | null>(null);
    useEffect(() => {
        if (!pendingFiles || pendingFiles.files.length === 0) return;
        if (consumedToken.current === pendingFiles.token) return;
        consumedToken.current = pendingFiles.token;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        addFiles(pendingFiles.files);
    }, [pendingFiles, addFiles]);

    const removeItem = useCallback((id: string) => {
        setItems((prev) => {
            const target = prev.find((i) => i.id === id);
            if (target?.xhr && target.status === "uploading") {
                target.xhr.abort();
            }
            return prev.filter((i) => i.id !== id);
        });
    }, []);

    const retryItem = useCallback(
        (id: string) => {
            const item = itemsRef.current.find((i) => i.id === id);
            if (!item) return;
            void uploadOne(id, item.file);
        },
        [uploadOne],
    );

    const clearCompleted = useCallback(() => {
        setItems((prev) => prev.filter((i) => i.status !== "done"));
    }, []);

    function handleClose() {
        // Abort any in-flight uploads on close.
        for (const i of itemsRef.current) {
            if (i.status === "uploading" && i.xhr) i.xhr.abort();
        }
        setItems([]);
        onOpenChange(false);
    }

    return (
        <SlideoutMenu isOpen={isOpen} onOpenChange={onOpenChange}>
            <SlideoutMenu.Header onClose={handleClose}>
                <div className="flex items-start gap-4">
                    <FeaturedIcon icon={UploadCloud02} color="brand" theme="modern" size="md" />
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-primary">Upload files</h2>
                        <p className="text-sm text-tertiary">
                            Files upload directly to your bucket. Destination:{" "}
                            <span className="font-medium text-secondary">{prefix || "/"}</span>
                        </p>
                    </div>
                </div>
            </SlideoutMenu.Header>

            <SlideoutMenu.Content>
                <FileUpload.Root>
                    <FileUpload.DropZone
                        hint="Any file type, up to your bucket's limit"
                        allowsMultiple
                        onDropFiles={addFiles}
                    />

                    {items.length > 0 && (
                        <div className="flex items-center justify-between text-xs text-tertiary">
                            <span>
                                {pendingCount > 0 && `${pendingCount} in progress`}
                                {pendingCount > 0 && (doneCount > 0 || failedCount > 0) && " • "}
                                {doneCount > 0 && `${doneCount} done`}
                                {doneCount > 0 && failedCount > 0 && " • "}
                                {failedCount > 0 && `${failedCount} failed`}
                            </span>
                            {doneCount > 0 && (
                                <button type="button" onClick={clearCompleted} className="font-semibold text-brand-secondary hover:underline">
                                    Clear completed
                                </button>
                            )}
                        </div>
                    )}

                    <FileUpload.List>
                        {items.map((item) => (
                            <FileListItemProgressBar
                                key={item.id}
                                name={item.file.name}
                                size={item.file.size}
                                progress={item.progress}
                                failed={item.status === "failed"}
                                type={inferFileIconType(item.file.name) as never}
                                onDelete={() => removeItem(item.id)}
                                onRetry={() => retryItem(item.id)}
                            />
                        ))}
                    </FileUpload.List>
                </FileUpload.Root>
            </SlideoutMenu.Content>

            <SlideoutMenu.Footer>
                <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-tertiary">
                        {pendingCount > 0 ? "Closing will cancel pending uploads." : "Ready to close when you are."}
                    </p>
                    <Button color="secondary" size="sm" onClick={handleClose}>
                        Done
                    </Button>
                </div>
            </SlideoutMenu.Footer>
        </SlideoutMenu>
    );
}
