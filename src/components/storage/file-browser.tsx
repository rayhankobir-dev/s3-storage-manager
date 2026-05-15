"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileIcon } from "@untitledui/file-icons";
import {
  ChevronDown,
  ChevronRight,
  Code01,
  Archive,
  Copy01,
  Download01,
  Edit01,
  Eye,
  File01,
  FileSearch01,
  Folder,
  FolderPlus,
  Grid01,
  Home01,
  Image01,
  LayoutAlt01,
  LogOut01,
  Move,
  MusicNote01,
  RefreshCw01,
  Rows01,
  SearchMd,
  Share01,
  Trash01,
  Upload01,
  UploadCloud02,
  VideoRecorder,
  XClose,
} from "@untitledui/icons";
import type { Selection, SortDescriptor } from "react-aria-components";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { Input } from "@/components/base/input/input";
import { EmptyState } from "@/components/application/empty-state/empty-state";
import { Table, TableCard } from "@/components/application/table/table";
import { CloudIllustration } from "@/components/shared-assets/illustrations/cloud";
import { BackgroundPattern } from "@/components/shared-assets/background-patterns";
import {
  ConfirmDialog,
  TextInputDialog,
} from "@/components/storage/storage-dialogs";
import {
  DestinationPicker,
  type TransferMode,
  type TransferSelection,
} from "@/components/storage/destination-picker";
import { FileGrid, type GridRow } from "@/components/storage/file-grid";
import { PreviewModal } from "@/components/storage/preview-modal";
import { ShareDialog } from "@/components/storage/share-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { UploadSlideout } from "@/components/storage/upload-slideout";
import { isPreviewable } from "@/lib/preview";
import { categorize, type FileCategory } from "@/lib/file-category";
import { cx } from "@/utils/cx";
import { storageFetch, useConnection } from "@/stores/connection";
import {
  friendlyMimeType,
  humanSize,
  inferFileIconType,
} from "@/lib/file-type";
import type { ListResult, StorageFolder, StorageObject } from "@/lib/s3/types";

type RowKind = "folder" | "object";

type Row = {
  id: string;
  kind: RowKind;
  name: string;
  /** Object key (for files) or folder prefix (for folders). */
  target: string;
  size: number | null;
  lastModified: string | null;
};

type DeleteTarget =
  | { kind: "single-object"; key: string; label: string }
  | { kind: "single-folder"; prefix: string; label: string }
  | { kind: "bulk"; keys: string[]; prefixes: string[]; label: string };

type RenameTarget = { row: Row };

function basename(input: string, isFolder: boolean): string {
  const trimmed = isFolder && input.endsWith("/") ? input.slice(0, -1) : input;
  const idx = trimmed.lastIndexOf("/");
  return idx === -1 ? trimmed : trimmed.slice(idx + 1);
}

