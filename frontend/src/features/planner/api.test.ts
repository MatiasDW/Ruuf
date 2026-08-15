import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPlants } from "./api";

describe("planner API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns typed JSON for a successful request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([{ id: "quillay", name: "Quillay" }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPlants()).resolves.toEqual([{ id: "quillay", name: "Quillay" }]);
    expect(fetchMock).toHaveBeenCalledWith("/api/plants", { signal: undefined });
  });

  it("raises an ApiError without exposing a response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }),
    );

    await expect(fetchPlants()).rejects.toEqual(
      expect.objectContaining({
        name: "ApiError",
        status: 503,
      }),
    );
  });
});
