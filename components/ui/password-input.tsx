"use client";

import { useState, useCallback } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const MASK_CHAR = "•";

function maskWithLastVisible(value: string): string {
  if (value.length === 0) return "";
  if (value.length === 1) return value;
  return MASK_CHAR.repeat(value.length - 1) + value[value.length - 1];
}

interface PasswordInputProps extends Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

export function PasswordInput({ value, onChange, className, ...rest }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const displayValue = maskWithLastVisible(value);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;

      if (raw.length === 0) {
        onChange("");
        return;
      }
      if (raw.length === 1) {
        onChange(raw);
        return;
      }

      // Append at end
      if (raw.length > displayValue.length && raw.slice(0, -1) === displayValue) {
        onChange(value + raw[raw.length - 1]);
        return;
      }
      // Delete from end
      if (raw.length < displayValue.length && raw === displayValue.slice(0, raw.length)) {
        onChange(value.slice(0, raw.length));
        return;
      }
      // Replace last character
      if (
        raw.length === displayValue.length &&
        raw.slice(0, -1) === displayValue.slice(0, -1) &&
        raw[raw.length - 1] !== displayValue[displayValue.length - 1]
      ) {
        onChange(value.slice(0, -1) + raw[raw.length - 1]);
        return;
      }

      // Unknown edit (e.g. middle edit) – revert by remounting
      setResetKey((k) => k + 1);
    },
    [value, displayValue, onChange]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const pasted = e.clipboardData.getData("text");
      if (pasted != null) {
        e.preventDefault();
        onChange(pasted);
      }
    },
    [onChange]
  );

  if (showPassword) {
    return (
      <div className="relative">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("pr-10", className)}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShowPassword(false)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Hide password"
        >
          <EyeOff className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        key={resetKey}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onPaste={handlePaste}
        className={cn("pr-10", className)}
        {...rest}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setShowPassword(true)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Show password"
      >
        <Eye className="h-4 w-4" />
      </button>
    </div>
  );
}
