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

test("water source selector renders in irrigation editor", async ({ page }) => {
  await page.goto("/plan");

  const riegoButton = page
    .locator("button[type='button']")
    .filter({ hasText: /^Riego$/ })
    .first();
  await riegoButton.click();

  const editButton = page.getByTestId("edit-irrigation-button");
  await editButton.click();

  const waterSourceButtons = page.locator(".water-source-button");
  await expect(waterSourceButtons).toHaveCount(5);
});

test("water source type can be changed", async ({ page }) => {
  await page.goto("/plan");

  const riegoButton = page
    .locator("button[type='button']")
    .filter({ hasText: /^Riego$/ })
    .first();
  await riegoButton.click();

  const editButton = page.getByTestId("edit-irrigation-button");
  await editButton.click();

  // Initially house_tap should be active
  const activeBefore = page.locator(".water-source-button.active");
  const textBefore = await activeBefore.textContent();
  expect(textBefore).toContain("Grifo");

  // Click pump button
  const pumpButton = page.locator(".water-source-button").filter({ hasText: "Bomba" });
  await pumpButton.click();

  // Pump should now be active
  const activeAfter = page.locator(".water-source-button.active");
  const textAfter = await activeAfter.textContent();
  expect(textAfter).toContain("Bomba");
});

test("map-instruction elements removed from page", async ({ page }) => {
  await page.goto("/plan");

  const mapInstructionElements = page.locator(".map-instruction");
  await expect(mapInstructionElements).toHaveCount(0);

  const hasEdicionActiva = page.locator("text=Edición activa");
  await expect(hasEdicionActiva).not.toBeVisible();
});

test("responsive on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);

  await page.goto("/plan");

  const riegoButton = page
    .locator("button[type='button']")
    .filter({ hasText: /^Riego$/ })
    .first();
  await riegoButton.click();

  const editButton = page.getByTestId("edit-irrigation-button");
  await editButton.click();

  const waterSourceButtons = page.locator(".water-source-button");
  await expect(waterSourceButtons).toHaveCount(5);

  const firstButton = waterSourceButtons.first();
  const box = await firstButton.boundingBox();
  expect(box?.width).toBeGreaterThan(0);
});

test("anonymous save persists the network in the browser and survives reload", async ({
  page,
  isMobile,
}) => {
  test.skip(Boolean(isMobile), "flujo de editor de escritorio");
  await page.goto("/plan");
  await page.getByRole("button", { name: "Riego", exact: true }).click();
  await page.getByTestId("edit-irrigation-button").click();

  // Editar: fuente tipo pozo y 3 tuberías.
  await page.getByRole("button", { name: /Pozo/ }).click();
  await page.getByRole("button", { name: "3", exact: true }).click();

  const saveButton = page.getByTestId("save-irrigation-network");
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await expect(saveButton).toBeDisabled(); // isDirty vuelve a false tras guardar

  await page.reload();
  await page.getByRole("button", { name: "Riego", exact: true }).click();
  await page.getByTestId("edit-irrigation-button").click();
  await expect(page.getByRole("button", { name: /Pozo/ })).toHaveClass(/active/);
  await expect(page.getByRole("button", { name: "3", exact: true })).toHaveClass(/active/);
});
