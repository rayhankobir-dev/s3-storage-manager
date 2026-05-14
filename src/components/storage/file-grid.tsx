"use client";

import { FileIcon } from "@untitledui/file-icons";
import { Download01, Edit01, Eye, Folder, Share01, Trash01 } from "@untitledui/icons";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { cx } from "@/utils/cx";
import { friendlyMimeType, humanSize, inferFileIconType } from "@/lib/file-type";
import { isPreviewable } from "@/lib/preview";

export type GridRow = {
    id: string;
    kind: "folder" | "object";
    name: string;
    target: string;
    size: number | null;
    lastModified: string | null;
};

type Props = {
    rows: GridRow[];
    selected: Set<string>;
    onToggleSelected: (id: string) => void;
    onOpenFolder: (prefix: string) => void;
    onDownload: (key: string) => void;
    onShare: (row: GridRow) => void;
    onRename: (row: GridRow) => void;
    onDelete: (row: GridRow) => void;
    onPreview?: (row: GridRow) => void;
    isBusy?: boolean;
};

export function FileGrid({
    rows,
    selected,
    onToggleSelected,
    onOpenFolder,
    onDownload,
    onShare,
    onRename,
    onDelete,
    onPreview,
    isBusy,
}: Props) {
    return (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {rows.map((row) => {
                const isSelected = selected.has(row.id);
                const isFolder = row.kind === "folder";
                const meta = isFolder
                    ? "Folder"
                    : `${friendlyMimeType(row.target)}${row.size !== null ? ` · ${humanSize(row.size)}` : ""}`;

                return (
                    <div
                        key={row.id}
                        className={cx(
                            "group relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-3 rounded-xl bg-primary p-4 text-center ring-1 ring-secondary transition hover:shadow-md",
                            isSelected && "ring-2 ring-brand bg-brand-primary/30",
                        )}
                        onClick={(event) => {
                            // Don't trigger when interacting with the checkbox or action buttons.
                            const target = event.target as HTMLElement;
                            if (target.closest("[data-grid-action]") || target.closest("[data-grid-checkbox]")) return;
                            if (isFolder) onOpenFolder(row.target);
                            // Files: preview opens on double-click, not single-click.
                        }}
                        onDoubleClick={(event) => {
                            const target = event.target as HTMLElement;
                            if (target.closest("[data-grid-action]") || target.closest("[data-grid-checkbox]")) return;
                            if (!isFolder && onPreview && isPreviewable(row.target)) {
                                onPreview(row);
                            }
                        }}
                    >
                        <div
                            data-grid-checkbox
                            className={cx(
                                "absolute top-2 left-2 transition",
                                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                            )}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <Checkbox
                                size="sm"
                                isSelected={isSelected}
                                onChange={() => onToggleSelected(row.id)}
                                aria-label={`Select ${row.name}`}
                            />
                        </div>

                        <div
                            data-grid-action
                            className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100"
                            onClick={(event) => event.stopPropagation()}
                        >
                            {!isFolder && (
                                <>
                                    {onPreview && isPreviewable(row.target) && (
                                        <ButtonUtility
                                            size="xs"
                                            color="tertiary"
                                            icon={Eye}
                                            tooltip="Preview"
                                            isDisabled={isBusy}
                                            onClick={() => onPreview(row)}
                                        />
                                    )}
                                    <ButtonUtility
                                        size="xs"
                                        color="tertiary"
                                        icon={Download01}
                                        tooltip="Download"
                                        isDisabled={isBusy}
                                        onClick={() => onDownload(row.target)}
                                    />
                                    <ButtonUtility
                                        size="xs"
                                        color="tertiary"
                                        icon={Share01}
                                        tooltip="Share"
                                        isDisabled={isBusy}
                                        onClick={() => onShare(row)}
                                    />
                                </>
                            )}
                            <ButtonUtility
                                size="xs"
                                color="tertiary"
                                icon={Edit01}
                                tooltip="Rename"
                                isDisabled={isBusy}
                                onClick={() => onRename(row)}
                            />
                            <ButtonUtility
                                size="xs"
                                color="tertiary"
                                icon={Trash01}
                                tooltip="Delete"
                                isDisabled={isBusy}
                                onClick={() => onDelete(row)}
                            />
                        </div>

                        {isFolder ? (
                            <Folder className="size-14 shrink-0 text-fg-brand-secondary" />
                        ) : (
                            <FileIcon
                                type={inferFileIconType(row.target)}
                                variant="solid"
                                className="size-14 shrink-0"
                            />
                        )}
                        <div className="min-w-0 w-full">
                            <p className="truncate text-sm font-medium text-primary">{row.name}</p>
                            <p className="truncate text-xs text-tertiary">{meta}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
