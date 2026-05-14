"use client";

import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { ConnectForm } from "@/components/storage/connect-form";
import { FileBrowser } from "@/components/storage/file-browser";
import { useConnection } from "@/stores/connection";

export default function Home() {
    const { status } = useConnection();

    if (status === "idle") {
        return (
            <div className="flex flex-1 items-center justify-center bg-secondary/30 p-6">
                <LoadingIndicator size="md" type="line-spinner" label="Loading…" />
            </div>
        );
    }

    if (status === "missing") {
        return (
            <div className="flex flex-1 items-center justify-center bg-secondary/30 p-6">
                <ConnectForm />
            </div>
        );
    }

    return <FileBrowser />;
}
