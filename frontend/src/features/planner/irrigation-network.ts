import { ApiError } from "./api";
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
  const response = await fetch(`${API_V1}/layouts/${layoutId}/irrigation-network-design/`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": token,
    },
    body: JSON.stringify({
      water_source_x: Math.round(design.water_source_x * 1000) / 1000,
      water_source_y: Math.round(design.water_source_y * 1000) / 1000,
      main_pipe_route: design.main_pipe_route.map((p) => ({
        x: Math.round(p.x * 1000) / 1000,
        y: Math.round(p.y * 1000) / 1000,
      })),
      num_main_pipes: design.num_main_pipes,
    }),
    signal,
  });

  if (!response.ok) {
    throw new ApiError(`Failed to save irrigation network: ${response.status}`, response.status);
  }

  return (await response.json()) as IrrigationNetworkDesign;
}

let cachedCsrfToken: string | null = null;

async function fetchCsrfToken(): Promise<string> {
  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }
  const response = await fetch(`${API_V1}/auth/csrf`, { credentials: "same-origin" });
  if (!response.ok) {
    throw new ApiError(`Failed to fetch CSRF token: ${response.status}`, response.status);
  }
  const data = (await response.json()) as { csrf_token: string };
  cachedCsrfToken = data.csrf_token;
  return cachedCsrfToken;
}

export function resetCsrfToken(): void {
  cachedCsrfToken = null;
}
