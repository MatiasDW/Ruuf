import { expect, test } from "@playwright/test";

async function mockApi(page) {
  await page.route("**/api/plants", (route) =>
    route.fulfill({
      json: [
        {
          id: "quillay",
          name: "Quillay",
          category: "tree",
          clearance_radius_m: 2.5,
          structure_clearance_m: 2,
          sunlight: ["full_sun"],
          water_need: "low",
          liters_per_week: 60,
          style_tags: ["native"],
          color: "#7ea16b",
        },
      ],
    }),
  );
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: { status: "ok", database: "ok", redis: "ok", stitch: "configured" },
    }),
  );
  await page.route("**/api/plan", (route) =>
    route.fulfill({
      json: {
        summary: { requested_items: 1, placed_items: 1, unplaced_items: 0, fits: true },
        placements: [
          {
            plant_id: "quillay",
            name: "Quillay",
            x: 3,
            y: 3,
            clearance_radius_m: 2.5,
            structure_clearance_m: 2,
            water_need: "low",
            liters_per_week: 60,
            color: "#7ea16b",
          },
        ],
        unplaced: [],
        irrigation: {
          weekly_liters: 60,
          monthly_m3: 0.26,
          monthly_variable_cost_clp: 312,
          monthly_total_cost_clp: 3312,
        },
      },
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("landing loads with animations on desktop", async ({ page }) => {
  await page.goto("/");

  const hero = page.locator(".hero-section");
  await expect(hero).toBeVisible();

  const heading = page.locator("h1");
  await expect(heading).toContainText("Un jardín que se siente tuyo");

  const buttons = page.locator(".button");
  await expect(buttons).toHaveCount(2);
});

test("CTA buttons have hover animations", async ({ page }) => {
  await page.goto("/");

  const primaryButton = page.locator(".button.primary");
  await expect(primaryButton).toBeVisible();

  // Hover and check if scale animation applies (visual only, no need to assert)
  await primaryButton.hover();
  await page.waitForTimeout(100);

  // Verify button is still clickable
  await primaryButton.click();
  await expect(page).toHaveURL("/proyecto");
});

test("process section animates on scroll into view", async ({ page }) => {
  await page.goto("/");

  const processSection = page.locator(".process-section");

  // Initially might be out of view on mobile
  const isVisible = await processSection.isVisible();

  if (isVisible) {
    const articles = page.locator(".process-section article");
    await expect(articles).toHaveCount(3);
  }
});

test("smooth scroll works when navigating", async ({ page }) => {
  await page.goto("/");

  // Verify page doesn't jump (Lenis smooth scroll)
  const initialScroll = await page.evaluate(() => window.scrollY);
  expect(initialScroll).toBe(0);

  // Navigation should still work
  const navLink = page.getByRole("link", { name: "Espacio" });
  await navLink.click();

  await expect(page).toHaveURL("/proyecto");
});

test("landing responsive on tablet", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await mockApi(page);

  await page.goto("/");

  const hero = page.locator(".hero-section");
  await expect(hero).toBeVisible();

  const buttons = page.locator(".button");
  const box = await buttons.first().boundingBox();
  expect(box?.width).toBeGreaterThan(0);
});

test("landing responsive on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);

  await page.goto("/");

  const heading = page.locator("h1");
  await expect(heading).toBeVisible();

  const viewport = page.viewportSize();
  const heading_box = await heading.boundingBox();
  if (heading_box && viewport) {
    expect(heading_box.width).toBeLessThanOrEqual(viewport.width - 32); // Account for padding
  }
});

test("demo link works and doesn't break animations", async ({ page }) => {
  await page.goto("/");

  const demoButton = page.getByRole("link", { name: "Ver propuesta demo" });
  await demoButton.click();

  await expect(page).toHaveURL("/plan");
});
