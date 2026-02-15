import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { type VoteChoice } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function currency(
  value: number,
  options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}
) {
  const { minimumFractionDigits = 0, maximumFractionDigits = 2 } = options;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits,
    maximumFractionDigits
  }).format(value);
}

export function compactCurrency(value: number, options: { maximumFractionDigits?: number } = {}) {
  const { maximumFractionDigits = 1 } = options;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits
  }).format(value);
}

export function formatNumber(
  value: number,
  options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}
) {
  const { minimumFractionDigits = 0, maximumFractionDigits = 0 } = options;

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits,
    maximumFractionDigits
  }).format(value);
}

export function parseNumberInput(value: string): number | null {
  const normalized = value.trim().replace(/[$,\s]+/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function voteChoiceLabel(choice: VoteChoice) {
  switch (choice) {
    case "yes":
      return "Yes";
    case "no":
      return "No";
    case "acknowledged":
      return "Acknowledged";
    case "flagged":
      return "Flag for Discussion";
    default:
      return titleCase(choice);
  }
}

export function toISODate(value: Date) {
  return value.toISOString().slice(0, 10);
}
