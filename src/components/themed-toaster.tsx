"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

export function ThemedToaster() {
    const { resolvedTheme } = useTheme();
    const theme: "light" | "dark" | "system" =
        resolvedTheme === "dark" ? "dark" : resolvedTheme === "light" ? "light" : "system";
    return <Toaster theme={theme} position="top-right" richColors closeButton />;
}
