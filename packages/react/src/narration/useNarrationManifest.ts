import { useEffect, useState } from "react";
import type { NarrationManifest } from "@scenar/core";

/**
 * Build the manifest URL for a scenario.
 *
 * Consumers can override the default convention by passing a custom
 * `resolveManifestUrl` function.
 */
function defaultResolveManifestUrl(scenarioId: string): string {
  return `/demos/${scenarioId}/manifest.json`;
}

/**
 * Fetch and return the narration manifest for a scenario.
 *
 * Returns `undefined` until the manifest loads (or if narration audio
 * has not been generated for this scenario). ScenarioPlayer treats
 * `undefined` as "no narration" — the demo runs silently with its
 * original visual timing.
 *
 * The URL convention is configurable via `resolveManifestUrl`. By default,
 * it fetches from `/demos/{scenarioId}/manifest.json`.
 */
export function useNarrationManifest(
  scenarioId: string,
  resolveManifestUrl: (id: string) => string = defaultResolveManifestUrl,
): NarrationManifest | undefined {
  const [manifest, setManifest] = useState<NarrationManifest>();

  useEffect(() => {
    const url = resolveManifestUrl(scenarioId);
    fetch(url)
      .then((response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (data) setManifest(data as NarrationManifest);
      })
      .catch(() => {});
  }, [scenarioId, resolveManifestUrl]);

  return manifest;
}
