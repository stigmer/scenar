import { useEffect, useState } from "react";
import type { PresenterManifest } from "@scenar/core";

/**
 * Build the presenter manifest URL for a scenario.
 *
 * `scenar presenter` writes its output beside the narration output, in
 * the scenario's `presenter/` directory — hence the default convention
 * below. Consumers can override it by passing a custom
 * `resolveManifestUrl` function.
 */
function defaultResolveManifestUrl(scenarioId: string): string {
  return `/demos/${scenarioId}/presenter/manifest.json`;
}

/**
 * Rewrite each clip `src` to an absolute URL resolved against the
 * manifest's own location — the same convention narration manifests
 * use (see `resolveNarrationManifestUrls`): a manifest declares its
 * clip paths relative to itself (`./step-2.mp4`), which stays correct
 * however the manifest is served. Already-absolute `src` values pass
 * through unchanged.
 */
export function resolvePresenterManifestUrls(
  manifest: PresenterManifest,
  manifestUrl: string,
): PresenterManifest {
  const base = new URL(manifestUrl, document.baseURI).href;
  return {
    steps: manifest.steps.map((entry) =>
      entry ? { ...entry, src: new URL(entry.src, base).href } : null,
    ),
  };
}

/**
 * Fetch and return the presenter manifest for a scenario.
 *
 * Returns `undefined` until the manifest loads (or if presenter clips
 * have not been generated for this scenario). ScenarioPlayer treats
 * `undefined` as "no presenter" — the demo plays exactly as it would
 * without the feature: zero presenter DOM, zero fetched clip bytes.
 *
 * The URL convention is configurable via `resolveManifestUrl`. By
 * default it fetches from `/demos/{scenarioId}/presenter/manifest.json`.
 * Clip `src` values are resolved to absolute URLs against the
 * manifest's location (see {@link resolvePresenterManifestUrls}).
 *
 * Pass a stable `resolveManifestUrl` reference (module-level or
 * memoized) — an inline function changes identity every render and
 * would refetch in a loop.
 */
export function usePresenterManifest(
  scenarioId: string,
  resolveManifestUrl: (id: string) => string = defaultResolveManifestUrl,
): PresenterManifest | undefined {
  const [manifest, setManifest] = useState<PresenterManifest>();

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
        setManifest(resolvePresenterManifestUrls(data as PresenterManifest, url));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [scenarioId, resolveManifestUrl]);

  return manifest;
}
