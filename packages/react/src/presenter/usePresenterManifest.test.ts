import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PresenterManifest } from "@scenar/core";
import {
  resolvePresenterManifestUrls,
  usePresenterManifest,
} from "./usePresenterManifest.js";

const MANIFEST: PresenterManifest = {
  steps: [{ src: "./step-0.mp4", durationMs: 4_000 }, null],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MANIFEST),
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("usePresenterManifest", () => {
  it("fetches from the presenter/ convention and resolves clip srcs against it", async () => {
    const { result } = renderHook(() => usePresenterManifest("welcome-tour"));

    await waitFor(() => expect(result.current).toBeDefined());

    expect(fetch).toHaveBeenCalledWith("/demos/welcome-tour/presenter/manifest.json");
    // "./step-0.mp4" resolved against the manifest's own location.
    expect(result.current!.steps[0]!.src).toBe(
      "http://localhost:3000/demos/welcome-tour/presenter/step-0.mp4",
    );
    expect(result.current!.steps[1]).toBeNull();
  });

  it("stays undefined when no manifest exists (scenario plays without a presenter)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const { result } = renderHook(() => usePresenterManifest("welcome-tour"));

    // Give the fetch promise chain a tick to settle.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current).toBeUndefined();
  });

  it("honors a custom manifest URL resolver", async () => {
    const resolver = (id: string) => `/assets/${id}/presenter.json`;
    const { result } = renderHook(() => usePresenterManifest("tour", resolver));

    await waitFor(() => expect(result.current).toBeDefined());
    expect(fetch).toHaveBeenCalledWith("/assets/tour/presenter.json");
  });
});

describe("resolvePresenterManifestUrls", () => {
  it("passes absolute srcs through unchanged", () => {
    const manifest: PresenterManifest = {
      steps: [{ src: "https://cdn.example.com/clip.mp4", durationMs: 1_000 }],
    };
    const resolved = resolvePresenterManifestUrls(manifest, "/demos/x/presenter/manifest.json");
    expect(resolved.steps[0]!.src).toBe("https://cdn.example.com/clip.mp4");
  });
});
