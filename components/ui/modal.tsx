"use client";

import type { HTMLAttributes, PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface ModalOverlayProps extends PropsWithChildren {
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  placement?: "bottom" | "center";
  className?: string;
}

export function ModalOverlay({
  children,
  onClose,
  closeOnBackdrop = true,
  placement = "bottom",
  className
}: ModalOverlayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-40 flex justify-center bg-black/50",
        placement === "center"
          ? "items-center px-4 py-6 sm:px-6 sm:py-6"
          : "items-end px-0 pb-0 pt-4 sm:items-center sm:px-6 sm:py-6",
        className
      )}
      onMouseDown={(event) => {
        if (!closeOnBackdrop) {
          return;
        }
        if (event.currentTarget === event.target) {
          onClose?.();
        }
      }}
    >
      {children}
    </div>,
    document.body
  );
}

export function ModalPanel({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className={cn(
        "w-full max-h-[85vh] overflow-y-auto rounded-t-3xl border border-zinc-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-h-[92vh] sm:rounded-3xl sm:p-5 sm:pb-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
