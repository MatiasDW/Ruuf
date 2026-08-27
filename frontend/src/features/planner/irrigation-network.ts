import { ApiError } from "./api";
import { fetchCsrfToken, PersistenceError } from "./persistence";
import type { IrrigationNetworkDesign } from "./types";

const API_V1 = "/api/v1";

export async function fetchIrrigationNetwork(
  layoutId: string,
  signal?: AbortSignal,
): Promise<IrrigationNetworkDesign | null> {
  const response = await fetch(`${API_V1}/layouts/${layoutId}/irrigation-network-design/`, {
    credentials: "same-origin",
    signal,
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new ApiError(`Failed to fetch irrigation network: ${response.status}`, response.status);
  }

  return (await response.json()) as IrrigationNetworkDesign;
}

export async function saveIrrigationNetwork(
  layoutId: string,
  design: Omit<IrrigationNetworkDesign, "id" | "layout">,
  signal?: AbortSignal,
): Promise<IrrigationNetworkDesign> {
  const token = await fetchCsrfToken();
  const payload: Record<string, unknown> = {
    water_source_x: Math.round(design.water_source_x * 1000) / 1000,
    water_source_y: Math.round(design.water_source_y * 1000) / 1000,
    main_pipe_route: design.main_pipe_route.map((p) => ({
      x: Math.round(p.x * 1000) / 1000,
      y: Math.round(p.y * 1000) / 1000,
    })),
    num_main_pipes: design.num_main_pipes,
  };

  if (design.water_source_type) {
    payload.water_source_type = design.water_source_type;
  }

  const response = await fetch(`${API_V1}/layouts/${layoutId}/irrigation-network-design/`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": token,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw new PersistenceError(
      response.status,
      await (async () => {
        try {
          return await response.json();
        } catch {
          return null;
        }
      })(),
    );
  }

  return (await response.json()) as IrrigationNetworkDesign;
}

const LOCAL_DRAFT_KEY = "ruuf.irrigation.draft";

/** Persistencia anónima: sin sesión el diseño vive en este navegador. */
export function saveLocalIrrigationDraft(design: IrrigationNetworkDesign): void {
  try {
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(design));
  } catch {
    // Modo privado o storage lleno: el diseño sigue vivo en memoria durante la sesión.
  }
}

export function loadLocalIrrigationDraft(): IrrigationNetworkDesign | null {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IrrigationNetworkDesign;
    if (
      typeof parsed.water_source_x !== "number" ||
      typeof parsed.water_source_y !== "number" ||
      !Array.isArray(parsed.main_pipe_route)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
