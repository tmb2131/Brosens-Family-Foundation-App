"use client";

import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="rounded-full border bg-card px-3 py-1 text-xs font-semibold"
      type="button"
    >
      {resolvedTheme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
