import { collectShotNames } from "@scenar/core";
import {
  type AuthoredSoundtrack,
  type AuthoredTitleCards,
  type AuthoredViewport,
  findAuthoredSoundtrack,
  findAuthoredTitleCards,
  findAuthoredViewport,
  findStepsArray,
} from "../util/load-ts.js";
import { loadViteToolkit, sharedViteConfig } from "./build.js";
import { stepsModuleSpecifier } from "./generate-embed-entry.js";

/**
 * The outcome of pack-time shot discovery.
 *
 * `recorded: true` is authoritative — `shots` is exactly what the packed
 * capture page will report (possibly empty, which lets `scenar shoot` skip
 * the browser entirely), and `authoredViewport` is the canonical viewport
 * the scenario authors for itself (null = it authors none). `recorded:
 * false` means the steps module could not be loaded under Node, so the
 * shots are unknown and scenario.json must omit the key: absent = "boot a
 * browser to find out".
 */
export type CollectedPackShots =
  | {
      readonly recorded: true;
      readonly shots: readonly string[];
      readonly authoredViewport: AuthoredViewport | null;
      /** The scenario's authored soundtrack (null = it authors none). */
      readonly authoredSoundtrack: AuthoredSoundtrack | null;
      /** The scenario's authored title cards (null = it authors none). */
      readonly authoredTitleCards: AuthoredTitleCards | null;
    }
  | { readonly recorded: false; readonly reason: string };

/**
 * Discover a scenario's declared shot names — and its authored canonical
 * viewport, if it declares one — at pack time, so the names can be recorded
 * in the bundle's scenario.json and the viewport can participate in the
 * packer's resolution (CLI flags > authored > default). One SSR load serves
 * both discoveries; the viewport costs nothing extra.
 *
 * The steps module is loaded through Vite's SSR pipeline using the exact
 * specifier the generated browser entry imports ({@link stepsModuleSpecifier})
 * and the same resolution config as the pack build ({@link sharedViteConfig}) —
 * so what pack records and what the bundle contains agree by construction.
 * This is runtime truth, not source-text approximation: a shot name built
 * from a constant is discovered just like a literal one.
 *
 * Failure semantics split by who is at fault:
 * - *Environmental* — the module fails to import under Node's SSR runtime
 *   (e.g. it touches `window` at import time). Returns `recorded: false`
 *   with the reason; the caller packs on without a `shots` record. Anything
 *   that packs today still packs.
 * - *Authoring* — the module imports but is broken: no `delayMs`-bearing
 *   steps array (the packed embed would throw the same error in the browser
 *   the moment it loads), or an invalid/duplicate shot name (the capture
 *   page would throw at shoot time). Throws, failing the pack — these
 *   bundles must not ship, and the error is most fixable right here.
 */
export async function collectPackShots(scenarioDir: string): Promise<CollectedPackShots> {
  const specifier = stepsModuleSpecifier(scenarioDir);

  const toolkit = await loadViteToolkit();
  const server = await toolkit.vite.createServer({
    ...sharedViteConfig(toolkit),
    root: scenarioDir,
    // A transform-only server: no HTTP listener, no HMR websocket, and no
    // dependency pre-bundling scan — ssrLoadModule is the only consumer.
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true },
  });

  let stepsModule: Record<string, unknown>;
  try {
    stepsModule = await server.ssrLoadModule(specifier);
  } catch (error) {
    return {
      recorded: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await server.close();
  }

  const steps = findStepsArray(stepsModule);
  if (steps === null) {
    throw new Error(
      `No steps array found in ${specifier} — expected an exported array whose ` +
        `first element has a delayMs property. The packed embed would throw this ` +
        `same error in the browser the moment it loads, so pack refuses to ship it.`,
    );
  }

  return {
    recorded: true,
    shots: collectShotNames(steps),
    authoredViewport: findAuthoredViewport(stepsModule),
    authoredSoundtrack: findAuthoredSoundtrack(stepsModule),
    authoredTitleCards: findAuthoredTitleCards(stepsModule),
  };
}
