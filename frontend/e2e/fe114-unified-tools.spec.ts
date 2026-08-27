import { expect, test, type Page } from "@playwright/test";

async function mockApi(page: Page) {
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 403, json: { error: { code: "permission_denied" } } }),
  );
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
    route.fulfill({ json: { status: "ok", database: "ok", redis: "ok", stitch: "configured" } }),
  );
  await page.route("**/api/plan", (route) =>
    route.fulfill({
      json: {
        summary: { requested_items: 1, placed_items: 1, unplaced_items: 0, fits: true },
        placements: [
          {
            plant_id: "quillay",
            name: "Quillay",
            x: 6,
            y: 6,
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
  await page.route("**/api/grasses", (route) =>
    route.fulfill({ json: [{ id: "festuca", name: "Festuca", liters_per_m2_week: 12 }] }),
  );
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("unified tools panel is visible on plan load", async ({ page }) => {
  await page.goto("/plan");
  await expect(page.locator(".tools-panel")).toBeVisible();
  const tools = page.locator(".tool-button");
  const count = await tools.count();
  expect(count).toBe(5);
});

test("agregar césped from unified panel activates draw mode", async ({ page }) => {
  await page.goto("/plan");
  const cespedButton = page.locator(".tool-button").first();
  await expect(cespedButton).toContainText("Césped");
  await cespedButton.click();
  await expect(cespedButton).toHaveClass(/active/);
});

test("adding piscina from unified panel creates element visible in map", async ({ page }) => {
  await page.goto("/plan");
  const piscButton = page.locator(".tool-button").nth(1);
  await expect(piscButton).toContainText("Piscina");
  await piscButton.click();
  const elem = page.locator(".site-element");
  await expect(elem).toBeVisible();
});
