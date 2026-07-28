import type { ScenarioShot } from "@scenar/core";

/** The two capture themes — every shot is rendered once per theme (DD-02 D2). */
export type ShotTheme = "light" | "dark";

/** What the capture page reports once its driver is ready. */
export interface ShotCaptureInfo {
  /** The bundle's declared shots, validated and in timeline order. */
  readonly shots: readonly ScenarioShot[];
  /** Selector for the element to screenshot (owned by the capture mount). */
  readonly frameSelector: string;
}

/**
 * One themed browser page driving a capture — the narrow seam between
 * run-shoot's orchestration (unit-tested against a fake) and Playwright
 * (exercised by the real end-to-end capture, not by unit tests).
 */
export interface ShotSession {
  /**
   * Navigate to the capture URL and wait for the page to report either a
   * ready driver or an error (`window.__scenarShot` / `__scenarShotError`).
   * Throws with the page's own message on a reported error or on timeout.
   */
  open(url: string, timeoutMs: number): Promise<ShotCaptureInfo>;
  /** Advance the page's TimeSource walk to `timeMs` (sequential, never back). */
  walkTo(timeMs: number): Promise<void>;
  /** Screenshot the capture frame, animations disabled. */
  screenshotFrame(): Promise<Buffer>;
  close(): Promise<void>;
}

/** A launched capture browser that can open themed sessions. */
export interface ShotBrowser {
  newSession(options: {
    theme: ShotTheme;
    viewport: { width: number; height: number };
  }): Promise<ShotSession>;
  close(): Promise<void>;
}
