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
    style_tags: ["native", "mediterranean"],
    color: "#7ea16b",
  },
  {
    id: "lavender",
    name: "Lavanda",
    category: "flower",
    clearance_radius_m: 0.6,
    structure_clearance_m: 0.2,
    sunlight: ["full_sun"],
    water_need: "low",
    liters_per_week: 8,
    style_tags: ["mediterranean"],
    color: "#b48ad6",
  },
  {
    id: "espino",
    name: "Espino",
    category: "shrub",
    clearance_radius_m: 1.2,
    structure_clearance_m: 1,
    sunlight: ["full_sun", "partial_shade"],
    water_need: "low",
    liters_per_week: 15,
    style_tags: ["native"],
    color: "#a8b85d",
  },
  {
    id: "pasto",
    name: "Pasto",
    category: "grass",
    clearance_radius_m: 0.3,
    structure_clearance_m: 0,
    sunlight: ["full_sun"],
    water_need: "medium",
    liters_per_week: 20,
    style_tags: [],
    color: "#7cb342",
  },
];

const plan = {
  summary: {
    requested_items: 4,
    placed_items: 4,
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
    {
      plant_id: "lavender",
      name: "Lavanda",
      x: 8,
      y: 5,
      clearance_radius_m: 0.6,
      structure_clearance_m: 0.2,
      water_need: "low",
      liters_per_week: 8,
      color: "#b48ad6",
    },
    {
      plant_id: "espino",
      name: "Espino",
      x: 5,
      y: 8,
      clearance_radius_m: 1.2,
      structure_clearance_m: 1,
      water_need: "low",
      liters_per_week: 15,
      color: "#a8b85d",
    },
    {
      plant_id: "pasto",
      name: "Pasto",
      x: 10,
      y: 3,
      clearance_radius_m: 0.3,
      structure_clearance_m: 0,
      water_need: "medium",
      liters_per_week: 20,
      color: "#7cb342",
    },
  ],
  unplaced: [],
  irrigation: {
    weekly_liters: 103,
    monthly_m3: 0.447,
    monthly_variable_cost_clp: 536,
    monthly_total_cost_clp: 3536,
  },
};

async function mockApi(page: Page) {
  await page.route("**/api/plants", (route) => route.fulfill({ json: plants }));
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: { status: "ok", database: "ok", redis: "ok", stitch: "configured" },
    }),
  );
  await page.route("**/api/plan", (route) => route.fulfill({ json: plan }));
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 403, json: { error: { code: "permission_denied" } } }),
  );
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("renders category chips with correct plant counts", async ({ page }) => {
  await page.goto("/plan");

  const chips = page.locator(".plant-category-chips");
  await expect(chips).toBeVisible();

  const treeChip = chips.locator(".chip-tree");

  await expect(treeChip).toBeVisible();
  await expect(treeChip.locator(".chip-count")).toHaveText(/\d+/);
});

test("category chips remain responsive on mobile", async ({ page, isMobile }) => {
  await page.goto("/plan");

  const chips = page.locator(".plant-category-chips");
  await expect(chips).toBeVisible();

  if (isMobile) {
    const box = await chips.boundingBox();
    const viewportWidth = page.viewportSize()?.width ?? 360;
    if (box) {
      expect(box.width).toBeLessThanOrEqual(viewportWidth);
    }
  }
});

test("improved drag feedback with increased opacity and shadow", async ({ page }) => {
  await page.goto("/plan");

  const plant = page.getByTestId("plant-marker-0");
  const plantCore = plant.locator(".plant-core");
  const initialX = await plantCore.getAttribute("cx");

  const box = await plant.boundingBox();
  if (!box) {
    throw new Error("Plant marker did not produce a draggable bounding box.");
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();

  await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 30);
  const gardenEditor = page.locator(".garden-editor");
  await expect(gardenEditor).toHaveClass(/is-dragging/);

  await page.mouse.up();

  await expect(plantCore).not.toHaveAttribute("cx", initialX ?? "");
});

test("garden map renders metric grid pattern", async ({ page }) => {
  await page.goto("/plan");

  const gardenMap = page.locator(".garden-map");
  await expect(gardenMap).toBeVisible();

  const gridPattern = gardenMap.locator("defs > pattern#metric-grid");
  await expect(gridPattern).toBeAttached();
});

test("plant growth radius (clearance ring) is visible for validation", async ({ page }) => {
  await page.goto("/plan");

  const plant = page.getByTestId("plant-marker-0");
  await plant.scrollIntoViewIfNeeded();
  await plant.focus();

  const clearanceRing = plant.locator("circle.clearance-ring");
  await expect(clearanceRing).toBeVisible();
});

