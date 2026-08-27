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
            x: 18,
            y: 10,
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

test.describe("FE-110A - Polygon house editor", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "gestos de mouse, solo desktop");

  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto("/plan");
    await page.getByTestId("house-footprint").click();
  });

  test("rectangle preset renders 4 vertex handles", async ({ page }) => {
    await page.getByTestId("house-preset-rectangle").click();
    await expect(page.locator('[data-testid^="polygon-vertex-"]')).toHaveCount(4);
  });

  test("L-shape preset renders 6 vertex handles and a polygon", async ({ page }) => {
    await page.getByTestId("house-preset-l_shape").click();
    await expect(page.locator('[data-testid^="polygon-vertex-"]')).toHaveCount(6);
    await expect(page.getByTestId("house-footprint").locator("polygon")).toBeVisible();
  });

  test("dragging a vertex reshapes the polygon", async ({ page }) => {
    await page.getByTestId("house-preset-rectangle").click();
    const vertex = page.getByTestId("polygon-vertex-0");
    const before = await page
      .getByTestId("house-footprint")
      .locator("polygon")
      .getAttribute("points");

    const box = (await vertex.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 40, box.y - 30, { steps: 4 });
    await page.mouse.up();

    const after = await page
      .getByTestId("house-footprint")
      .locator("polygon")
      .getAttribute("points");
    expect(after).not.toBe(before);
  });

  test("dragging the house body moves the whole polygon, not just the label", async ({ page }) => {
    await page.getByTestId("house-preset-l_shape").click();
    const polygon = page.getByTestId("house-footprint").locator("polygon");
    const before = await polygon.getAttribute("points");

    const box = (await polygon.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.25 + 80, box.y + box.height * 0.25 + 50, {
      steps: 5,
    });
    await page.mouse.up();

    const after = await polygon.getAttribute("points");
    expect(after).not.toBe(before);

    // El label CASA queda dentro del bbox del polígono (no flota lejos de la casa).
    const labelBox = (await page
      .getByTestId("house-footprint")
      .locator("text", { hasText: "CASA" })
      .boundingBox())!;
    const polygonBox = (await polygon.boundingBox())!;
    expect(labelBox.x + labelBox.width / 2).toBeGreaterThan(polygonBox.x);
    expect(labelBox.x + labelBox.width / 2).toBeLessThan(polygonBox.x + polygonBox.width);
    expect(labelBox.y + labelBox.height / 2).toBeGreaterThan(polygonBox.y);
    expect(labelBox.y + labelBox.height / 2).toBeLessThan(polygonBox.y + polygonBox.height);
  });

  test("vertex list collapses behind a dropdown in the inspector", async ({ page }) => {
    await page.getByTestId("house-preset-l_shape").click();
    const details = page.locator(".vertex-details");
    await expect(details.locator("summary")).toContainText("Vértices (6)");
    await expect(details.locator(".vertex-list")).not.toBeVisible();
    await details.locator("summary").click();
    await expect(details.locator(".vertex-list")).toBeVisible();
  });
});
