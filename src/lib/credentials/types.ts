export type ConnectionPreview = {
    bucket: string;
    accountId?: string;
    endpoint?: string;
    region?: string;
    /** Masked access key id, safe to render in the UI. */
    accessKeyIdMasked: string;
};

export type SealedConnection = {
    token: string;
    preview: ConnectionPreview;
};
