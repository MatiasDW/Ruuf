import { expect, test, type Page } from "@playwright/test";

const plants = [
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
];

const plan = {
  summary: {
    requested_items: 1,
    placed_items: 1,
    unplaced_items: 0,
    grid_step_m: 0.6,
    fits: true,
  },
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
};

async function mockApi(page: Page) {
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 403, json: { error: { code: "permission_denied" } } }),
  );
  await page.route("**/api/plants", (route) => route.fulfill({ json: plants }));
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: { status: "ok", database: "ok", redis: "ok", stitch: "configured" },
    }),
  );
  await page.route("**/api/plan", (route) => route.fulfill({ json: plan }));
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("irrigation editor button appears in water mode", async ({ page }) => {
  await page.goto("/plan");

  // Switch to water mode
  await page.getByRole("button", { name: "Riego", exact: true }).click();

  // Look for the "Editar red" button
  const editButton = page.getByTestId("edit-irrigation-button");
  await expect(editButton).toBeVisible();
  await expect(editButton).toContainText("Editar red");
});

test("opens irrigation editor panel when clicking edit button", async ({ page }) => {
  await page.goto("/plan");

  // Switch to water mode
  await page.getByRole("button", { name: "Riego", exact: true }).click();

  // Click edit button
  await page.getByTestId("edit-irrigation-button").click();

  // Check that editor panel is visible
  const editor = page.getByTestId("irrigation-editor");
  await expect(editor).toBeVisible();
  await expect(editor).toContainText("Diseño de red de riego");
});

test("editor panel has all required controls", async ({ page }) => {
  await page.goto("/plan");

  await page.getByRole("button", { name: "Riego", exact: true }).click();
  await page.getByTestId("edit-irrigation-button").click();

  const editor = page.getByTestId("irrigation-editor");

  // Check position inputs
  const sourceXInput = editor.locator("#source-x");
  const sourceYInput = editor.locator("#source-y");
  await expect(sourceXInput).toBeVisible();
  await expect(sourceYInput).toBeVisible();

  // Check pipe selector buttons
  for (let i = 1; i <= 4; i++) {
    const button = editor.locator(".pipe-button").nth(i - 1);
    await expect(button).toBeVisible();
    await expect(button).toContainText(String(i));
  }

  // Check save button
  const saveButton = editor.getByTestId("save-irrigation-network");
  await expect(saveButton).toBeVisible();
});

test("can change water source position", async ({ page }) => {
  await page.goto("/plan");

  await page.getByRole("button", { name: "Riego", exact: true }).click();
  await page.getByTestId("edit-irrigation-button").click();

  const sourceXInput = page.locator("#source-x");
  await sourceXInput.clear();
  await sourceXInput.fill("5.5");

  await expect(sourceXInput).toHaveValue("5.5");
});

test("can select different number of pipes", async ({ page }) => {
  await page.goto("/plan");

  await page.getByRole("button", { name: "Riego", exact: true }).click();
  await page.getByTestId("edit-irrigation-button").click();

  // Click pipe button 3
  const pipeButtons = page.locator(".pipe-button");
  await pipeButtons.nth(2).click();

  const thirdButton = pipeButtons.nth(2);
  await expect(thirdButton).toHaveClass(/active/);
});

test("can add route points", async ({ page }) => {
  await page.goto("/plan");

  await page.getByRole("button", { name: "Riego", exact: true }).click();
  await page.getByTestId("edit-irrigation-button").click();

  const addButton = page.locator(".add-route-button");
  await expect(addButton).toBeVisible();
});

test("editor closes with close button", async ({ page }) => {
  await page.goto("/plan");

  await page.getByRole("button", { name: "Riego", exact: true }).click();
  await page.getByTestId("edit-irrigation-button").click();

  const editor = page.getByTestId("irrigation-editor");
  await expect(editor).toBeVisible();

  // Click close button
  const closeButton = editor.locator(".close-button");
  await closeButton.click();

  await expect(editor).not.toBeVisible();
  await expect(page.getByTestId("edit-irrigation-button")).toBeVisible();
});

test("responsive on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);

  await page.goto("/plan");

  await page.getByRole("button", { name: "Riego", exact: true }).click();
  await page.getByTestId("edit-irrigation-button").click();

  const editor = page.getByTestId("irrigation-editor");
  await expect(editor).toBeVisible();

  const box = await editor.boundingBox();
  const viewport = page.viewportSize();
  if (box && viewport) {
    expect(box.width).toBeLessThanOrEqual(viewport.width);
  }
});
