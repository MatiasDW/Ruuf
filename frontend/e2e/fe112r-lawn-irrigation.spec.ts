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
            x: 4,
            y: 4,
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

async function drawLawnZone(page: Page) {
  await page.getByTestId("add-lawn-zone-button").click();
  const map = page.locator(".garden-map");
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.85, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator(".lawn-zone")).toHaveCount(1);
}

test.describe("FE-112R - Riego de césped", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "gestos de mouse, solo desktop");

  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto("/plan");
    await expect(page.getByTestId("house-footprint")).toBeVisible();
  });

  test("a lawn zone gets a branch pipe and sprinkler coverage in water mode", async ({ page }) => {
    await drawLawnZone(page);
    await page.getByRole("button", { name: "Riego", exact: true }).click();

    await expect(page.locator(".lawn-irrigation-coverage")).toHaveCount(1);
    await expect(page.locator(".sprinkler-coverage").first()).toBeVisible();
  });

  test("legend shows aspersión césped and summary notes lawn inclusion", async ({ page }) => {
    await drawLawnZone(page);

    const summaryNote = page.locator(".summary-note");
    await expect(summaryNote).toContainText("incluye césped");

    await page.getByRole("button", { name: "Riego", exact: true }).click();
    const legend = page.getByTestId("irrigation-legend");
    await expect(legend).toContainText("Aspersión césped");
  });

  test("without lawn zones there is no sprinkler layer nor summary note", async ({ page }) => {
    await expect(page.locator(".summary-note")).toHaveCount(0);
    await page.getByRole("button", { name: "Riego", exact: true }).click();
    await expect(page.locator(".lawn-irrigation-coverage")).toHaveCount(0);
  });
});
