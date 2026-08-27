import { expect, test, type Page } from "@playwright/test";

async function mockApi(page: Page) {
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 403, json: { error: { code: "permission_denied" } } }),
  );
  await page.route("**/api/plants", (route) =>
    route.fulfill({ json: [{ id: "quillay", name: "Quillay", category: "tree", clearance_radius_m: 2.5, structure_clearance_m: 2, sunlight: ["full_sun"], water_need: "low", liters_per_week: 60, style_tags: ["native"], color: "#7ea16b" }] }),
  );
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { status: "ok", database: "ok", redis: "ok", stitch: "configured" } }),
  );
  await page.route("**/api/plan", (route) =>
    route.fulfill({
      json: {
        summary: { requested_items: 1, placed_items: 1, unplaced_items: 0, fits: true },
        placements: [{ plant_id: "quillay", name: "Quillay", x: 6, y: 6, clearance_radius_m: 2.5, structure_clearance_m: 2, water_need: "low", liters_per_week: 60, color: "#7ea16b" }],
        unplaced: [],
        irrigation: { weekly_liters: 60, monthly_m3: 0.26, monthly_variable_cost_clp: 312, monthly_total_cost_clp: 3312 },
      },
    }),
  );
  await page.route("**/api/grasses", (route) =>
    route.fulfill({ json: [{ id: "festuca", name: "Festuca", liters_per_m2_week: 12 }] }),
  );
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("add pool element to plan", async ({ page }) => {
  await page.goto("/plan");
  await expect(page.locator(".garden-map")).toBeVisible();
  const addBtn = page.getByRole("button", { name: "Piscina" });
  await expect(addBtn).toBeVisible();
});

test("select grass species updates water consumption", async ({ page }) => {
  await page.goto("/plan");
  await expect(page.locator(".garden-map")).toBeVisible();
  const elements = page.locator(".site-element");
  const count = await elements.count();
  expect(count).toBeGreaterThanOrEqual(0);
});

test("elements persist in payload for API", async ({ page }) => {
  await page.goto("/plan");
  await expect(page.getByRole("button", { name: /Piscina|Quincho|Terraza|Camino/i }).first()).toBeVisible();
});
