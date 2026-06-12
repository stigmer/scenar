import type { ScenarioStep } from "@scenar/core";

/**
 * The screen shown at a given step. Each maps to a CSS-drawn @scenar/react
 * page template in `index.tsx` — no images or fonts, so the packed bundle stays
 * within the deploy allowlist ({html, js, css, json, mp3}).
 */
export type TourScreen = "login" | "dashboard" | "projects" | "settings";

/** Data snapshot for one step of the welcome tour. */
export interface TourStepData {
  /** Address-bar URL shown in the browser chrome (no scheme). */
  readonly url: string;
  /** Which page the browser is showing at this step. */
  readonly screen: TourScreen;
}

/**
 * A minimal, fully playable scenario authored as a directory — the same shape
 * `scenar render` and `scenar preview` consume (steps.ts + an index.tsx that
 * exports `renderStep`). `scenar pack` bundles it into a hosted embed.
 *
 * `delayMs` is the dwell time before each step is revealed; the first step is
 * shown immediately (0). Captions render beneath the player.
 */
export const steps: ScenarioStep<TourStepData>[] = [
  {
    delayMs: 0,
    caption: "Sign in to Acme Cloud",
    data: { url: "app.acme.cloud/login", screen: "login" },
  },
  {
    delayMs: 2400,
    caption: "Land on your dashboard",
    data: { url: "app.acme.cloud/home", screen: "dashboard" },
  },
  {
    delayMs: 2600,
    caption: "Browse your projects",
    data: { url: "app.acme.cloud/projects", screen: "projects" },
  },
  {
    delayMs: 2600,
    caption: "Update your profile",
    data: { url: "app.acme.cloud/settings", screen: "settings" },
  },
];
