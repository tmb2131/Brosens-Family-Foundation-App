"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  /** Label shown on the dashed "add new" option, e.g. "Add as new organization" */
  addNewLabel?: string;
  maxSuggestions?: number;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  /** Extra class names applied to the outer wrapper (border container). */
  className?: string;
  /** Error state — adds a red border. */
  hasError?: boolean;
  /** Ref forwarded to the inner <input>. */
  inputRef?: React.Ref<HTMLInputElement>;
}

export function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  addNewLabel = "Add as new",
  maxSuggestions = 12,
  id,
  disabled,
  required,
  className,
  hasError,
  inputRef
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const fallbackId = useId();
  const baseId = id ?? fallbackId;
  const listboxId = `${baseId}-suggestions`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const normalized = value.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!suggestions.length) return [];
    if (!normalized) return suggestions.slice(0, maxSuggestions);

    const startsWithMatches: string[] = [];
    const containsMatches: string[] = [];

    for (const s of suggestions) {
      const n = s.trim().toLowerCase();
      if (!n.includes(normalized)) continue;
      if (n.startsWith(normalized)) {
        startsWithMatches.push(s);
      } else {
        containsMatches.push(s);
      }
    }

    return [...startsWithMatches, ...containsMatches].slice(0, maxSuggestions);
  }, [suggestions, normalized, maxSuggestions]);

  const hasExactMatch = normalized
    ? suggestions.some((s) => s.trim().toLowerCase() === normalized)
    : false;
  const showAddNew = Boolean(value.trim()) && !hasExactMatch;
  const showPanel = isOpen && (filtered.length > 0 || showAddNew);

  const itemCount = filtered.length + (showAddNew ? 1 : 0);

  useEffect(() => {
    setActiveIndex(-1);
  }, [filtered.length, showAddNew]);

  useEffect(() => {
    if (activeIndex < 0 || !listboxRef.current) return;
    const items = listboxRef.current.querySelectorAll<HTMLElement>("[role='option']");
    items[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const selectItem = (index: number) => {
    if (index < filtered.length) {
      onChange(filtered[index]);
    } else if (showAddNew) {
      onChange(value.trim());
    }
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const activeOptionId =
    activeIndex >= 0 ? `${baseId}-option-${activeIndex}` : undefined;

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative flex rounded-xl border shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:border-[hsl(var(--accent)/0.45)] focus-within:shadow-[0_0_0_2px_hsl(var(--accent)/0.22)]",
        hasError ? "border-rose-300" : "border-input",
        className
      )}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false);
          setActiveIndex(-1);
        }
      }}
    >
      <input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setIsOpen(false);
            setActiveIndex(-1);
            return;
          }

          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!isOpen) {
              setIsOpen(true);
              setActiveIndex(0);
            } else if (itemCount > 0) {
              setActiveIndex((prev) => (prev + 1) % itemCount);
            }
            return;
          }

          if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!isOpen) {
              setIsOpen(true);
              setActiveIndex(itemCount - 1);
            } else if (itemCount > 0) {
              setActiveIndex((prev) => (prev - 1 + itemCount) % itemCount);
            }
            return;
          }

          if (e.key === "Enter" && showPanel && activeIndex >= 0) {
            e.preventDefault();
            selectItem(activeIndex);
            return;
          }

          if (e.key === "Tab" && showPanel && activeIndex >= 0) {
            selectItem(activeIndex);
          }
        }}
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        role="combobox"
        className="min-w-0 flex-1 rounded-l-xl border-none bg-transparent px-2 py-2 text-sm text-foreground shadow-none outline-none disabled:opacity-50"
        aria-expanded={showPanel}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
      />
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setIsOpen((o) => !o)}
        disabled={disabled}
        className="flex w-10 shrink-0 items-center justify-center rounded-r-xl border-l border-input bg-muted text-muted-foreground transition hover:bg-muted/80 hover:text-foreground disabled:opacity-50"
        aria-label="Toggle suggestions"
      >
        <ChevronDown aria-hidden="true" size={16} />
      </button>

      {showPanel ? (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl"
        >
          {filtered.map((suggestion, index) => (
            <button
              key={suggestion}
              id={`${baseId}-option-${index}`}
              type="button"
              tabIndex={-1}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                "block w-full rounded-lg px-2 py-2.5 text-left text-sm text-foreground",
                index === activeIndex ? "bg-muted" : "hover:bg-muted"
              )}
            >
              {suggestion}
            </button>
          ))}
          {showAddNew ? (
            <button
              id={`${baseId}-option-${filtered.length}`}
              type="button"
              tabIndex={-1}
              role="option"
              aria-selected={filtered.length === activeIndex}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectItem(filtered.length)}
              onMouseEnter={() => setActiveIndex(filtered.length)}
              className={cn(
                "mt-1 block w-full rounded-lg border border-dashed border-border px-2 py-2.5 text-left text-sm text-muted-foreground",
                filtered.length === activeIndex ? "bg-muted" : "hover:bg-muted"
              )}
            >
              {addNewLabel}: {value.trim()}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
