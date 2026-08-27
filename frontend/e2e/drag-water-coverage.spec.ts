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

test.describe("riego drag", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "drag con mouse solo aplica a desktop");

  test("water coverage circle stays centered on the plant while dragging", async ({ page }) => {
    await page.goto("/plan");
    await page.getByRole("button", { name: "Riego", exact: true }).click();

    const marker = page.getByTestId("plant-marker-0");
    await expect(marker).toBeVisible();
    const core = marker.locator(".plant-core");
    const coverage = marker.locator(".water-coverage");
    await expect(coverage).toBeVisible();

    async function centers() {
      return {
        core: {
          cx: await core.getAttribute("cx"),
          cy: await core.getAttribute("cy"),
        },
        coverage: {
          cx: await coverage.getAttribute("cx"),
          cy: await coverage.getAttribute("cy"),
        },
      };
    }

    const before = await centers();
    expect(before.coverage.cx).toBe(before.core.cx);
    expect(before.coverage.cy).toBe(before.core.cy);

    const box = (await core.boundingBox())!;
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 120, startY + 80, { steps: 8 });

    // Mid-drag: coverage must share the plant's exact center.
    const during = await centers();
    expect(during.coverage.cx).toBe(during.core.cx);
    expect(during.coverage.cy).toBe(during.core.cy);
    expect(during.core.cx).not.toBe(before.core.cx);

    // Center-on-cursor: the core's on-screen center tracks the pointer.
    const midBox = (await core.boundingBox())!;
    expect(Math.abs(midBox.x + midBox.width / 2 - (startX + 120))).toBeLessThan(16);
    expect(Math.abs(midBox.y + midBox.height / 2 - (startY + 80))).toBeLessThan(16);

    await page.mouse.up();

    const after = await centers();
    expect(after.coverage.cx).toBe(after.core.cx);
    expect(after.coverage.cy).toBe(after.core.cy);
  });

  test("plant jumps under the cursor on grab", async ({ page }) => {
    await page.goto("/plan");
    await page.getByRole("button", { name: "Riego", exact: true }).click();

    const marker = page.getByTestId("plant-marker-0");
    const core = marker.locator(".plant-core");
    const box = (await core.boundingBox())!;

    // Grab near the edge of the core, not its center.
    const grabX = box.x + box.width * 0.9;
    const grabY = box.y + box.height * 0.9;
    await page.mouse.move(grabX, grabY);
    await page.mouse.down();

    const grabbed = (await core.boundingBox())!;
    expect(Math.abs(grabbed.x + grabbed.width / 2 - grabX)).toBeLessThan(16);
    expect(Math.abs(grabbed.y + grabbed.height / 2 - grabY)).toBeLessThan(16);

    await page.mouse.up();
  });
});

test("removed disclaimer labels are gone", async ({ page }) => {
  await page.goto("/plan");

  await expect(page.getByText("Riego referencial")).toHaveCount(0);
  await expect(page.getByText("Trazado L1 referencial")).toHaveCount(0);
  await expect(page.getByText("Anteproyecto L1")).toHaveCount(0);
  await expect(page.getByText("Ubicación válida")).toHaveCount(0);

  await page.getByRole("button", { name: "Riego", exact: true }).click();
  await expect(page.getByText("Riego referencial")).toHaveCount(0);
  await expect(page.getByTestId("irrigation-legend")).toBeVisible();
});
