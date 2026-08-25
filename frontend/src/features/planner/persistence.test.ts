import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachStableIds,
  conflictRevisionFrom,
  fetchLatestRevision,
  fetchSession,
  formFromSiteVersion,
  login,
  placementsFromRevision,
  planResultFromRevision,
  resetCsrfToken,
  RevisionConflictError,
  saveRevision,
  selectProjectLayout,
  toRevisionItems,
} from "./persistence";
import { defaultForm } from "./model";
import type { LayoutRevision, LayoutSummary, Placement, Plant, SiteVersionDetail } from "./types";

const plants: Plant[] = [
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

const revision: LayoutRevision = {
  id: "version-1",
  layout: "layout-1",
  site_version: "site-1",
  revision: 3,
  status: "draft",
  result_summary: { placed_items: 1, fits: true },
  irrigation_estimates: [
    {
      weekly_liters: "60.000",
      monthly_cubic_meters: "0.260",
      incremental_cost_clp: "312.00",
      projected_bill_cost_clp: "3312.00",
    },
  ],
  items: [
    {
      stable_id: "item-1",
      plant_id: "quillay",
      name: "Quillay",
      x_m: "12.900",
      y_m: "2.700",
      clearance_radius_m: "2.50",
      color: "#7ea16b",
    },
  ],
  validation_issues: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

function csrfResponse(token = "token-1"): Response {
  return jsonResponse({ csrf_token: token });
}

describe("persistence client", () => {
  beforeEach(() => {
    resetCsrfToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats a rejected session as anonymous instead of failing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(null, 403)));

    await expect(fetchSession()).resolves.toBeNull();
  });

  it("refreshes the CSRF token after login because Django rotates it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrfResponse("before-login"))
      .mockResolvedValueOnce(jsonResponse({ id: "user-1", email: "demo@ruuf.local" }))
      .mockResolvedValueOnce(csrfResponse("after-login"));
    vi.stubGlobal("fetch", fetchMock);

    await login("demo@ruuf.local", "secret");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/auth/login");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: expect.objectContaining({ "X-CSRFToken": "before-login" }),
    });
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/v1/auth/csrf");
  });

  it("sends base_revision and items with the CSRF header", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrfResponse())
      .mockResolvedValueOnce(jsonResponse(revision, 201));
    vi.stubGlobal("fetch", fetchMock);

    const saved = await saveRevision("layout-1", 2, [{ plant_id: "quillay", x_m: 3, y_m: 4 }]);

    expect(saved.revision).toBe(3);
    const [url, init] = fetchMock.mock.calls[1] ?? [];
    expect(url).toBe("/api/v1/layouts/layout-1/revisions/");
    expect(init).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({ "X-CSRFToken": "token-1" }),
    });
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      base_revision: 2,
      items: [{ plant_id: "quillay", x_m: 3, y_m: 4 }],
    });
  });

  it("raises a conflict with the numeric revision Django sends as a string", async () => {
    const conflict = {
      error: {
        code: "revision_conflict",
        details: { expected_revision: "1", current_revision: "2" },
      },
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(csrfResponse())
        .mockResolvedValueOnce(jsonResponse(conflict, 409)),
    );

    await expect(saveRevision("layout-1", 1, [])).rejects.toEqual(
      expect.objectContaining({ name: "RevisionConflictError", currentRevision: 2 }),
    );
  });

  it("reads the newest revision of a layout", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ count: 2, next: null, previous: null, results: [revision] }),
        ),
    );

    await expect(fetchLatestRevision("layout-1")).resolves.toMatchObject({ revision: 3 });
  });

  it("returns null when the layout has no saved revision yet", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ count: 0, next: null, previous: null, results: [] })),
    );

    await expect(fetchLatestRevision("layout-1")).resolves.toBeNull();
  });

  it("picks the most recent layout of the project because the API ignores filters", () => {
    const layouts: LayoutSummary[] = [
      {
        id: "other",
        project: "project-2",
        name: "Otro",
        current_revision: 9,
        updated_at: "2026-08-25T12:00:00Z",
      },
      {
        id: "old",
        project: "project-1",
        name: "Antiguo",
        current_revision: 1,
        updated_at: "2026-08-20T12:00:00Z",
      },
      {
        id: "fresh",
        project: "project-1",
        name: "Vigente",
        current_revision: 4,
        updated_at: "2026-08-24T12:00:00Z",
      },
    ];

    expect(selectProjectLayout(layouts, "project-1")?.id).toBe("fresh");
    expect(selectProjectLayout(layouts, "project-3")).toBeNull();
  });

  it("rounds coordinates to the three decimals Django accepts", () => {
    const placement: Placement = {
      plant_id: "quillay",
      name: "Quillay",
      x: 3.3000000000000003,
      y: 4.123456,
      clearance_radius_m: 2.5,
      structure_clearance_m: 2,
      water_need: "low",
      liters_per_week: 60,
      color: "#7ea16b",
      stable_id: "item-1",
    };

    expect(toRevisionItems([placement])).toEqual([
      { stable_id: "item-1", plant_id: "quillay", x_m: 3.3, y_m: 4.123 },
    ]);
  });

  it("omits stable_id for placements that were never saved", () => {
    expect(
      toRevisionItems([
        {
          plant_id: "quillay",
          name: "Quillay",
          x: 1,
          y: 2,
          clearance_radius_m: 2.5,
          structure_clearance_m: 2,
          water_need: "low",
          liters_per_week: 60,
          color: "#7ea16b",
        },
      ]),
    ).toEqual([{ plant_id: "quillay", x_m: 1, y_m: 2 }]);
  });

  it("rebuilds editable placements from a saved revision and the catalog", () => {
    expect(placementsFromRevision(revision, plants)).toEqual([
      {
        stable_id: "item-1",
        plant_id: "quillay",
        name: "Quillay",
        x: 12.9,
        y: 2.7,
        clearance_radius_m: 2.5,
        structure_clearance_m: 2,
        water_need: "low",
        liters_per_week: 60,
        color: "#7ea16b",
      },
    ]);
  });

  it("rebuilds summary, irrigation and unplaced items from a saved revision", () => {
    const result = planResultFromRevision(
      {
        ...revision,
        result_summary: { requested_items: 2, placed_items: 1, unplaced_items: 1, fits: false },
        validation_issues: [
          {
            code: "plant_not_placed",
            severity: "blocking",
            message: "No remaining position satisfies the current spacing rules.",
            item_ids: [],
            data: { plant_id: "quillay", suggestions: ["Lavanda"] },
          },
          {
            code: "plant_spacing",
            severity: "blocking",
            message: "Too close.",
            item_ids: ["item-1"],
          },
        ],
      },
      plants,
    );

    expect(result.summary).toEqual({
      requested_items: 2,
      placed_items: 1,
      unplaced_items: 1,
      grid_step_m: 0,
      fits: false,
    });
    expect(result.unplaced).toEqual([
      {
        name: "Quillay",
        reason: "No remaining position satisfies the current spacing rules.",
        suggestions: ["Lavanda"],
      },
    ]);
    expect(result.irrigation).toEqual({
      weekly_liters: 60,
      monthly_m3: 0.26,
      monthly_variable_cost_clp: 312,
      monthly_total_cost_clp: 3312,
    });
    expect(result.placements).toHaveLength(1);
  });

  it("adopts saved identities without reordering the editor", () => {
    const placements: Placement[] = [
      {
        plant_id: "quillay",
        name: "Quillay",
        x: 12.9,
        y: 2.7,
        clearance_radius_m: 2.5,
        structure_clearance_m: 2,
        water_need: "low",
        liters_per_week: 60,
        color: "#7ea16b",
      },
      {
        plant_id: "lavender",
        name: "Lavanda",
        x: 1,
        y: 1,
        clearance_radius_m: 0.6,
        structure_clearance_m: 0.2,
        water_need: "low",
        liters_per_week: 8,
        color: "#b48ad6",
      },
    ];

    const merged = attachStableIds(placements, revision.items);

    expect(merged[0]?.stable_id).toBe("item-1");
    expect(merged[1]?.stable_id).toBeUndefined();
    expect(merged.map((item) => item.plant_id)).toEqual(["quillay", "lavender"]);
  });

  it("restores yard and house geometry from the saved site version", () => {
    const site: SiteVersionDetail = {
      id: "site-1",
      width_m: "24.000",
      height_m: "14.000",
      sunlight: "partial_shade",
      preferred_style: "native",
      features: [
        {
          feature_type: "house",
          label: "House",
          geometry: { type: "rectangle", x: 4, y: 4, width: 7, height: 5 },
        },
      ],
    };

    expect(formFromSiteVersion(defaultForm, site)).toMatchObject({
      yard_width: 24,
      yard_height: 14,
      sunlight: "partial_shade",
      style: "native",
      obstacle_x: 4,
      obstacle_y: 4,
      obstacle_width: 7,
      obstacle_height: 5,
    });
  });

  it("defaults the conflict revision when the envelope is unreadable", () => {
    expect(conflictRevisionFrom(null)).toBe(0);
    expect(conflictRevisionFrom({ error: { details: { current_revision: "7" } } })).toBe(7);
  });

  it("exposes a typed conflict error", () => {
    const error = new RevisionConflictError(4);
    expect(error).toBeInstanceOf(Error);
    expect(error.currentRevision).toBe(4);
  });
});
