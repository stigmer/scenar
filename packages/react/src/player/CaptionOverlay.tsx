/**
 * Burned-in-style caption overlay rendered by ScenarioPlayer when captions
 * are enabled: the active step's narration text in a scrim pill above the
 * control bar, following the subtitle convention of every mainstream video
 * player.
 *
 * Internal to the player (not exported from the package barrel): the public
 * caption API is the `captions` prop — whole-step caption logic is a single
 * expression on the active step, so a public component/hook would add
 * surface without adding capability. Widening later is additive and safe.
 *
 * Colors flow through `--scenar-caption-*` tokens. Like the control bar
 * (see ScenarioControls) and `--scenar-chrome`, the defaults are
 * deliberately theme-invariant: captions sit on arbitrary tour content, so
 * they follow the white-on-scrim video convention rather than the
 * light/dark palette of the content behind them. Hosts can still retheme
 * by overriding the tokens.
 *
 * Sizing has two variants because the overlay lives in two coordinate
 * spaces (the same reason the control bar portals to the chrome layer —
 * see ViewportChrome.tsx):
 *
 * - `"chrome"` — rendered in the viewport's unscaled chrome layer or in an
 *   unzoomed in-app player: sizes are true CSS pixels, so text-sm reads
 *   correctly at every embed size.
 * - `"canonical"` — rendered inline in the video-export path, where the
 *   content box is the canonical viewport (1920px by default) captured 1:1
 *   into video frames: sizes are canonical pixels, so the caption uses
 *   1080p subtitle type (24px).
 */
interface CaptionOverlayProps {
  /** The active step's narration text. */
  text: string;
  /**
   * Which coordinate space the overlay is rendered in — `"chrome"` for
   * native CSS pixels (chrome layer / in-app), `"canonical"` for the
   * video-export content box.
   */
  sizeVariant: "chrome" | "canonical";
  /**
   * Whether the control bar is currently shown. The caption lifts above
   * the bar while it is visible and settles toward the bottom edge when
   * it hides — the YouTube behavior viewers already know.
   */
  controlBarVisible: boolean;
}

export function CaptionOverlay({
  text,
  sizeVariant,
  controlBarVisible,
}: CaptionOverlayProps) {
  const canonical = sizeVariant === "canonical";
  return (
    <div
      // z-10: above the content, below the play/pause burst (z-[15]) and the
      // control bar (z-20) — the transport must never hide behind a caption.
      // pointer-events-none: a caption must not eat the content box's
      // click-to-toggle; there is nothing to click on it.
      className={`pointer-events-none absolute inset-x-0 z-10 flex justify-center px-4 transition-[bottom] duration-200 ${
        controlBarVisible
          ? canonical
            ? "bottom-28"
            : "bottom-16"
          : canonical
            ? "bottom-10"
            : "bottom-4"
      }`}
      data-scenar-captions=""
    >
      {/*
       * aria-live="polite": each step's caption is announced without
       * interrupting the screen reader mid-sentence. The region is the
       * stable wrapper (always mounted while captions are on) so live
       * announcements fire on text *changes*, per the ARIA contract.
       */}
      <span
        aria-live="polite"
        className={`max-w-[85%] rounded bg-[var(--scenar-caption-surface)] text-center leading-snug text-[var(--scenar-caption-foreground)] ${
          canonical ? "px-4 py-1.5 text-[24px]" : "px-2.5 py-1 text-xs"
        }`}
      >
        {text}
      </span>
    </div>
  );
}
