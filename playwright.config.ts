import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

function resolveChromiumExecutable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  }

  const cacheRoot = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
  if (!existsSync(cacheRoot)) {
    return undefined;
  }

  const browserDirs = readdirSync(cacheRoot)
    .filter((entry) => entry.startsWith("chromium_headless_shell-"))
    .sort((a, b) => b.localeCompare(a));

  for (const browserDir of browserDirs) {
    const browserRoot = path.join(cacheRoot, browserDir);
    const candidates = [
      path.join(browserRoot, "chrome-headless-shell-mac-arm64", "chrome-headless-shell"),
      path.join(browserRoot, "chrome-headless-shell-mac-x64", "chrome-headless-shell"),
      path.join(browserRoot, "chrome-headless-shell-linux64", "chrome-headless-shell"),
      path.join(browserRoot, "chrome-headless-shell-win64", "chrome-headless-shell.exe")
    ];
    const executable = candidates.find((candidate) => existsSync(candidate));
    if (executable) {
      return executable;
    }
  }

  return undefined;
}

const chromiumExecutable = resolveChromiumExecutable();

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: {
    timeout: 10_000
  },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: chromiumExecutable ? { executablePath: chromiumExecutable } : undefined
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${port}`,
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
      },
  projects: [
    {
      name: "mobile-360x800",
      use: {
        browserName: "chromium",
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
      }
    },
    {
      name: "mobile-390x844",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true
      }
    },
    {
      name: "mobile-428x926",
      use: {
        browserName: "chromium",
        viewport: { width: 428, height: 926 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true
      }
    },
    {
      name: "tablet-768x1024",
      use: {
        browserName: "chromium",
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
      }
    }
  ]
});
