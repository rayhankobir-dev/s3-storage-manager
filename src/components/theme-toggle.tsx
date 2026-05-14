"use client";

import { useSyncExternalStore } from "react";
import { Moon01, Sun } from "@untitledui/icons";
import { useTheme } from "next-themes";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Button } from "./base/buttons/button";

/** Returns true once React has hydrated; false during SSR and the first client render. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const isDark = hydrated && resolvedTheme === "dark";

  // During SSR / first client render we render a neutral placeholder to avoid a hydration mismatch.
  if (!hydrated) {
    return (
      <ButtonUtility
        size="sm"
        color="tertiary"
        icon={Sun}
        tooltip="Toggle theme"
        aria-label="Toggle theme"
      />
    );
  }

  return (
    <Button
      size="sm"
      color="secondary"
      iconLeading={isDark ? Sun : Moon01}
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    />
  );
}
