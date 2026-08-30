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
 * `scenar render` consumes (steps.ts + an index.tsx that exports `renderStep`).
 * `scenar pack` bundles it into a hosted embed.
 *
 * `delayMs` is the dwell time before each step is revealed; the first step is
 * shown immediately (0).
 */
export const steps: ScenarioStep<TourStepData>[] = [
  {
    delayMs: 0,
    data: { url: "app.acme.cloud/login", screen: "login" },
    // `narration` doubles as the TTS script (`scenar narrate`) and the
    // caption text when captions are enabled (`?captions=1` on the embed,
    // `--captions` on render).
    narration: "Welcome to Acme Cloud. Signing in takes you straight to your workspace.",
    // `shot` names this step's settled frame as a still-capture point:
    // `scenar shoot <bundle>` renders it to stills/login-screen.<theme>.png.
    // Steps without a shot are simply walked through.
    shot: "login-screen",
  },
  {
    delayMs: 2400,
    data: { url: "app.acme.cloud/home", screen: "dashboard" },
    narration: "The dashboard shows your deployments and activity at a glance.",
  },
  {
    delayMs: 2600,
    data: { url: "app.acme.cloud/projects", screen: "projects" },
    narration: "Every project lives here, with its environments one click away.",
  },
  {
    delayMs: 2600,
    data: { url: "app.acme.cloud/settings", screen: "settings" },
    narration: "And settings is where you manage keys, members, and billing.",
    shot: "settings-screen",
  },
];
