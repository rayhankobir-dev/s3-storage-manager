export type FileCategory = "folder" | "image" | "video" | "audio" | "document" | "code" | "other";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp", "ico", "tiff", "heic", "heif"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "mkv", "avi", "m4v", "wmv", "flv", "mpeg", "mpg"]);
const AUDIO_EXT = new Set(["mp3", "wav", "ogg", "m4a", "flac", "aac", "wma"]);
const DOCUMENT_EXT = new Set([
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "txt",
    "md",
    "markdown",
    "rtf",
    "odt",
    "ods",
    "odp",
    "csv",
    "tsv",
]);
const CODE_EXT = new Set([
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
    "json",
    "lock",
    "conf",
    "dockerfile",
    "php",
    "scala",
]);

function extensionOf(key: string): string | null {
    const lastSlash = key.lastIndexOf("/");
    const name = lastSlash === -1 ? key : key.slice(lastSlash + 1);
    const idx = name.lastIndexOf(".");
    if (idx <= 0) return null;
    return name.slice(idx + 1).toLowerCase();
}

export function categorize(kind: "folder" | "object", key: string): FileCategory {
    if (kind === "folder") return "folder";
    const ext = extensionOf(key);
    if (!ext) return "other";
    if (IMAGE_EXT.has(ext)) return "image";
    if (VIDEO_EXT.has(ext)) return "video";
    if (AUDIO_EXT.has(ext)) return "audio";
    if (DOCUMENT_EXT.has(ext)) return "document";
    if (CODE_EXT.has(ext)) return "code";
    return "other";
}
