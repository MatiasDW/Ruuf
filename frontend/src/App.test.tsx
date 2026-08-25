import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { PlanResult, Plant, SystemHealth } from "./features/planner/types";

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
    style_tags: ["native", "mediterranean"],
    color: "#7ea16b",
  },
];

const health: SystemHealth = {
  status: "ok",
  database: "ok",
  redis: "ok",
  stitch: "configured",
};

const result: PlanResult = {
  summary: {
    requested_items: 2,
    placed_items: 2,
    unplaced_items: 0,
    grid_step_m: 2.5,
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

function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

/** Anonymous planner: the compatibility API answers and `/api/v1` reports no session. */
function stubInitialApi() {
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/v1/auth/me")) {
      return jsonResponse({ error: { code: "permission_denied" } }, 403);
    }
    if (url.startsWith("/api/plants")) {
      return jsonResponse(plants);
    }
    if (url.startsWith("/api/health")) {
      return jsonResponse(health);
    }
    if (url.startsWith("/api/plan")) {
      return jsonResponse(result);
    }
    return jsonResponse(null, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("App routes", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads the home view and service status", async () => {
    const fetchMock = stubInitialApi();
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /Un jardín que se siente tuyo/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Servicios activos")).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      "/api/plants",
      "/api/health",
      "/api/plan",
      "/api/v1/auth/me",
    ]);
  });

  it("keeps the plan editable without a session and offers to sign in", async () => {
    stubInitialApi();
    window.history.pushState({}, "", "/plan");
    render(<App />);

    expect(await screen.findByTestId("save-status")).toHaveTextContent("Sin sesión");
    expect(screen.getByTestId("save-login")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Plano editable del jardín" })).toBeInTheDocument();
  });

  it.each([
    ["/proyecto", "Cuéntanos cómo es el espacio."],
    ["/plantas", "Elige lo que te gustaría ver crecer."],
    ["/plan", "Plano editable del jardín"],
  ])("renders %s as an independent view", async (path, heading) => {
    stubInitialApi();
    window.history.pushState({}, "", path);
    render(<App />);

    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(await screen.findByText("Servicios activos")).toBeInTheDocument();
  });
});
