import { HttpError } from "@/lib/http-error";

export function normalizeOptionalHttpUrl(value: unknown, fieldLabel: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  const toParse =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(toParse);
  } catch {
    throw new HttpError(400, `${fieldLabel} must be a valid URL.`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new HttpError(400, `${fieldLabel} must start with http:// or https://.`);
  }

  return parsed.toString();
}
