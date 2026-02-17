"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Number input for amounts. Prevents mouse wheel and ArrowUp/ArrowDown
 * from changing the value so only keyboard number input is allowed.
 * Uses a native wheel listener with { passive: false } so preventDefault works.
 */
const AmountInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input> & { type?: "number" }
>(function AmountInput({ className, onWheel, onKeyDown, ...props }, ref) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const mergedRef = React.useCallback(
    (el: HTMLInputElement | null) => {
      (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
    },
    [ref]
  );

  React.useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      onWheel?.(e as unknown as React.WheelEvent<HTMLInputElement>);
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [onWheel]);

  return (
    <Input
      ref={mergedRef}
      type="number"
      className={cn(className)}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
        }
        onKeyDown?.(e);
      }}
      {...props}
    />
  );
});

export { AmountInput };
