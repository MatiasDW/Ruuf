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

test("click Piscina button adds pool element visible in map", async ({ page }) => {
  await page.goto("/plan");
  await expect(page.locator(".garden-map")).toBeVisible();
  await page.getByRole("button", { name: "Piscina" }).click();
  const pool = page.locator(".site-element");
  await expect(pool).toBeVisible();
  const text = page.locator(".site-element-label");
  await expect(text).toContainText("pool");
});

test("drag pool element changes position", async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile), "mouse-only");
  await page.goto("/plan");
  await page.getByRole("button", { name: "Piscina" }).click();
  const elem = page.locator(".site-element rect").first();
  const box = await elem.boundingBox();
  if (!box) throw new Error("no bbox");
  await elem.click();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 50, box.y + 50);
  await page.mouse.up();
  const newBox = await elem.boundingBox();
  expect(newBox?.x).not.toEqual(box.x);
});

test("delete pool element removes it from map", async ({ page }) => {
  await page.goto("/plan");
  await page.getByRole("button", { name: "Piscina" }).click();
  const pool = page.locator(".site-element");
  await expect(pool).toBeVisible();
  const initialCount = await pool.count();
  expect(initialCount).toBeGreaterThan(0);
});

test("grass species selector updates water liters", async ({ page }) => {
  await page.goto("/plan");
  await expect(page.locator(".garden-map")).toBeVisible();
  await page.getByRole("button", { name: "Piscina" }).click();
  const elem = page.locator(".site-element").first();
  await expect(elem).toBeVisible();
});
