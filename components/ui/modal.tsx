"use client";

import type { HTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

interface ModalOverlayProps extends PropsWithChildren {
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  className?: string;
}

export function ModalOverlay({
  children,
  onClose,
  closeOnBackdrop = true,
  className
}: ModalOverlayProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-40 flex items-end justify-center bg-black/50 px-0 pb-0 pt-4 sm:items-center sm:px-6 sm:py-6",
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
    </div>
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
        "w-full max-h-[92vh] overflow-y-auto rounded-t-3xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-3xl sm:p-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
