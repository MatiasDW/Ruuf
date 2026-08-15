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
  { path: "/plan", heading: "Tu jardín, organizado con criterios reales." },
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
