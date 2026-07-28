import type { ShotBrowser, ShotCaptureInfo } from "./types.js";

/**
 * Chromium launch flags for byte-deterministic rasterization — every one
 * proven necessary by the 2026-07-28 determinism spike (without them,
 * ±1-LSB full-frame compositing jitter across sessions):
 *
 * - `--disable-gpu`: software rasterization, no GPU-dependent output.
 * - `--force-color-profile=srgb`: pins color conversion.
 * - `--disable-lcd-text`: subpixel AA depends on the (virtual) display.
 * - `--hide-scrollbars`: platform scrollbar chrome is not content.
 */
const DETERMINISM_LAUNCH_FLAGS = [
  "--disable-gpu",
  "--force-color-profile=srgb",
  "--disable-lcd-text",
  "--hide-scrollbars",
];

const PLAYWRIGHT_INSTALL_HINT =
  "Install it in your demos project: npm install -D playwright\n" +
  "Then install the browser binary: npx playwright install chromium";

/**
 * The real {@link ShotBrowser}: Playwright Chromium with the full spike
 * determinism recipe. Playwright is an optional peer dependency (the
 * remotion/echogarden pattern) — loaded lazily so every other command works
 * without it, and failing with install instructions when absent.
 */
export async function createPlaywrightShotBrowser(): Promise<ShotBrowser> {
  const playwright = await import("playwright").catch(() => {
    throw new Error(`Could not load playwright.\n${PLAYWRIGHT_INSTALL_HINT}`);
  });

  const browser = await playwright.chromium
    .launch({ args: DETERMINISM_LAUNCH_FLAGS })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Could not launch Chromium.\n${message}\n\n${PLAYWRIGHT_INSTALL_HINT}`,
      );
    });

  return {
    async newSession({ theme, viewport }) {
      // `reducedMotion: "reduce"` is safe under a TimeSource: step index
      // derives from time, not from the reduced-motion shortcut — and it
      // keeps framer-motion from animating on wall-clock time.
      // `colorScheme` emulation resolves the stage backdrop's light-dark()
      // colors; the `?theme=` param handles the scenar token class — both
      // halves are required for a correct dark variant (DD-02 D2).
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 2,
        reducedMotion: "reduce",
        colorScheme: theme,
      });
      const page = await context.newPage();
      let frameSelector = "";

      return {
        async open(url, timeoutMs) {
          await page.goto(url, { waitUntil: "networkidle" });
          await page.waitForFunction(
            () =>
              (window as { __scenarShot?: unknown }).__scenarShot !== undefined ||
              (window as { __scenarShotError?: unknown }).__scenarShotError !== undefined,
            undefined,
            { timeout: timeoutMs },
          );
          const result: { error: string | null } & ShotCaptureInfo = await page.evaluate(() => {
            const w = window as unknown as {
              __scenarShot?: { shots: ShotCaptureInfo["shots"]; frameSelector: string };
              __scenarShotError?: string;
            };
            if (w.__scenarShotError !== undefined) {
              return { error: String(w.__scenarShotError), shots: [], frameSelector: "" };
            }
            const driver = w.__scenarShot!;
            return { error: null, shots: driver.shots, frameSelector: driver.frameSelector };
          });
          if (result.error !== null) {
            throw new Error(`the capture page reported: ${result.error}`);
          }
          // Webfont rasterization differs from the fallback font — never
          // shoot before every declared font face has loaded.
          await page.evaluate(() => document.fonts.ready.then(() => undefined));
          frameSelector = result.frameSelector;
          return { shots: result.shots, frameSelector: result.frameSelector };
        },

        async walkTo(timeMs) {
          await page.evaluate(
            (ms) =>
              (
                window as unknown as {
                  __scenarShot: { walkTo: (t: number) => Promise<void> };
                }
              ).__scenarShot.walkTo(ms),
            timeMs,
          );
        },

        async screenshotFrame() {
          // `animations: "disabled"` is load-bearing: the shells crossfade
          // content on wall-clock CSS time, and this alone caused whole-pane
          // noise in the spike until disabled at screenshot time.
          return page.locator(frameSelector).screenshot({ animations: "disabled" });
        },

        async close() {
          await context.close();
        },
      };
    },

    async close() {
      await browser.close();
    },
  };
}
