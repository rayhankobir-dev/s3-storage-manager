"use client";

import { FileIcon } from "@untitledui/file-icons";
import { Archive, Copy01, Download01, Edit01, Eye, Folder, Move, Share01, Trash01 } from "@untitledui/icons";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Dropdown } from "@/components/base/dropdown/dropdown";
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
    onCopy?: (row: GridRow) => void;
    onMove?: (row: GridRow) => void;
    onDownloadZip?: (row: GridRow) => void;
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
    onCopy,
    onMove,
    onDownloadZip,
    isBusy,
}: Props) {
    return (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {rows.map((row) => {
                const isSelected = selected.has(row.id);
                const isFolder = row.kind === "folder";
                const previewable = !isFolder && isPreviewable(row.target);
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
                            if (!isFolder && onPreview && previewable) {
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
                            className="absolute top-1.5 right-1.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <Dropdown.Root>
                                <Dropdown.DotsButton
                                    aria-label={`Actions for ${row.name}`}
                                    isDisabled={isBusy}
                                    className="rounded-md bg-primary/80 p-1 ring-1 ring-secondary backdrop-blur-sm hover:bg-secondary"
                                />
                                <Dropdown.Popover className="w-48">
                                    <Dropdown.Menu
                                        onAction={(key) => {
                                            switch (key) {
                                                case "preview":
                                                    if (onPreview) onPreview(row);
                                                    break;
                                                case "download":
                                                    onDownload(row.target);
                                                    break;
                                                case "share":
                                                    onShare(row);
                                                    break;
                                                case "copy":
                                                    if (onCopy) onCopy(row);
                                                    break;
                                                case "move":
                                                    if (onMove) onMove(row);
                                                    break;
                                                case "zip":
                                                    if (onDownloadZip) onDownloadZip(row);
                                                    break;
                                                case "rename":
                                                    onRename(row);
                                                    break;
                                                case "delete":
                                                    onDelete(row);
                                                    break;
                                            }
                                        }}
                                    >
                                        {!isFolder && previewable && onPreview ? (
                                            <Dropdown.Item id="preview" icon={Eye} label="Preview" />
                                        ) : null}
                                        {!isFolder ? <Dropdown.Item id="download" icon={Download01} label="Download" /> : null}
                                        {!isFolder ? <Dropdown.Item id="share" icon={Share01} label="Share link" /> : null}
                                        {onCopy ? <Dropdown.Item id="copy" icon={Copy01} label="Copy to…" /> : null}
                                        {onMove ? <Dropdown.Item id="move" icon={Move} label="Move to…" /> : null}
                                        {isFolder && onDownloadZip ? (
                                            <Dropdown.Item id="zip" icon={Archive} label="Download as zip" />
                                        ) : null}
                                        <Dropdown.Item id="rename" icon={Edit01} label="Rename" />
                                        <Dropdown.Separator />
                                        <Dropdown.Item id="delete" icon={Trash01} label="Delete" />
                                    </Dropdown.Menu>
                                </Dropdown.Popover>
                            </Dropdown.Root>
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
