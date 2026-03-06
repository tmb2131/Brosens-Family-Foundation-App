import { HttpError } from "@/lib/http-error";

/**
 * Normalize a CSV header string to snake_case for consistent matching.
 */
export function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Parse CSV text into a 2D array of strings, handling quoted fields and escaped quotes.
 * Throws HttpError(400) on malformed CSV (e.g. unclosed quotes).
 * Empty rows (all-whitespace cells) are filtered out.
 */
export function parseCsvRows(csvText: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];

    if (insideQuotes) {
      if (char === "\"") {
        if (csvText[index + 1] === "\"") {
          currentCell += "\"";
          index += 1;
        } else {
          insideQuotes = false;
        }
      } else {
        currentCell += char;
      }
      continue;
    }

    if (char === "\"") {
      insideQuotes = true;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (char === "\n") {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    currentCell += char;
  }

  if (insideQuotes) {
    throw new HttpError(400, "Malformed CSV: missing closing quote.");
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

/**
 * Find the first matching header index from a list of aliases.
 * Returns -1 if no alias is found.
 */
export function findHeaderIndex(headers: string[], aliases: readonly string[]) {
  return aliases.map((alias) => headers.indexOf(alias)).find((index) => index >= 0) ?? -1;
}
