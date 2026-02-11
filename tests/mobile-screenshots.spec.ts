import { expect, test, type Page } from "@playwright/test";

const AUTH_EMAIL = process.env.E2E_EMAIL;
const AUTH_PASSWORD = process.env.E2E_PASSWORD;

const APP_ROUTES = [
  "/dashboard",
  "/workspace",
  "/meeting",
  "/reports",
  "/settings",
  "/proposals/new"
];

function routeToSlug(route: string) {
  if (route === "/") {
    return "home";
  }

  return route.replace(/^\/+/, "").replace(/[/?&=]+/g, "-");
}

async function waitForUISettled(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(800);
}

async function assertNoHorizontalOverflow(page: Page, route: string) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));

  expect(scrollWidth, `Expected no horizontal overflow on route ${route}`).toBeLessThanOrEqual(
    innerWidth + 1
  );
}

async function capture(page: Page, route: string) {
  await page.screenshot({
    path: test.info().outputPath(`${routeToSlug(route)}.png`),
    fullPage: true,
    animations: "disabled"
  });
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await waitForUISettled(page);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);

  await Promise.all([
    page.waitForURL("**/dashboard"),
    page.getByRole("button", { name: "Sign in" }).click()
  ]);

  await waitForUISettled(page);
}

test("captures mobile login screen", async ({ page }) => {
  await page.goto("/login");
  await waitForUISettled(page);

  await expect(page.getByText("Secure Access")).toBeVisible();
  await assertNoHorizontalOverflow(page, "/login");
  await capture(page, "/login");
});

test("captures mobile app screens with no horizontal overflow", async ({ page }) => {
  test.skip(!AUTH_EMAIL || !AUTH_PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD for authenticated screenshots.");

  await signIn(page, AUTH_EMAIL ?? "", AUTH_PASSWORD ?? "");

  for (const route of APP_ROUTES) {
    await page.goto(route);
    await waitForUISettled(page);
    await assertNoHorizontalOverflow(page, route);
    await capture(page, route);
  }
});
