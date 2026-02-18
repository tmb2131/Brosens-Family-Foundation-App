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

/**
 * Client-side mobile detection for redirects (e.g. post-login).
 * Safe to call in the browser; returns false in SSR or when navigator is missing.
 */
export function getClientIsMobile(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const nav = navigator as { userAgent?: string; userAgentData?: { mobile?: boolean } };
  const ua = String(nav.userAgent ?? "").toLowerCase();
  const hinted = nav.userAgentData?.mobile;
  if (hinted === true) {
    return true;
  }
  if (hinted === false) {
    return false;
  }
  if (!ua) {
    return false;
  }
  const hasDesktopPlatformToken = /(windows nt|macintosh|x11|cros|linux x86_64)/i.test(ua);
  if (hasDesktopPlatformToken) {
    return false;
  }
  return /(android|iphone|ipod|blackberry|iemobile|opera mini|webos)/i.test(ua);
}

/**
 * Client-side iOS detection (iPhone, iPad, iPod).
 * Safe to call in the browser; returns false in SSR or when navigator is missing.
 */
export function getClientIsIOS(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = String(navigator.userAgent ?? "").toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

/**
 * Client-side PWA/standalone display detection.
 * Safe to call in the browser; returns false in SSR or when not in standalone mode.
 */
export function getClientIsStandalone(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true
  );
}