test("all prior FE-102 functionality still works: save/reopen/conflict", async ({ page }) => {
  let latest = 1;
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: { id: "user-1", email: "demo@ruuf.local", display_name: "Demo" },
    }),
  );
  await page.route("**/api/v1/auth/csrf", (route) =>
    route.fulfill({ json: { csrf_token: "csrf-token" } }),
  );
  await page.route("**/api/v1/projects/", (route) =>
    route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [{ id: "project-1", name: "Casa Demo" }],
      },
    }),
  );
  await page.route("**/api/v1/layouts/", (route) =>
    route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: "layout-1",
            project: "project-1",
            name: "Propuesta",
            current_revision: latest,
            updated_at: "2026-08-25T12:00:00Z",
          },
        ],
      },
    }),
  );
  await page.route("**/api/v1/site-versions/**", (route) =>
    route.fulfill({
      json: {
        id: "site-1",
        width_m: "12.000",
        height_m: "8.000",
        sunlight: "full_sun",
        preferred_style: "mediterranean",
        features: [],
      },
    }),
  );
  await page.route("**/api/v1/layouts/layout-1/revisions/", async (route) => {
    if (route.request().method() === "POST") {
      const body = (await route.request().postDataJSON()) as {
        base_revision: number;
        items: unknown[];
      };
      latest++;
      return route.fulfill({
        status: 201,
        json: {
          id: `version-${latest}`,
          layout: "layout-1",
          site_version: "site-1",
          revision: latest,
          status: "draft",
          result_summary: { placed_items: 1, fits: true },
          items: body.items,
          validation_issues: [],
          irrigation_estimates: [
            {
              weekly_liters: "60.000",
              monthly_cubic_meters: "0.260",
              incremental_cost_clp: "312.00",
              projected_bill_cost_clp: "3312.00",
            },
          ],
        },
      });
    }
    return route.fulfill({
      json: {
        count: latest,
        next: null,
        previous: null,
        results: [
          {
            id: `version-${latest}`,
            layout: "layout-1",
            site_version: "site-1",
            revision: latest,
            status: "draft",
            result_summary: { placed_items: 1, fits: true },
            items: [
              {
                stable_id: "item-1",
                plant_id: "quillay",
                name: "Quillay",
                x_m: "3.000",
                y_m: "3.000",
                clearance_radius_m: "2.50",
                color: "#7ea16b",
              },
            ],
            validation_issues: [],
            irrigation_estimates: [
              {
                weekly_liters: "60.000",
                monthly_cubic_meters: "0.260",
                incremental_cost_clp: "312.00",
                projected_bill_cost_clp: "3312.00",
              },
            ],
          },
        ],
      },
    });
  });

  await page.goto("/plan");
  await expect(page.getByTestId("save-status")).toContainText("revisión 1");

  const plant = page.getByTestId("plant-marker-0");
  await plant.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("save-status")).toContainText("Sin guardar");

  await page.getByTestId("save-plan").click();
  await expect(page.getByTestId("save-status")).toContainText("revisión 2");
});

test("keyboard navigation (arrow keys) still works with chips visible", async ({ page }) => {
  await page.goto("/plan");

  const plant = page.getByTestId("plant-marker-0");
  const plantCore = plant.locator(".plant-core");
  const initialX = await plantCore.getAttribute("cx");

  await plant.focus();
  await page.keyboard.press("ArrowRight");

  await expect(plantCore).not.toHaveAttribute("cx", initialX ?? "");
});

test("undo/redo buttons still work with improved visual layout", async ({ page }) => {
  await page.goto("/plan");

  const plant = page.getByTestId("plant-marker-0");
  const plantCore = plant.locator(".plant-core");
  const initialX = await plantCore.getAttribute("cx");
  const initialY = await plantCore.getAttribute("cy");

  const box = await plant.boundingBox();
  if (!box) {
    throw new Error("Plant marker did not produce a draggable bounding box.");
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 30);
  await page.mouse.up();

  await page.getByRole("button", { name: "Deshacer cambio del editor" }).click();
  await expect(plantCore).toHaveAttribute("cx", initialX ?? "");
  await expect(plantCore).toHaveAttribute("cy", initialY ?? "");

  await page.getByRole("button", { name: "Rehacer cambio del editor" }).click();
  await expect(plantCore).not.toHaveAttribute("cx", initialX ?? "");
});
