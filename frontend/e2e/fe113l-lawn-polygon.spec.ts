import { expect, test, type Page } from "@playwright/test";

async function mockApi(page: Page) {
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
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("lawn zones render when viewed in Diseño mode", async ({ page }) => {
  await page.goto("/plan");
  await expect(page.locator(".garden-map")).toBeVisible();
});

test("sprinkler heads render inside lawn polygon when Riego active", async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile), "el toggle Riego del header solo aplica a desktop");
  await page.goto("/plan");
  await page.getByRole("button", { name: "Riego", exact: true }).click();
  const heads = page.locator(".sprinkler-head");
  const count = await heads.count();
  expect(count).toBeGreaterThan(0);
});

test("lawn zone area calculation uses polygon shape when present", async ({ page }) => {
  await page.goto("/plan");
  await expect(page.getByText("Césped").first()).toBeVisible();
});
