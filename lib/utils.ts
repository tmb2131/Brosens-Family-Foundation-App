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

/** Charity Navigator score bands and meaning copy for Meeting tab (Oversight). */
export function charityNavigatorRating(score: number): { starLabel: string; meaning: string } {
  if (score >= 90) {
    return {
      starLabel: "Four-Star",
      meaning:
        "Exceeds or meets best practices and industry standards across almost all areas. Likely to be a highly-effective charity."
    };
  }
  if (score >= 75) {
    return {
      starLabel: "Three-Star",
      meaning: "Exceeds or meets best practices and industry standards across some areas."
    };
  }
  if (score >= 60) {
    return {
      starLabel: "Two-Star",
      meaning:
        "Meets or nearly meets industry standards in a few areas and underperforms most charities."
    };
  }
  if (score >= 50) {
    return {
      starLabel: "One-Star",
      meaning:
        "Fails to meet industry standards in most areas and underperforms almost all charities."
    };
  }
  return {
    starLabel: "No stars",
    meaning:
      "Performs below industry standards and well underperforms nearly all charities."
  };
}
