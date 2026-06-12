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
 * Rewrite each clip `src` to an absolute URL resolved against the manifest's
 * own location.
 *
 * A manifest declares its clip paths relative to itself (e.g. `./step-0.mp3`),
 * which is the only stable convention across every way a manifest is served:
 * a packed embed under a nested path (`./narration/manifest.json`) and a docs
 * site under `/demos/{id}/manifest.json` resolve the same clip to different
 * absolute URLs. Resolving here — once, where the manifest URL is known —
 * frees the audio layer from guessing a base. Already-absolute `src` values
 * (http(s) or root-relative, as produced by `narrate --base-url`) pass through
 * unchanged, because `new URL(absolute, base)` returns the absolute input.
 */
export function resolveNarrationManifestUrls(
  manifest: NarrationManifest,
  manifestUrl: string,
): NarrationManifest {
  const base = new URL(manifestUrl, document.baseURI).href;
  return {
    steps: manifest.steps.map((entry) =>
      entry ? { ...entry, src: new URL(entry.src, base).href } : null,
    ),
  };
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
 * it fetches from `/demos/{scenarioId}/manifest.json`. Clip `src` values are
 * resolved to absolute URLs against the manifest's location (see
 * {@link resolveNarrationManifestUrls}).
 *
 * Pass a stable `resolveManifestUrl` reference (module-level or memoized) — an
 * inline function changes identity every render and would refetch in a loop.
 */
export function useNarrationManifest(
  scenarioId: string,
  resolveManifestUrl: (id: string) => string = defaultResolveManifestUrl,
): NarrationManifest | undefined {
  const [manifest, setManifest] = useState<NarrationManifest>();

  useEffect(() => {
    const url = resolveManifestUrl(scenarioId);
    let cancelled = false;
    fetch(url)
      .then((response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        setManifest(resolveNarrationManifestUrls(data as NarrationManifest, url));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [scenarioId, resolveManifestUrl]);

  return manifest;
}
