export interface CsvSection {
  label?: string;
  headers: readonly string[];
  rows: string[][];
}

export function escapeCsvField(value: string): string {
  const nextValue = value.replace(/"/g, '""');
  return /[",\n]/.test(nextValue) ? `"${nextValue}"` : nextValue;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeTsvField(value: string): string {
  return value.replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function buildCsv(sections: CsvSection[]): string {
  const parts: string[] = [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (i > 0) {
      parts.push("");
    }
    if (section.label) {
      parts.push(section.label);
    }
    parts.push(section.headers.join(","));
    for (const row of section.rows) {
      parts.push(row.map(escapeCsvField).join(","));
    }
  }
  return parts.join("\n");
}

export function buildTsv(sections: CsvSection[]): string {
  const parts: string[] = [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (i > 0) {
      parts.push("");
    }
    if (section.label) {
      parts.push(section.label);
    }
    parts.push(section.headers.join("\t"));
    for (const row of section.rows) {
      parts.push(row.map(sanitizeTsvField).join("\t"));
    }
  }
  return parts.join("\n");
}
