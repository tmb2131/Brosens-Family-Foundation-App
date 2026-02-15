function parseClientHintMobile(value: string | null) {
  const normalized = String(value ?? "").trim();
  if (normalized === "?1") {
    return true;
  }
  if (normalized === "?0") {
    return false;
  }
  return null;
}

export function shouldUseMobileHome(input: {
  userAgent: string | null;
  clientHintMobile: string | null;
}) {
  const hintedMobile = parseClientHintMobile(input.clientHintMobile);
  if (hintedMobile !== null) {
    return hintedMobile;
  }

  const userAgent = String(input.userAgent ?? "").toLowerCase();
  if (!userAgent) {
    return false;
  }

  const hasDesktopPlatformToken = /(windows nt|macintosh|x11|cros|linux x86_64)/i.test(userAgent);
  if (hasDesktopPlatformToken) {
    return false;
  }

  return /(android|iphone|ipod|blackberry|iemobile|opera mini|webos)/i.test(userAgent);
}
