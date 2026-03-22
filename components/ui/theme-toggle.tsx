"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeToggleProps = Omit<React.ComponentProps<"button">, "children">;

export function ThemeToggle({ className, onClick, ...props }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("rounded-full", className)}
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      {...props}
      onClick={(e) => {
        onClick?.(e);
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
      }}
    >
      {isDark ? (
        <Sun className="h-4 w-4" strokeWidth={1.5} />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={1.5} />
      )}
    </Button>
  );
}
