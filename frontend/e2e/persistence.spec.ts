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
];

/** The anonymous `/api/plan` proposal carries a single plant on purpose. */
const anonymousPlan = {
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

const user = { id: "user-1", email: "demo@ruuf.local", display_name: "Demo Ruuf" };
const project = { id: "project-1", name: "Casa Demo Lo Barnechea" };

const siteVersion = {
  id: "site-1",
  width_m: "20.000",
  height_m: "12.000",
  sunlight: "full_sun",
  preferred_style: "mediterranean",
  features: [
    {
      feature_type: "house",
      label: "House",
      geometry: { type: "rectangle", x: 3, y: 3, width: 6, height: 4 },
    },
  ],
};

function page1<Item>(results: Item[]) {
  return { count: results.length, next: null, previous: null, results };
}

function savedLayout(currentRevision: number) {
  return {
    id: "layout-1",
    project: project.id,
    name: "Propuesta guardada",
    current_revision: currentRevision,
    updated_at: "2026-08-25T12:00:00Z",
  };
}

function savedRevision(revision: number) {
  return {
    id: `version-${revision}`,
    layout: "layout-1",
    site_version: "site-1",
    revision,
    status: "draft",
    result_summary: { requested_items: 2, placed_items: 2, unplaced_items: 0, fits: true },
    items: [
      {
        stable_id: "item-1",
        plant_id: "quillay",
        name: "Quillay",
        x_m: "6.500",
        y_m: "9.250",
        clearance_radius_m: "2.50",
        color: "#7ea16b",
      },
      {
        stable_id: "item-2",
        plant_id: "lavender",
        name: "Lavanda",
        x_m: "14.000",
        y_m: "2.000",
        clearance_radius_m: "0.60",
        color: "#b48ad6",
      },
    ],
    validation_issues: [],
    irrigation_estimates: [
      {
        weekly_liters: "68.000",
        monthly_cubic_meters: "0.295",
        incremental_cost_clp: "354.00",
        projected_bill_cost_clp: "3354.00",
      },
    ],
  };
}

interface WorkspaceOptions {
  layouts: ReturnType<typeof savedLayout>[];
  latestRevision: () => number | null;
  onRevisionPost: (body: { base_revision: number; items: unknown[] }) => {
    status: number;
    json: unknown;
  };
}

async function mockWorkspace(page: Page, options: WorkspaceOptions) {
  await page.route("**/api/plants", (route) => route.fulfill({ json: plants }));
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { status: "ok", database: "ok", redis: "ok", stitch: "configured" } }),
  );
  await page.route("**/api/plan", (route) => route.fulfill({ json: anonymousPlan }));

  await page.route("**/api/v1/auth/me", (route) => route.fulfill({ json: user }));
  await page.route("**/api/v1/auth/csrf", (route) =>
    route.fulfill({ json: { csrf_token: "csrf-token" } }),
  );
  await page.route("**/api/v1/projects/", (route) => route.fulfill({ json: page1([project]) }));
  await page.route("**/api/v1/layouts/", (route) =>
    route.fulfill({ json: page1(options.layouts) }),
  );
  await page.route("**/api/v1/site-versions/site-1/", (route) =>
    route.fulfill({ json: siteVersion }),
  );
  await page.route("**/api/v1/projects/project-1/generate-plan/", (route) =>
    route.fulfill({
      status: 201,
      json: {
        ...anonymousPlan,
        layout_id: "layout-1",
        layout_version_id: "version-1",
        revision: 1,
      },
    }),
  );
  await page.route("**/api/v1/layouts/layout-1/revisions/", (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as {
        base_revision: number;
        items: unknown[];
      };
      const outcome = options.onRevisionPost(body);
      return route.fulfill({ status: outcome.status, json: outcome.json });
    }
    const revision = options.latestRevision();
    return route.fulfill({
      json: page1(revision === null ? [] : [savedRevision(revision)]),
    });
  });
}

async function nudgeFirstPlant(page: Page) {
  const plant = page.getByTestId("plant-marker-0");
  const core = plant.locator(".plant-core");
  await plant.scrollIntoViewIfNeeded();
  const initialX = await core.getAttribute("cx");
  await plant.focus();
  await page.keyboard.press("ArrowRight");
  await expect(core).not.toHaveAttribute("cx", initialX ?? "");
  return core;
}

test("saves a manual edit as a new revision", async ({ page }) => {
  const posted: Array<{ base_revision: number; items: unknown[] }> = [];
  await mockWorkspace(page, {
    layouts: [],
    latestRevision: () => null,
    onRevisionPost: (body) => {
      posted.push(body);
      return { status: 201, json: savedRevision(2) };
    },
  });

  await page.goto("/plan");
  await expect(page.getByTestId("save-status")).toHaveText(/Sin guardar/);

  await nudgeFirstPlant(page);
  await page.getByTestId("save-plan").click();

  await expect(page.getByTestId("save-status")).toHaveText(/Guardado · revisión 2/);
  expect(posted).toHaveLength(1);
  expect(posted[0]?.base_revision).toBe(1);
  expect(posted[0]?.items).toHaveLength(anonymousPlan.placements.length);
});

test("reopens the latest saved revision when returning to the plan", async ({ page }) => {
  await mockWorkspace(page, {
    layouts: [savedLayout(4)],
    latestRevision: () => 4,
    onRevisionPost: () => ({ status: 201, json: savedRevision(5) }),
  });

  await page.goto("/plan");

  await expect(page.getByTestId("save-status")).toHaveText(/Guardado · revisión 4/);
  await expect(page.getByRole("heading", { name: "20 × 12 m" })).toBeVisible();
  await expect(page.locator(".plant-marker")).toHaveCount(2);
});

test("shows a 409 conflict and reloads the latest revision without losing the local edit", async ({
  page,
}) => {
  let latest = 2;
  await mockWorkspace(page, {
    layouts: [savedLayout(2)],
    latestRevision: () => latest,
    onRevisionPost: () => {
      latest = 5;
      return {
        status: 409,
        json: {
          error: {
            code: "revision_conflict",
            message: "The request could not be completed.",
            details: {
              message: "The layout has a newer revision.",
              expected_revision: "2",
              current_revision: "5",
            },
          },
        },
      };
    },
  });

  await page.goto("/plan");
  await expect(page.getByTestId("save-status")).toHaveText(/Guardado · revisión 2/);

  const core = await nudgeFirstPlant(page);
  const editedX = await core.getAttribute("cx");
  await page.getByTestId("save-plan").click();

  await expect(page.getByTestId("save-status")).toHaveText(/Conflicto de versión/);
  await expect(page.getByTestId("save-conflict")).toContainText("revisión 5");
  await expect(core).toHaveAttribute("cx", editedX ?? "");

  await page.getByTestId("reload-keep-local").click();

  await expect(page.getByTestId("save-status")).toHaveText(/Sin guardar · revisión 5/);
  await expect(page.getByTestId("save-message")).toContainText("edición local");
  await expect(core).toHaveAttribute("cx", editedX ?? "");
});
