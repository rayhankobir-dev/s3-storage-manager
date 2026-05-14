export type Connection = {
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    /** Cloudflare R2 account id. If set, endpoint is derived. */
    accountId?: string;
    /** Custom S3-compatible endpoint. Used when accountId is not provided. */
    endpoint?: string;
    /** Region. Defaults to "auto" for R2. */
    region?: string;
};

export type StorageObject = {
    key: string;
    size: number;
    lastModified: string | null;
    etag: string | null;
};

export type StorageFolder = {
    prefix: string;
};

export type ListResult = {
    folders: StorageFolder[];
    objects: StorageObject[];
    isTruncated: boolean;
    nextContinuationToken: string | null;
};
