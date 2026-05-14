export type PreviewKind = "image" | "video" | "audio" | "pdf" | "text" | "none";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp", "ico"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "mkv", "avi", "m4v"]);
const AUDIO_EXT = new Set(["mp3", "wav", "ogg", "m4a", "flac", "aac"]);
const PDF_EXT = new Set(["pdf"]);
const TEXT_EXT = new Set([
    "txt",
    "md",
    "markdown",
    "json",
    "js",
    "jsx",
    "ts",
    "tsx",
    "mjs",
    "cjs",
    "css",
    "scss",
    "less",
    "html",
    "htm",
    "xml",
    "yaml",
    "yml",
    "toml",
    "ini",
    "env",
    "csv",
    "tsv",
    "log",
    "sh",
    "bash",
    "zsh",
    "py",
    "rb",
    "go",
    "rs",
    "java",
    "kt",
    "swift",
    "c",
    "cpp",
    "h",
    "hpp",
    "sql",
    "graphql",
    "gql",
    "vue",
    "svelte",
    "lock",
    "gitignore",
    "dockerfile",
    "conf",
]);

function extensionOf(key: string): string | null {
    const lastSlash = key.lastIndexOf("/");
    const name = lastSlash === -1 ? key : key.slice(lastSlash + 1);
    const idx = name.lastIndexOf(".");
    if (idx <= 0) return null;
    return name.slice(idx + 1).toLowerCase();
}

export function previewKind(key: string): PreviewKind {
    const ext = extensionOf(key);
    if (!ext) return "none";
    if (IMAGE_EXT.has(ext)) return "image";
    if (VIDEO_EXT.has(ext)) return "video";
    if (AUDIO_EXT.has(ext)) return "audio";
    if (PDF_EXT.has(ext)) return "pdf";
    if (TEXT_EXT.has(ext)) return "text";
    return "none";
}

export function isPreviewable(key: string): boolean {
    return previewKind(key) !== "none";
}

/** Max bytes we'll proxy for text preview. */
export const TEXT_PREVIEW_MAX_BYTES = 2 * 1024 * 1024;
