import { expect, test, type Page } from "@playwright/test";

const AUTH_EMAIL = process.env.E2E_EMAIL;
const AUTH_PASSWORD = process.env.E2E_PASSWORD;

const APP_ROUTES = [
  "/mobile",
  "/dashboard",
  "/workspace",
  "/meeting",
  "/reports",
  "/mandate",
  "/settings",
  "/proposals/new"
];

const FOCUS_NAV_ROUTES = new Set(["/mobile", "/meeting", "/dashboard", "/proposals/new"]);

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

async function assertSingleCurrentMobileNavItem(page: Page, route: string) {
  const activeNavLink = page.locator(
    "nav[aria-label='Mobile primary navigation'] a[aria-current='page']"
  );
  await expect(activeNavLink, `Expected exactly one active mobile nav item on route ${route}`).toHaveCount(1);

  const activeHref = await activeNavLink.first().getAttribute("href");
  if (!activeHref) {
    throw new Error(`Unable to determine active mobile nav href on route ${route}.`);
  }

  expect(
    route === activeHref || route.startsWith(`${activeHref}/`),
    `Expected active nav href ${activeHref} to match route ${route}`
  ).toBeTruthy();
}

async function assertNewProposalCtaState(page: Page, route: string) {
  if (!FOCUS_NAV_ROUTES.has(route)) {
    return;
  }

  const newProposalLink = page.locator(
    "nav[aria-label='Mobile primary navigation'] a[data-nav-href='/proposals/new']"
  );
  await expect(newProposalLink).toHaveCount(1);

  if (route === "/proposals/new") {
    await expect(newProposalLink).not.toHaveClass(/mobile-nav-link--cta/);
    return;
  }

  await expect(newProposalLink).toHaveClass(/mobile-nav-link--cta/);
}

async function capture(page: Page, route: string) {
  await page.screenshot({
    path: test.info().outputPath(`${routeToSlug(route)}.png`),
    fullPage: true,
    animations: "disabled"
  });
}

async function assertHistoricalImpactHoverState(page: Page) {
  const historicalImpactCard = page.locator("section", {
    has: page.getByText("Historical Impact")
  });
  const chartContainer = historicalImpactCard.locator(".recharts-responsive-container").first();

  await expect(chartContainer).toBeVisible();

  const box = await chartContainer.boundingBox();
  if (!box) {
    throw new Error("Unable to detect Historical Impact chart bounds.");
  }

  await page.mouse.move(box.x + box.width * 0.28, box.y + box.height * 0.48);
  await expect(page.locator(".recharts-default-tooltip")).toBeVisible();
  await expect(chartContainer.locator(".recharts-tooltip-cursor")).toHaveCount(0);
}

async function assertFocusPage(page: Page) {
  await expect(page.getByText("Today's Top Actions")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Outstanding Action Items" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View Full Details" })).toBeVisible();
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await waitForUISettled(page);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);

  await Promise.all([
    page.waitForURL(/\/(mobile|dashboard)$/),
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
    if (route === "/mobile") {
      await assertFocusPage(page);
    }
    if (route === "/dashboard") {
      await assertHistoricalImpactHoverState(page);
    }
    await assertSingleCurrentMobileNavItem(page, route);
    await assertNewProposalCtaState(page, route);
    await assertNoHorizontalOverflow(page, route);
    await capture(page, route);
  }
});
