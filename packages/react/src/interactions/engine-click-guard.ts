/**
 * Distinguishes the engine's own click dispatches from viewer gestures.
 *
 * A `click` interaction fires a native `el.click()` on the target inside
 * the scenario content — which bubbles up through `ScenarioPlayer`'s
 * click-anywhere-to-toggle wrapper exactly like a viewer's click would,
 * pausing playback the moment the choreography clicks anything. The
 * platform's `event.isTrusted` can't be the discriminator here: test
 * environments dispatch untrusted events for real viewer intent.
 *
 * `el.click()` dispatches synchronously, so a call-stack flag is exact:
 * the player consults {@link isEngineClickInProgress} in its click
 * handler and ignores the engine's own events.
 */

let depth = 0;

/** Run `dispatch` (a native click dispatch) marked as engine-initiated. */
export function runEngineClick(dispatch: () => void): void {
  depth++;
  try {
    dispatch();
  } finally {
    depth--;
  }
}

/** True while an engine-initiated click dispatch is on the call stack. */
export function isEngineClickInProgress(): boolean {
  return depth > 0;
}
