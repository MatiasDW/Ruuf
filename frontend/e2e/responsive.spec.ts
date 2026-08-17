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
    name: "Lavender",
    category: "flower",
    clearance_radius_m: 0.6,
    structure_clearance_m: 0.2,
    sunlight: ["full_sun"],
    water_need: "low",
    liters_per_week: 8,
    style_tags: ["mediterranean"],
    color: "#b48ad6",
  },
];

const plan = {
  summary: {
    requested_items: 5,
    placed_items: 4,
    unplaced_items: 1,
    grid_step_m: 0.6,
    fits: false,
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
  unplaced: [
    {
      name: "Lavender",
      reason: "No remaining position satisfies the current spacing rules.",
      suggestions: ["Quillay"],
    },
  ],
  irrigation: {
    weekly_liters: 60,
    monthly_m3: 0.26,
    monthly_variable_cost_clp: 312,
    monthly_total_cost_clp: 3312,
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
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

const views = [
  { path: "/", heading: /Un jardín que se siente tuyo/i },
  { path: "/proyecto", heading: "Cuéntanos cómo es el espacio." },
  { path: "/plantas", heading: "Elige lo que te gustaría ver crecer." },
  { path: "/plan", heading: "Plano editable del jardín" },
];

for (const view of views) {
  test(`${view.path} fits the configured viewport`, async ({ page }) => {
    await page.goto(view.path);
    await expect(page.getByRole("heading", { name: view.heading })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  });
}

test("mobile navigation keeps every step reachable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile navigation is only rendered below the mobile breakpoint.");
  await page.goto("/plan");

  const navigation = page.getByRole("navigation", { name: "Pasos del proyecto" }).last();
  await expect(navigation.getByRole("link", { name: /Inicio/ })).toBeVisible();
  await expect(navigation.getByRole("link", { name: /Espacio/ })).toBeVisible();
  await expect(navigation.getByRole("link", { name: /Plantas/ })).toBeVisible();
  await expect(navigation.getByRole("link", { name: /Mi plan/ })).toBeVisible();
});

test("the technical plan exposes real editing controls", async ({ page }) => {
  await page.goto("/plan");

  const plant = page.getByTestId("plant-marker-0");
  const plantCore = plant.locator(".plant-core");
  const initialX = await plantCore.getAttribute("cx");
  await plant.focus();
  await page.keyboard.press("ArrowRight");
  await expect(plantCore).not.toHaveAttribute("cx", initialX ?? "");

  await page.getByTestId("house-footprint").click();
  await expect(page.getByTestId("house-resize-se")).toBeVisible();
  await page.getByRole("button", { name: "En L" }).last().click();
  await expect(page.getByTestId("house-footprint").locator("polygon")).toBeVisible();
});

test("editor history buttons undo and redo a multi-step plant drag", async ({ page }) => {
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
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20, { steps: 2 });
  await page.mouse.move(box.x + box.width / 2 + 65, box.y + box.height / 2 + 35, { steps: 3 });
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 55, { steps: 4 });
  await page.mouse.up();

  await expect(plantCore).not.toHaveAttribute("cx", initialX ?? "");
  await expect(plantCore).not.toHaveAttribute("cy", initialY ?? "");

  const movedX = await plantCore.getAttribute("cx");
  const movedY = await plantCore.getAttribute("cy");
  await page.getByRole("button", { name: "Deshacer cambio del editor" }).click();
  await expect(plantCore).toHaveAttribute("cx", initialX ?? "");
  await expect(plantCore).toHaveAttribute("cy", initialY ?? "");

  await page.getByRole("button", { name: "Rehacer cambio del editor" }).click();
  await expect(plantCore).toHaveAttribute("cx", movedX ?? "");
  await expect(plantCore).toHaveAttribute("cy", movedY ?? "");
});

test("editor history buttons undo and redo house changes", async ({ page }) => {
  await page.goto("/plan");

  await page.getByTestId("house-footprint").click();
  await page.getByRole("button", { name: "En L" }).last().click();
  await expect(page.getByTestId("house-footprint").locator("polygon")).toBeVisible();

  await page.getByRole("button", { name: "Deshacer cambio del editor" }).click();
  await expect(page.getByTestId("house-footprint").locator("rect")).toBeVisible();

  await page.getByRole("button", { name: "Rehacer cambio del editor" }).click();
  await expect(page.getByTestId("house-footprint").locator("polygon")).toBeVisible();
});

test("a plant can be dragged directly on the plan", async ({ page, isMobile }) => {
  test.skip(isMobile, "The mouse gesture is covered on the desktop editor.");
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
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 55, {
    steps: 5,
  });
  await page.mouse.up();

  await expect(plantCore).not.toHaveAttribute("cx", initialX ?? "");
});

test("irrigation mode renders pipes and emitter reach", async ({ page }) => {
  await page.goto("/plan");
  await page.getByRole("button", { name: "Riego", exact: true }).click();

  await expect(page.locator(".irrigation-layer")).toBeVisible();
  await expect(page.locator(".pipe-main")).toHaveCount(1);
  await expect(page.locator(".pipe-branch")).toHaveCount(1);
  await expect(page.locator(".water-coverage")).toHaveCount(1);
});
