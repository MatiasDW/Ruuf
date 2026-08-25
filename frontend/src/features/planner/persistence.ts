import { ApiError } from "./api";
import type {
  GeneratedPlan,
  LayoutRevision,
  LayoutSummary,
  Paginated,
  PlanPayload,
  PlanResult,
  Placement,
  PlannerForm,
  Plant,
  ProjectSummary,
  RevisionItem,
  RevisionItemInput,
  SessionUser,
  SiteVersionDetail,
} from "./types";

const API_V1 = "/api/v1";
const COORDINATE_DECIMALS = 3;

/** Django rejects more decimals than the model declares, so drag noise is trimmed here. */
function roundMeters(value: number): number {
  const factor = 10 ** COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor;
}

export class PersistenceError extends ApiError {
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(`Request failed with status ${status}.`, status);
    this.name = "PersistenceError";
    this.payload = payload;
  }
}

export class RevisionConflictError extends Error {
  readonly currentRevision: number;

  constructor(currentRevision: number) {
    super("The layout has a newer revision.");
    this.name = "RevisionConflictError";
    this.currentRevision = currentRevision;
  }
}

let cachedCsrfToken: string | null = null;

export function resetCsrfToken(): void {
  cachedCsrfToken = null;
}

export async function fetchCsrfToken(refresh = false): Promise<string> {
  if (cachedCsrfToken && !refresh) {
    return cachedCsrfToken;
  }
  const response = await fetch(`${API_V1}/auth/csrf`, { credentials: "same-origin" });
  if (!response.ok) {
    throw new PersistenceError(response.status, null);
  }
  const data = (await response.json()) as { csrf_token: string };
  cachedCsrfToken = data.csrf_token;
  return data.csrf_token;
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_V1}${path}`, { credentials: "same-origin", signal });
  if (!response.ok) {
    throw new PersistenceError(response.status, await readBody(response));
  }
  return (await response.json()) as T;
}

function sendJson(path: string, body: unknown, token: string, signal?: AbortSignal) {
  return fetch(`${API_V1}${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": token,
    },
    body: JSON.stringify(body),
    signal,
  });
}

interface PostOptions {
  signal?: AbortSignal;
  /** Django rotates the CSRF token on login, so a stale token is retried once. */
  retryOnForbidden?: boolean;
}

async function postJson<T>(path: string, body: unknown, options: PostOptions = {}): Promise<T> {
  const { signal, retryOnForbidden = true } = options;
  let response = await sendJson(path, body, await fetchCsrfToken(), signal);
  if (response.status === 403 && retryOnForbidden) {
    response = await sendJson(path, body, await fetchCsrfToken(true), signal);
  }
  if (!response.ok) {
    throw new PersistenceError(response.status, await readBody(response));
  }
  return (await response.json()) as T;
}

export async function fetchSession(signal?: AbortSignal): Promise<SessionUser | null> {
  const response = await fetch(`${API_V1}/auth/me`, { credentials: "same-origin", signal });
  if (response.status === 401 || response.status === 403) {
    return null;
  }
  if (!response.ok) {
    throw new PersistenceError(response.status, await readBody(response));
  }
  return (await response.json()) as SessionUser;
}

export async function login(
  email: string,
  password: string,
  signal?: AbortSignal,
): Promise<SessionUser> {
  const user = await postJson<SessionUser>(
    "/auth/login",
    { email, password },
    { signal, retryOnForbidden: false },
  );
  await fetchCsrfToken(true);
  return user;
}

export async function fetchDemoProject(signal?: AbortSignal): Promise<ProjectSummary | null> {
  const page = await getJson<Paginated<ProjectSummary>>("/projects/", signal);
  return page.results.at(0) ?? null;
}

/** `/api/v1/layouts/` ignores query filters, so the project match happens here. */
export function selectProjectLayout(
  layouts: LayoutSummary[],
  projectId: string,
): LayoutSummary | null {
  return (
    [...layouts]
      .filter((layout) => layout.project === projectId)
      .sort((first, second) => second.updated_at.localeCompare(first.updated_at))
      .at(0) ?? null
  );
}

export async function fetchProjectLayout(
  projectId: string,
  signal?: AbortSignal,
): Promise<LayoutSummary | null> {
  const page = await getJson<Paginated<LayoutSummary>>("/layouts/", signal);
  return selectProjectLayout(page.results, projectId);
}

/** BE-102 returns the revisions of one layout, newest first. */
export async function fetchLatestRevision(
  layoutId: string,
  signal?: AbortSignal,
): Promise<LayoutRevision | null> {
  const page = await getJson<Paginated<LayoutRevision>>(`/layouts/${layoutId}/revisions/`, signal);
  return page.results.at(0) ?? null;
}

export function fetchSiteVersion(
  siteVersionId: string,
  signal?: AbortSignal,
): Promise<SiteVersionDetail> {
  return getJson<SiteVersionDetail>(`/site-versions/${siteVersionId}/`, signal);
}

