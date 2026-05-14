// Mirrors the supported file types from @untitledui/file-icons (the runtime export
// only ships FileIcon, so we keep our own list here for icon inference).
const SUPPORTED_EXTENSIONS = new Set<string>([
    "aep",
    "ai",
    "avi",
    "css",
    "csv",
    "dmg",
    "doc",
    "docx",
    "eps",
    "exe",
    "fig",
    "gif",
    "html",
    "indd",
    "java",
    "jpeg",
    "jpg",
    "js",
    "json",
    "mkv",
    "mp3",
    "mp4",
    "mpeg",
    "pdf",
    "png",
    "ppt",
    "pptx",
    "psd",
    "rar",
    "rss",
    "sql",
    "svg",
    "tiff",
    "txt",
    "wav",
    "webp",
    "xls",
    "xlsx",
    "xml",
    "zip",
]);

/** Map an object key to a FileIcon type. Falls back to "empty". */
export function inferFileIconType(key: string): string {
    const ext = extensionOf(key);
    if (!ext) return "empty";
    return SUPPORTED_EXTENSIONS.has(ext) ? ext : "empty";
}

function extensionOf(key: string): string | null {
    const lastSlash = key.lastIndexOf("/");
    const name = lastSlash === -1 ? key : key.slice(lastSlash + 1);
    const idx = name.lastIndexOf(".");
    if (idx <= 0) return null;
    return name.slice(idx + 1).toLowerCase();
}

const EXTENSION_TO_MIME: Record<string, string> = {
    aep: "application/aep",
    ai: "application/postscript",
    avi: "video/x-msvideo",
    css: "text/css",
    csv: "text/csv",
    dmg: "application/x-apple-diskimage",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    eps: "application/postscript",
    exe: "application/x-msdownload",
    fig: "application/figma",
    gif: "image/gif",
    html: "text/html",
    indd: "application/x-indesign",
    java: "text/x-java-source",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    js: "text/javascript",
    json: "application/json",
    md: "text/markdown",
    mkv: "video/x-matroska",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    mpeg: "video/mpeg",
    pdf: "application/pdf",
    png: "image/png",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    psd: "image/vnd.adobe.photoshop",
    rar: "application/vnd.rar",
    rss: "application/rss+xml",
    sql: "application/sql",
    svg: "image/svg+xml",
    tiff: "image/tiff",
    txt: "text/plain",
    wav: "audio/wav",
    webp: "image/webp",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xml: "application/xml",
    zip: "application/zip",
};

/**
 * Returns a human-readable type label for a file key (e.g. "image/png", "application/pdf").
 * Falls back to "EXT file" if extension isn't in the known table, or "File" if no extension.
 */
export function friendlyMimeType(key: string): string {
    const ext = extensionOf(key);
    if (!ext) return "File";
    const known = EXTENSION_TO_MIME[ext];
    if (known) return known;
    return `${ext.toUpperCase()} file`;
}

export function humanSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