function joinPrefix(parent: string, leaf: string): string {
  const cleaned = leaf.replace(/^\/+|\/+$/g, "");
  return `${parent}${cleaned}/`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

const CATEGORIES: Array<{
  id: FileCategory | "all";
  label: string;
  icon: typeof LayoutAlt01;
}> = [
  { id: "all", label: "All", icon: LayoutAlt01 },
  { id: "folder", label: "Folders", icon: Folder },
  { id: "image", label: "Images", icon: Image01 },
  { id: "video", label: "Videos", icon: VideoRecorder },
  { id: "audio", label: "Audio", icon: MusicNote01 },
  { id: "document", label: "Documents", icon: FileSearch01 },
  { id: "code", label: "Code", icon: Code01 },
  { id: "other", label: "Other", icon: File01 },
];

export function FileBrowser() {
  const { connection, credentialsHeader, clearConnection } = useConnection();
  const [prefix, setPrefix] = useState("");
  const [listing, setListing] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "name",
    direction: "ascending",
  });
  const [selected, setSelected] = useState<Selection>(new Set<string>());
  const [busy, setBusy] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{
    key: string;
    name: string;
  } | null>(null);
  const [previewTarget, setPreviewTarget] = useState<{
    key: string;
    name: string;
    size: number | null;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [pendingUpload, setPendingUpload] = useState<{
    token: number;
    files: File[];
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragFileCount, setDragFileCount] = useState(0);
  const dragCounter = useRef(0);
  const [category, setCategory] = useState<FileCategory | "all">("all");
  const [transfer, setTransfer] = useState<{
    mode: TransferMode;
    selection: TransferSelection;
  } | null>(null);

  const fetchListing = useCallback(async () => {
    if (!credentialsHeader) return;
    setLoading(true);
    setError(null);
    try {
      const response = await storageFetch(
        credentialsHeader,
        `/api/objects?prefix=${encodeURIComponent(prefix)}`,
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || `Failed to list (${response.status})`);
      }
      const data = (await response.json()) as ListResult;
      setListing(data);
      setSelected(new Set<string>());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list");
      setListing(null);
    } finally {
      setLoading(false);
    }
  }, [credentialsHeader, prefix]);

  useEffect(() => {
    // Standard data-fetch-on-dep-change pattern; setState happens inside the awaited callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchListing();
  }, [fetchListing]);

  const allRows = useMemo<Row[]>(() => {
    if (!listing) return [];
    const folders: Row[] = listing.folders.map((f: StorageFolder) => ({
      id: `f:${f.prefix}`,
      kind: "folder" as const,
      name: basename(f.prefix, true),
      target: f.prefix,
      size: null,
      lastModified: null,
    }));
    const files: Row[] = listing.objects.map((o: StorageObject) => ({
      id: `k:${o.key}`,
      kind: "object" as const,
      name: basename(o.key, false),
      target: o.key,
      size: o.size,
      lastModified: o.lastModified,
    }));
    return [...folders, ...files];
  }, [listing]);

  const categoryCounts = useMemo(() => {
    const counts: Record<FileCategory | "all", number> = {
      all: allRows.length,
      folder: 0,
      image: 0,
      video: 0,
      audio: 0,
      document: 0,
      code: 0,
      other: 0,
    };
    for (const row of allRows) {
      counts[categorize(row.kind, row.target)] += 1;
    }
    return counts;
  }, [allRows]);

  const rows = useMemo<Row[]>(() => {
    const term = filter.trim().toLowerCase();
    const matchesName = (r: Row) =>
      term.length === 0 || r.name.toLowerCase().includes(term);
    const matchesCategory = (r: Row) =>
      category === "all" || categorize(r.kind, r.target) === category;
    const filtered = allRows.filter(
      (r) => matchesName(r) && matchesCategory(r),
    );

    const direction = sortDescriptor.direction === "descending" ? -1 : 1;
    const compare = (a: Row, b: Row): number => {
      // Always keep folders on top regardless of sort.
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      switch (sortDescriptor.column) {
        case "size": {
          const sa = a.size ?? -1;
          const sb = b.size ?? -1;
          return direction * (sa - sb);
        }
        case "modified": {
          const ma = a.lastModified ? Date.parse(a.lastModified) : 0;
          const mb = b.lastModified ? Date.parse(b.lastModified) : 0;
          return direction * (ma - mb);
        }
        default:
          return direction * a.name.localeCompare(b.name);
      }
    };
    return [...filtered].sort(compare);
  }, [allRows, filter, category, sortDescriptor]);

  const selectedIds = useMemo<Set<string>>(() => {
    if (selected === "all") return new Set(rows.map((r) => r.id));
    return selected as Set<string>;
  }, [selected, rows]);

  const selectedCounts = useMemo(() => {
    let keys = 0;
    let prefixes = 0;
    for (const id of selectedIds) {
      if (id.startsWith("f:")) prefixes++;
      else if (id.startsWith("k:")) keys++;
    }
    return { keys, prefixes, total: keys + prefixes };
  }, [selectedIds]);

  function navigateTo(nextPrefix: string) {
    setPrefix(nextPrefix);
    setFilter("");
    setCategory("all");
  }

  async function handleCreateFolder(name: string) {
    if (!credentialsHeader) return;
    const newPrefix = joinPrefix(prefix, name);
    setBusy(true);
    try {
      const response = await storageFetch(credentialsHeader, "/api/objects/folder", {
        method: "POST",
        body: JSON.stringify({ prefix: newPrefix }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Failed to create folder");
      }
      setCreateFolderOpen(false);
      await fetchListing();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(key: string) {
    if (!credentialsHeader) return;
    setBusy(true);
    try {
      const response = await storageFetch(
        credentialsHeader,
        "/api/objects/download-url",
        {
          method: "POST",
          body: JSON.stringify({ key }),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Failed to sign download");
      }
      const { url } = (await response.json()) as { url: string };
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadZip(args: {
    keys: string[];
    prefixes: string[];
    name: string;
  }) {
    if (!credentialsHeader) return;
    setBusy(true);
    try {
      const response = await storageFetch(
        credentialsHeader,
        "/api/objects/download-zip/prepare",
        {
          method: "POST",
          body: JSON.stringify(args),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Failed to prepare zip");
      }
      const { token } = (await response.json()) as { token: string };
      // Navigate to the streaming endpoint — Content-Disposition triggers a
      // save dialog and the browser streams the body straight to disk.
      const url = `/api/objects/download-zip?token=${encodeURIComponent(token)}`;
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Zip download failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(value: string) {
    if (!credentialsHeader || !renameTarget) return;
    const { row } = renameTarget;
    const source = row.target;
    const destination =
      row.kind === "folder" ? joinPrefix(prefix, value) : `${prefix}${value}`;
    setBusy(true);
    try {
      const response = await storageFetch(credentialsHeader, "/api/objects/move", {
        method: "POST",
        body: JSON.stringify({
          source,
          destination,
          isPrefix: row.kind === "folder",
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Failed to rename");
      }
      setRenameTarget(null);
      await fetchListing();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!credentialsHeader || !deleteTarget) return;
    let body: { keys?: string[]; prefixes?: string[] };
    if (deleteTarget.kind === "single-object")
      body = { keys: [deleteTarget.key] };
    else if (deleteTarget.kind === "single-folder")
      body = { prefixes: [deleteTarget.prefix] };
    else body = { keys: deleteTarget.keys, prefixes: deleteTarget.prefixes };

    setBusy(true);
    try {
      const response = await storageFetch(credentialsHeader, "/api/objects", {
        method: "DELETE",
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errBody = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errBody?.error || "Failed to delete");
      }
      setDeleteTarget(null);
      await fetchListing();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  function openDeleteFor(row: Row) {
    setDeleteTarget(
      row.kind === "folder"
        ? {
            kind: "single-folder",
            prefix: row.target,
            label: `the folder “${row.name}”`,
          }
        : { kind: "single-object", key: row.target, label: `“${row.name}”` },
    );
  }

  function toggleRowSelection(id: string) {
    setSelected((current) => {
      const next =
        current === "all"
          ? new Set(rows.map((r) => r.id))
          : new Set(current as Set<string>);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openBulkDelete() {
    const keys: string[] = [];
    const prefixes: string[] = [];
    for (const id of selectedIds) {
      const row = rows.find((r) => r.id === id);
      if (!row) continue;
      if (row.kind === "folder") prefixes.push(row.target);
      else keys.push(row.target);
    }
    setDeleteTarget({
      kind: "bulk",
      keys,
      prefixes,
      label: `${selectedCounts.total} item${selectedCounts.total === 1 ? "" : "s"}`,
    });
  }

  function selectedAsTransfer(): TransferSelection {
    const keys: string[] = [];
    const prefixes: string[] = [];
    for (const id of selectedIds) {
      const row = rows.find((r) => r.id === id);
      if (!row) continue;
      if (row.kind === "folder") prefixes.push(row.target);
      else keys.push(row.target);
    }
    return {
      keys,
      prefixes,
      sourcePrefix: prefix,
      summary: `${selectedCounts.total} item${selectedCounts.total === 1 ? "" : "s"}`,
    };
  }

  const segments =
    prefix.length === 0 ? [] : prefix.replace(/\/$/, "").split("/");

  const activeCategory =
    CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];

  const isEmpty = !loading && rows.length === 0;
  const isFiltered = filter.trim().length > 0 || category !== "all";

  function hasFileDrag(event: React.DragEvent<HTMLDivElement>): boolean {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    if (!hasFileDrag(event)) return;
    event.preventDefault();
    dragCounter.current += 1;
    if (dragCounter.current === 1) {
      setIsDragging(true);
      // dataTransfer.items.length gives a count during dragenter on most browsers.
      setDragFileCount(event.dataTransfer.items?.length ?? 0);
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!hasFileDrag(event)) return;
    event.preventDefault();
    // "copy" gives the user the visual cue (cursor with +) that a drop will create something.
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (!hasFileDrag(event)) return;
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) {
      setIsDragging(false);
      setDragFileCount(0);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    if (!hasFileDrag(event)) return;
    event.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    setDragFileCount(0);
    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;
    setPendingUpload({ token: Date.now(), files });
    setUploadOpen(true);
  }

  return (
    <>
      <main
        className="relative mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-6 sm:p-4"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-overlay/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="relative flex flex-col items-center gap-4 overflow-hidden rounded-3xl border-2 border-dashed border-brand bg-primary px-12 py-10 text-center shadow-2xl animate-in zoom-in-95 fade-in duration-200">
              <BackgroundPattern
                pattern="grid"
                size="md"
                className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-60 [mask-image:radial-gradient(circle_at_center,black,transparent_75%)]"
              />
              <div className="relative">
                <CloudIllustration
                  size="lg"
                  className="motion-safe:animate-pulse"
                />
                <div className="absolute inset-x-0 top-1/3 flex justify-center">
                  <UploadCloud02 className="size-12 text-fg-brand-primary motion-safe:animate-bounce" />
                </div>
              </div>
              <div className="relative">
                <p className="text-2xl font-semibold text-primary">
                  Drop to upload
                </p>
                <p className="mt-1 text-sm text-tertiary">
                  {dragFileCount > 0 ? (
                    <>
                      <span className="font-medium text-secondary">
                        {dragFileCount} {dragFileCount === 1 ? "item" : "items"}
                      </span>{" "}
                      will land in{" "}
                    </>
                  ) : (
                    <>Files will land in </>
                  )}
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-secondary text-primary ring-1 ring-secondary_alt">
                    {connection?.bucket}
                    {prefix ? `/${prefix}` : "/"}
                  </span>
                </p>
              </div>
              <p className="relative text-xs text-quaternary">
                Release to start uploading · Esc to cancel
              </p>
            </div>
          </div>
        )}

        <header className="sticky top-0 z-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between py-3 px-4 rounded-xl bg-secondary_alt border border-secondary">
          <div className="min-w-0">
            <h3 className="truncate text-lg leading-none font-semibold text-primary">
              {connection?.bucket}
            </h3>
            <p className="truncate text-xs text-tertiary">
              {connection?.accountId
                ? `account ${connection.accountId.slice(0, 8)}…`
                : connection?.endpoint || "S3-compatible storage"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              color="secondary"
              size="sm"
              iconLeading={RefreshCw01}
              onClick={fetchListing}
              isDisabled={loading || busy}
            ></Button>
            <Button
              color="secondary-destructive"
              size="sm"
              iconLeading={LogOut01}
              onClick={() => setDisconnectOpen(true)}
            >
              Disconnect
            </Button>
          </div>
        </header>

        <section className="space-y-4 border border-secondary rounded-2xl bg-secondary_alt">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center px-6 pt-6">
            <Input
              placeholder="Filter by name"
              icon={SearchMd}
              value={filter}
              onChange={setFilter}
              wrapperClassName="sm:w-80"
              size="sm"
            />

            <Dropdown.Root>
              <Button
                color="secondary"
                size="sm"
                iconLeading={activeCategory.icon}
                iconTrailing={ChevronDown}
              >
                {activeCategory.label}
                <span className="ml-1 text-tertiary">
                  ({categoryCounts[category]})
                </span>
              </Button>
              <Dropdown.Popover className="w-60">
                <Dropdown.Menu
                  selectionMode="single"
                  selectedKeys={new Set([category])}
                  onAction={(key) => setCategory(key as FileCategory | "all")}
                >
                  {CATEGORIES.map((c) => (
                    <Dropdown.Item
                      key={c.id}
                      id={c.id}
                      icon={c.icon}
                      label={c.label}
                      addon={String(categoryCounts[c.id])}
                      isDisabled={c.id !== "all" && categoryCounts[c.id] === 0}
                    />
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          </div>

          <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-6">
            <nav
              aria-label="Breadcrumbs"
              className="flex min-w-0 flex-wrap items-center gap-1 text-sm"
            >
              <button
                type="button"
                onClick={() => navigateTo("")}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-tertiary hover:bg-secondary hover:text-primary"
              >
                <Home01 className="size-4" />
                <span>{connection?.bucket}</span>
              </button>
              {segments.map((segment, index) => {
                const nextPrefix = `${segments.slice(0, index + 1).join("/")}/`;
                const isLast = index === segments.length - 1;
                return (
                  <span
                    key={nextPrefix}
                    className="inline-flex items-center gap-1"
                  >
                    <ChevronRight className="size-4 text-fg-quaternary" />
                    <button
                      type="button"
                      onClick={() => navigateTo(nextPrefix)}
                      className={`rounded-md px-2 py-1 ${isLast ? "font-semibold text-primary" : "text-tertiary hover:bg-secondary hover:text-primary"}`}
                    >
                      {segment}
                    </button>
                  </span>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center rounded-lg ring-1 ring-secondary p-0.5 bg-primary">
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={viewMode === "list"}
                  onClick={() => setViewMode("list")}
                  className={cx(
                    "inline-flex items-center justify-center rounded-md px-2 py-1.5 transition",
                    viewMode === "list"
                      ? "bg-secondary text-primary shadow-xs"
                      : "text-tertiary hover:text-primary",
                  )}
                >
                  <Rows01 className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={viewMode === "grid"}
                  onClick={() => setViewMode("grid")}
                  className={cx(
                    "inline-flex items-center justify-center rounded-md px-2 py-1.5 transition",
                    viewMode === "grid"
                      ? "bg-secondary text-primary shadow-xs"
                      : "text-tertiary hover:text-primary",
                  )}
                >
                  <Grid01 className="size-4" />
                </button>
              </div>
              <Button
                color="secondary"
                size="sm"
                iconLeading={FolderPlus}
                onClick={() => setCreateFolderOpen(true)}
                isDisabled={busy}
              >
                New folder
              </Button>
              <Button
                color="primary"
                size="sm"
                iconLeading={Upload01}
                onClick={() => setUploadOpen(true)}
                isDisabled={busy}
              >
                Upload
              </Button>
            </div>
          </section>

          {selectedCounts.total > 0 && (
            <div className="flex gap-2 rounded-lg bg-brand-primary_alt px-3 mx-3 py-2 ring ring-secondary text-sm flex-row items-center sm:justify-between sm:px-4">
              <span className="min-w-0">
                <span className="font-semibold text-primary">
                  {selectedCounts.total}
                </span>{" "}
                selected
                {selectedCounts.prefixes > 0 && (
                  <span className="hidden text-tertiary sm:inline">
                    {" "}
                    · folders include all contents
                  </span>
                )}
              </span>
              <div className="-mx-1 flex flex-wrap items-center gap-1 sm:mx-0 sm:gap-2">
                <Button
                  color="tertiary"
                  size="sm"
                  iconLeading={XClose}
                  aria-label="Clear selection"
                  onClick={() => setSelected(new Set<string>())}
                ></Button>
                <Button
                  color="secondary"
                  size="sm"
                  iconLeading={Copy01}
                  aria-label="Copy selection to another folder"
                  onClick={() =>
                    setTransfer({
                      mode: "copy",
                      selection: selectedAsTransfer(),
                    })
                  }
                ></Button>
                <Button
                  color="secondary"
                  size="sm"
                  iconLeading={Move}
                  aria-label="Move selection to another folder"
                  onClick={() =>
                    setTransfer({
                      mode: "move",
                      selection: selectedAsTransfer(),
                    })
                  }
                ></Button>
                <Button
                  color="secondary"
                  size="sm"
                  iconLeading={Archive}
                  aria-label="Download selection as a zip"
                  onClick={() => {
                    const sel = selectedAsTransfer();
                    const baseName =
                      sel.keys.length + sel.prefixes.length === 1
                        ? (sel.prefixes[0] ?? sel.keys[0])
                            .replace(/\/$/, "")
                            .split("/")
                            .pop() || "download"
                        : `${connection?.bucket ?? "download"}-${sel.keys.length + sel.prefixes.length}-items`;
                    void handleDownloadZip({
                      keys: sel.keys,
                      prefixes: sel.prefixes,
                      name: baseName,
                    });
                  }}
                ></Button>
                <Button
                  color="primary-destructive"
                  size="sm"
                  iconLeading={Trash01}
                  aria-label="Delete selection"
                  onClick={openBulkDelete}
                  className="ml-auto sm:ml-0"
                ></Button>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg bg-error-primary px-4 py-2 text-sm text-error-primary ring-1 ring-error_subtle"
            >
              {error}
            </div>
          )}

          <TableCard.Root className=" rounded-t-none">
            {isEmpty ? (
              <div className="px-4 py-16 sm:px-6">
                <EmptyState size="md">
                  <EmptyState.Header>
                    {isFiltered ? (
                      <EmptyState.FeaturedIcon color="gray" icon={SearchMd} />
                    ) : (
                      <EmptyState.Illustration type="cloud" />
                    )}
                  </EmptyState.Header>
                  <EmptyState.Content>
                    <EmptyState.Title>
                      {isFiltered
                        ? "No matches"
                        : prefix.length === 0
                          ? "This bucket is empty"
                          : "This folder is empty"}
                    </EmptyState.Title>
                    <EmptyState.Description>
                      {isFiltered
                        ? "Try a different search term, or clear the filter."
                        : "Upload files or create a folder to get started."}
                    </EmptyState.Description>
                  </EmptyState.Content>
                  <EmptyState.Footer>
                    {isFiltered ? (
                      <Button
                        color="secondary"
                        size="md"
                        onClick={() => {
                          setFilter("");
                          setCategory("all");
                        }}
                      >
                        Clear filter
                      </Button>
                    ) : (
                      <>
                        <Button
                          color="secondary"
                          size="md"
                          iconLeading={FolderPlus}
                          onClick={() => setCreateFolderOpen(true)}
                        >
                          New folder
                        </Button>
                        <Button
                          color="primary"
                          size="md"
                          iconLeading={Upload01}
                          onClick={() => setUploadOpen(true)}
                        >
                          Upload
                        </Button>
                      </>
                    )}
                  </EmptyState.Footer>
                </EmptyState>
              </div>
            ) : viewMode === "grid" ? (
              <FileGrid
                rows={rows as GridRow[]}
                selected={selectedIds}
                onToggleSelected={toggleRowSelection}
                onOpenFolder={navigateTo}
                onDownload={(key) => void handleDownload(key)}
                onShare={(row) =>
                  setShareTarget({ key: row.target, name: row.name })
                }
                onRename={(row) => setRenameTarget({ row: row as Row })}
                onDelete={(row) => openDeleteFor(row as Row)}
                onPreview={(row) =>
                  setPreviewTarget({
                    key: row.target,
                    name: row.name,
                    size: row.size,
                  })
                }
                onCopy={(row) =>
                  setTransfer({
                    mode: "copy",
                    selection: {
                      keys: row.kind === "object" ? [row.target] : [],
                      prefixes: row.kind === "folder" ? [row.target] : [],
                      sourcePrefix: prefix,
                      summary: `“${row.name}”`,
                    },
                  })
                }
                onMove={(row) =>
                  setTransfer({
                    mode: "move",
                    selection: {
                      keys: row.kind === "object" ? [row.target] : [],
                      prefixes: row.kind === "folder" ? [row.target] : [],
                      sourcePrefix: prefix,
                      summary: `“${row.name}”`,
                    },
                  })
                }
                onDownloadZip={(row) =>
                  void handleDownloadZip({
                    keys: [],
                    prefixes: [row.target],
                    name: row.name.replace(/\/$/, "") || "download",
                  })
                }
                isBusy={busy}
              />
            ) : (
              <Table
                aria-label="Files and folders"
                selectionMode="multiple"
                selectionBehavior="toggle"
                selectedKeys={selected}
                onSelectionChange={setSelected}
                sortDescriptor={sortDescriptor}
                onSortChange={setSortDescriptor}
                onRowAction={(key) => {
                  const row = rows.find((r) => r.id === String(key));
                  if (row?.kind === "folder") navigateTo(row.target);
                  // Files: preview opens on double-click, not single-click.
                }}
              >
                <Table.Header>
                  <Table.Head
                    id="name"
                    isRowHeader
                    allowsSorting
                    label="Name"
                  />
                  <Table.Head id="type" label="Type" />
                  <Table.Head id="size" allowsSorting label="Size" />
                  <Table.Head id="modified" allowsSorting label="Modified" />
                  <Table.Head id="actions" label="" />
                </Table.Header>
                <Table.Body items={rows} renderEmptyState={() => null}>
                  {(row) => (
                    <Table.Row
                      id={row.id}
                      className={
                        row.kind === "folder" ? "cursor-pointer" : undefined
                      }
                      onDoubleClick={() => {
                        if (
                          row.kind === "object" &&
                          isPreviewable(row.target)
                        ) {
                          setPreviewTarget({
                            key: row.target,
                            name: row.name,
                            size: row.size,
                          });
                        }
                      }}
                    >
                      <Table.Cell>
                        <div className="flex items-center gap-3">
                          {row.kind === "folder" ? (
                            <Folder className="size-5 shrink-0 text-fg-brand-secondary" />
                          ) : (
                            <FileIcon
                              type={inferFileIconType(row.target)}
                              variant="solid"
                              className="size-5 shrink-0"
                            />
                          )}
                          <span
                            className={
                              row.kind === "folder"
                                ? "font-medium text-primary"
                                : "truncate text-primary"
                            }
                          >
                            {row.name}
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="font-mono text-xs text-tertiary">
                          {row.kind === "folder"
                            ? "folder"
                            : friendlyMimeType(row.target)}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        {row.size === null ? (
                          <span className="text-quaternary">—</span>
                        ) : (
                          humanSize(row.size)
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        {row.lastModified ? (
                          formatDate(row.lastModified)
                        ) : (
                          <span className="text-quaternary">—</span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <div
                          className="flex items-center justify-end gap-0.5"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {row.kind === "object" && (
                            <>
                              {isPreviewable(row.target) && (
                                <ButtonUtility
                                  size="xs"
                                  color="tertiary"
                                  icon={Eye}
                                  tooltip="Preview"
                                  isDisabled={busy}
                                  onClick={() =>
                                    setPreviewTarget({
                                      key: row.target,
                                      name: row.name,
                                      size: row.size,
                                    })
                                  }
                                />
                              )}
                              <ButtonUtility
                                size="xs"
                                color="tertiary"
                                icon={Download01}
                                tooltip="Download"
                                isDisabled={busy}
                                onClick={() => void handleDownload(row.target)}
                              />
                              <ButtonUtility
                                size="xs"
                                color="tertiary"
                                icon={Share01}
                                tooltip="Share link"
                                isDisabled={busy}
                                onClick={() =>
                                  setShareTarget({
                                    key: row.target,
                                    name: row.name,
                                  })
                                }
                              />
                            </>
                          )}
                          <ButtonUtility
                            size="xs"
                            color="tertiary"
                            icon={Trash01}
                            tooltip="Delete"
                            isDisabled={busy}
                            onClick={() => openDeleteFor(row)}
                          />
                          <Dropdown.Root>
                            <Dropdown.DotsButton
                              aria-label={`More actions for ${row.name}`}
                              isDisabled={busy}
                              className="p-1"
                            />
                            <Dropdown.Popover className="w-52">
                              <Dropdown.Menu
                                onAction={(key) => {
                                  if (key === "copy") {
                                    setTransfer({
                                      mode: "copy",
                                      selection: {
                                        keys:
                                          row.kind === "object"
                                            ? [row.target]
                                            : [],
                                        prefixes:
                                          row.kind === "folder"
                                            ? [row.target]
                                            : [],
                                        sourcePrefix: prefix,
                                        summary: `“${row.name}”`,
                                      },
                                    });
                                  } else if (key === "move") {
                                    setTransfer({
                                      mode: "move",
                                      selection: {
                                        keys:
                                          row.kind === "object"
                                            ? [row.target]
                                            : [],
                                        prefixes:
                                          row.kind === "folder"
                                            ? [row.target]
                                            : [],
                                        sourcePrefix: prefix,
                                        summary: `“${row.name}”`,
                                      },
                                    });
                                  } else if (key === "rename") {
                                    setRenameTarget({ row });
                                  } else if (key === "zip") {
                                    void handleDownloadZip({
                                      keys:
                                        row.kind === "object"
                                          ? [row.target]
                                          : [],
                                      prefixes:
                                        row.kind === "folder"
                                          ? [row.target]
                                          : [],
                                      name:
                                        row.name.replace(/\/$/, "") ||
                                        "download",
                                    });
                                  }
                                }}
                              >
                                <Dropdown.Item
                                  id="copy"
                                  icon={Copy01}
                                  label="Copy to…"
                                />
                                <Dropdown.Item
                                  id="move"
                                  icon={Move}
                                  label="Move to…"
                                />
                                <Dropdown.Item
                                  id="rename"
                                  icon={Edit01}
                                  label="Rename"
                                />
                                {row.kind === "folder" && (
                                  <Dropdown.Item
                                    id="zip"
                                    icon={Archive}
                                    label="Download as zip"
                                  />
                                )}
                              </Dropdown.Menu>
                            </Dropdown.Popover>
                          </Dropdown.Root>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
            )}
          </TableCard.Root>

          {listing?.isTruncated && rows.length > 0 && (
            <p className="text-xs text-tertiary">
              Showing the first 1,000 entries for this folder. Pagination beyond
              the first page is not yet implemented.
            </p>
          )}
        </section>
      </main>

      <UploadSlideout
        isOpen={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) setPendingUpload(null);
        }}
        prefix={prefix}
        onUploaded={fetchListing}
        pendingFiles={pendingUpload}
      />

      <TextInputDialog
        isOpen={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        variant="create-folder"
        title="New folder"
        description={
          <>
            Folders are key prefixes in S3 — created as a zero-byte placeholder
            inside{" "}
            <span className="font-medium text-secondary">{prefix || "/"}</span>.
          </>
        }
        label="Folder name"
        placeholder="reports"
        submitLabel="Create Folder"
        isBusy={busy}
        onSubmit={handleCreateFolder}
      />

      <TextInputDialog
        isOpen={renameTarget !== null}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        variant="rename"
        title="Rename"
        description={
          renameTarget?.row.kind === "folder" ? (
            <>
              Rename moves all contents to the new prefix (copy + delete). This
              may take a moment for large folders.
            </>
          ) : (
            <>S3 has no native rename — this performs a copy then delete.</>
          )
        }
        label="New name"
        initialValue={renameTarget?.row.name ?? ""}
        submitLabel="Rename"
        isBusy={busy}
        onSubmit={handleRename}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete forever?"
        description={
          <>
            You're about to delete{" "}
            <span className="font-medium text-secondary">
              {deleteTarget?.label}
            </span>
            . This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        isBusy={busy}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        isOpen={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Disconnect bucket?"
        description="Your credentials are only stored in this browser tab. Disconnecting clears them so you can connect another bucket."
        confirmLabel="Disconnect"
        onConfirm={() => {
          setDisconnectOpen(false);
          clearConnection();
        }}
      />

      <ShareDialog
        isOpen={shareTarget !== null}
        onOpenChange={(open) => !open && setShareTarget(null)}
        objectKey={shareTarget?.key ?? null}
        name={shareTarget?.name ?? null}
      />

      <PreviewModal
        isOpen={previewTarget !== null}
        onOpenChange={(open) => !open && setPreviewTarget(null)}
        objectKey={previewTarget?.key ?? null}
        name={previewTarget?.name ?? null}
        size={previewTarget?.size ?? null}
        onShare={(key, name) => {
          setPreviewTarget(null);
          setShareTarget({ key, name });
        }}
      />

      <DestinationPicker
        isOpen={transfer !== null}
        onOpenChange={(open) => !open && setTransfer(null)}
        mode={transfer?.mode ?? "copy"}
        selection={transfer?.selection ?? null}
        onDone={() => {
          setTransfer(null);
          void fetchListing();
        }}
      />
    </>
  );
}
