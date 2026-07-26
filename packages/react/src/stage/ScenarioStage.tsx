import type { CSSProperties, ReactNode } from "react";

interface ScenarioStageProps {
  children: ReactNode;
  /** Horizontal backdrop inset around the window (px). */
  insetX?: number;
  /** Vertical backdrop inset around the window (px). */
  insetY?: number;
}

const DEFAULT_INSET_X = 48;
const DEFAULT_INSET_Y = 36;

/**
 * The stage: a backdrop the depicted window floats on, with a real window
 * shadow and rounded corners — what makes a scenario read as a screen
 * recording rather than an embedded widget.
 *
 * Wrap a step's rendered content in it (inside the camera, so a zoom scales
 * the whole recording, backdrop included). The stage consumes the inherited
 * `--scenar-shell-height` for its own height and re-declares it for the
 * window it frames, minus the insets, so shells inside size themselves
 * without knowing they are staged. All visuals flow through the stage
 * tokens (`--scenar-backdrop`, `--scenar-shadow-window`,
 * `--scenar-radius-window`), so hosts theme it by overriding tokens.
 *
 * Styling is fully inline: the component works identically for
 * `styles.css` hosts, `theme.css` hosts, and the packed-embed path, with
 * no stylesheet coupling.
 */
export function ScenarioStage({
  children,
  insetX = DEFAULT_INSET_X,
  insetY = DEFAULT_INSET_Y,
}: ScenarioStageProps) {
  // Two-step custom-property indirection: the outer div still sees the
  // inherited --scenar-shell-height, derives the window height from it, and
  // the inner div re-declares --scenar-shell-height from that derivation.
  // Referencing a property inside its own re-declaration would be a cycle;
  // the intermediate variable is what makes the hand-off legal CSS.
  const stageStyle: CSSProperties & Record<string, string> = {
    boxSizing: "border-box",
    height: "var(--scenar-shell-height, 100%)",
    padding: `${insetY}px ${insetX}px`,
    background: "var(--scenar-backdrop)",
    ["--scenar-stage-window-height"]: `calc(var(--scenar-shell-height, 100%) - ${
      2 * insetY
    }px)`,
  };
  const windowStyle: CSSProperties & Record<string, string> = {
    ["--scenar-shell-height"]: "var(--scenar-stage-window-height)",
    height: "var(--scenar-stage-window-height)",
    overflow: "hidden",
    borderRadius: "var(--scenar-radius-window)",
    boxShadow: "var(--scenar-shadow-window)",
  };

  return (
    <div style={stageStyle}>
      <div style={windowStyle}>{children}</div>
    </div>
  );
}
