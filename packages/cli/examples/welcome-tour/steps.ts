import type { ScenarioStep, Soundtrack, TitleCards } from "@scenar/core";

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
    // A timed click on the sign-in button (the LoginCardPage's
    // `submitTargetId`). With `soundtrack.sfx` enabled below, the engine
    // plays its click sound at the exact dispatch moment — SFX placement
    // is derived from interactions, never authored.
    interactions: [
      { atPercent: 0.15, type: "set_cursor", target: "sign-in" },
      { atPercent: 0.65, type: "click", target: "sign-in" },
    ],
  },
  {
    delayMs: 2400,
    data: { url: "app.acme.cloud/home", screen: "dashboard" },
    narration: "The dashboard shows your deployments and activity at a glance.",
    // `presenter: true` marks this step for the presenter track: `scenar
    // presenter` generates an avatar clip lip-synced to the step's
    // narration audio (requires narration + a HeyGen key; the command
    // prints its cost estimate and asks before spending), and both
    // outputs show it picture-in-picture while the step is active.
    presenter: true,
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
    presenter: true,
  },
];

/**
 * The tour's audio treatment: a soft synthesized loop (see the provenance
 * note in @scenar/react's scripts/generate-sfx.mjs — this asset is
 * synthesized the same way, so no third-party licensing applies) that
 * ducks under the narration, plus the engine's built-in click/keystroke
 * sound effects. Both play in the packed embed (muteable via the player's
 * audio control) and in `scenar render` output — same source, same result.
 */
export const soundtrack: Soundtrack = {
  musicSrc: "./soundtrack/music.mp3",
  sfx: true,
};

/**
 * Intro/outro title cards framing the tour. Cards are synthesized steps:
 * the engine injects them into the timeline (chapters, scrubbing, video
 * duration, and the music envelope all account for them) and renders them
 * with its built-in card component — no view, no props, no registry
 * entry. The logo ships through the same deploy-allowlist image path the
 * dashboard logo exercises.
 */
export const titleCards: TitleCards = {
  intro: {
    title: "Acme Cloud",
    subtitle: "Your workspace, in one tour",
    logoSrc: "./logo.png",
  },
  outro: {
    title: "Start shipping today",
    ctaText: "acme.cloud/start",
    logoSrc: "./logo.png",
    durationMs: 4000,
  },
};