export function generatePersistedPlan(
  projectId: string,
  payload: PlanPayload,
  signal?: AbortSignal,
): Promise<GeneratedPlan> {
  return postJson<GeneratedPlan>(`/projects/${projectId}/generate-plan/`, payload, { signal });
}

/** Django sends `current_revision` as a string inside the `409` envelope. */
export function conflictRevisionFrom(payload: unknown): number {
  const details = (payload as { error?: { details?: { current_revision?: unknown } } } | null)
    ?.error?.details;
  const revision = Number(details?.current_revision);
  return Number.isFinite(revision) ? revision : 0;
}

export async function saveRevision(
  layoutId: string,
  baseRevision: number,
  items: RevisionItemInput[],
  signal?: AbortSignal,
): Promise<LayoutRevision> {
  try {
    return await postJson<LayoutRevision>(
      `/layouts/${layoutId}/revisions/`,
      { base_revision: baseRevision, items },
      { signal },
    );
  } catch (error) {
    if (error instanceof PersistenceError && error.status === 409) {
      throw new RevisionConflictError(conflictRevisionFrom(error.payload));
    }
    throw error;
  }
}

export function toRevisionItems(placements: Placement[]): RevisionItemInput[] {
  return placements.map((placement) => ({
    ...(placement.stable_id ? { stable_id: placement.stable_id } : {}),
    plant_id: placement.plant_id,
    x_m: roundMeters(placement.x),
    y_m: roundMeters(placement.y),
  }));
}

/** Saved items only carry catalog references, so display data comes from `/api/plants`. */
export function placementsFromRevision(revision: LayoutRevision, plants: Plant[]): Placement[] {
  const catalog = new Map(plants.map((plant) => [plant.id, plant]));
  return revision.items.map((item) => {
    const plant = catalog.get(item.plant_id);
    return {
      stable_id: item.stable_id,
      plant_id: item.plant_id,
      name: item.name || plant?.name || item.plant_id,
      x: Number(item.x_m),
      y: Number(item.y_m),
      clearance_radius_m: Number(item.clearance_radius_m),
      structure_clearance_m: plant?.structure_clearance_m ?? 0,
      water_need: plant?.water_need ?? "low",
      liters_per_week: plant?.liters_per_week ?? 0,
      color: item.color || plant?.color || "#7ea16b",
    };
  });
}

/** Rebuilds the plan the editor renders from the revision Django stored. */
export function planResultFromRevision(revision: LayoutRevision, plants: Plant[]): PlanResult {
  const catalog = new Map(plants.map((plant) => [plant.id, plant]));
  const placements = placementsFromRevision(revision, plants);
  const summary = revision.result_summary ?? {};
  const unplaced = revision.validation_issues
    .filter((issue) => issue.code === "plant_not_placed")
    .map((issue) => ({
      name: catalog.get(issue.data?.plant_id ?? "")?.name ?? issue.data?.plant_id ?? "",
      reason: issue.message,
      suggestions: issue.data?.suggestions ?? [],
    }));
  const irrigation = revision.irrigation_estimates.at(0);

  return {
    summary: {
      requested_items: summary.requested_items ?? placements.length + unplaced.length,
      placed_items: summary.placed_items ?? placements.length,
      unplaced_items: summary.unplaced_items ?? unplaced.length,
      grid_step_m: summary.grid_step_m ?? 0,
      fits: summary.fits ?? unplaced.length === 0,
    },
    placements,
    unplaced,
    irrigation: {
      weekly_liters: Number(irrigation?.weekly_liters ?? 0),
      monthly_m3: Number(irrigation?.monthly_cubic_meters ?? 0),
      monthly_variable_cost_clp: Number(irrigation?.incremental_cost_clp ?? 0),
      monthly_total_cost_clp: Number(irrigation?.projected_bill_cost_clp ?? 0),
    },
  };
}

/** Keeps the on-screen order while adopting the identities Django just assigned. */
export function attachStableIds(placements: Placement[], items: RevisionItem[]): Placement[] {
  const pending = [...items];
  return placements.map((placement) => {
    const index = pending.findIndex(
      (item) =>
        item.plant_id === placement.plant_id &&
        Math.abs(Number(item.x_m) - placement.x) < 0.005 &&
        Math.abs(Number(item.y_m) - placement.y) < 0.005,
    );
    if (index < 0) {
      return placement;
    }
    const [item] = pending.splice(index, 1);
    return { ...placement, stable_id: item?.stable_id };
  });
}

export function formFromSiteVersion(form: PlannerForm, site: SiteVersionDetail): PlannerForm {
  const house = site.features.find((feature) => feature.feature_type === "house");
  const geometry = house?.geometry;
  return {
    ...form,
    yard_width: Number(site.width_m),
    yard_height: Number(site.height_m),
    sunlight: site.sunlight,
    style: site.preferred_style,
    ...(geometry?.type === "rectangle"
      ? {
          obstacle_x: geometry.x,
          obstacle_y: geometry.y,
          obstacle_width: geometry.width,
          obstacle_height: geometry.height,
        }
      : {}),
  };
}
