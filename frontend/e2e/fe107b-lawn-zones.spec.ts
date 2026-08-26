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
            x: 5,
            y: 5,
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

test("page loads without errors in design mode", async ({ page }) => {
  await page.goto("/plan");

  const heading = page.locator("h1");
  await expect(heading).toContainText("Plano editable");
});

test("add lawn zone button exists", async ({ page }) => {
  await page.goto("/plan");

  const addButton = page.getByTestId("add-lawn-zone-button");
  await expect(addButton).toBeVisible();
  await expect(addButton).toContainText("Agregar césped");
});

test("lawn zone button toggles mode", async ({ page }) => {
  await page.goto("/plan");

  const addButton = page.getByTestId("add-lawn-zone-button");
  await addButton.click();

  await expect(addButton).toContainText("Cancelar");

  await addButton.click();
  await expect(addButton).toContainText("Agregar césped");
});

test("add lawn zone button hidden in water mode", async ({ page }) => {
  await page.goto("/plan");

  const riegoButton = page.locator("button[type='button']").filter({ hasText: /^Riego$/ }).first();
  await riegoButton.click();

  const addButton = page.getByTestId("add-lawn-zone-button");
  await expect(addButton).not.toBeVisible();
});
