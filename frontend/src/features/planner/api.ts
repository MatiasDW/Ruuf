import type { PlanPayload, PlanResult, Plant, SystemHealth } from "./types";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}.`, response.status);
  }
  return (await response.json()) as T;
}

export function fetchPlants(signal?: AbortSignal): Promise<Plant[]> {
  return fetchJson<Plant[]>("/api/plants", { signal });
}

export function fetchSystemHealth(signal?: AbortSignal): Promise<SystemHealth> {
  return fetchJson<SystemHealth>("/api/health", { signal });
}

export function createPlan(payload: PlanPayload, signal?: AbortSignal): Promise<PlanResult> {
  return fetchJson<PlanResult>("/api/plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });
}
