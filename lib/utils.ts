import { clsx, type ClassValue } from "clsx";
import { type VoteChoice } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
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
