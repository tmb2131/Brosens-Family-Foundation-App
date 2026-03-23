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

function buildHtmlTable(headers: readonly string[], rows: string[][]): string {
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = row.map((v) => `<td>${escapeHtml(v)}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function buildExcelHtml(
  headers: readonly string[],
  rows: string[][],
  title: string,
  subtitle: string
): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; padding: 16px; }
      h1 { margin: 0 0 6px; font-size: 18px; }
      p { margin: 0 0 12px; color: #555; font-size: 12px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #d4d4d8; padding: 6px 8px; font-size: 12px; text-align: left; vertical-align: top; }
      th { background: #f4f4f5; font-weight: 700; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(subtitle)}</p>
    ${buildHtmlTable(headers, rows)}
  </body>
</html>`;
}

export function buildPrintableHtml(
  headers: readonly string[],
  rows: string[][],
  title: string,
  subtitle: string,
  options?: { extraStyle?: string; bodyContent?: string }
): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { margin: 0.5in; }
      body { font-family: Arial, sans-serif; margin: 0; color: #0f172a; }
      h1 { margin: 0 0 6px; font-size: 18px; }
      p { margin: 0 0 12px; color: #475569; font-size: 12px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; text-align: left; vertical-align: top; }
      th { background: #e2e8f0; font-weight: 700; }
      ${options?.extraStyle ?? ""}
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(subtitle)}</p>
    ${buildHtmlTable(headers, rows)}
    ${options?.bodyContent ?? ""}
  </body>
</html>`;
}
