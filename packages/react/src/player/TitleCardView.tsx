import type { CSSProperties } from "react";
import type { StepCard } from "@scenar/core";
import { SHELL_HEIGHT_DEFAULT } from "../shells/tokens.js";

/**
 * The engine's built-in title-card renderer: the full-frame content of a
 * synthesized intro/outro card step. ScenarioPlayer renders it instead of
 * calling the scenario's render function when the active step carries a
 * `card` marker — cards need no view, no props, and no registry entry.
 *
 * Internal to the player (not exported from the package barrel): the
 * public API is the scenario-level `titleCards` config — the card's
 * layout and typography are engine-owned, like the control bar's.
 *
 * It behaves exactly like a shell in the content box: sized by the
 * inherited `--scenar-shell-height` (shell fallback otherwise), rendered
 * inside the camera so viewport zoom scales it, captured 1:1 in export.
 * Styling is fully inline with per-token fallbacks — the ScenarioStage
 * pattern — so the card renders correctly on every surface, including
 * ones that load no stylesheet (the auto-generated Remotion entry).
 * The backdrop fallback is the mesh's diagonal base only; under `.scenar`
 * the full `--scenar-backdrop` token resolves and wins.
 */
export function TitleCardView({ card }: { card: StepCard }) {
  const frameStyle: CSSProperties = {
    boxSizing: "border-box",
    height: `var(--scenar-shell-height, ${SHELL_HEIGHT_DEFAULT}px)`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    overflow: "hidden",
    padding: "32px 48px",
    textAlign: "center",
    borderRadius: "8px",
    border: "1px solid var(--scenar-border, #e5e7eb)",
    background:
      "var(--scenar-backdrop, linear-gradient(135deg, #e4ecf7 0%, #e6e1f0 100%))",
  };

  return (
    <div style={frameStyle} data-scenar-card={card.kind}>
      {card.logoSrc && (
        // Decorative next to the title text, which carries the meaning.
        <img
          src={card.logoSrc}
          alt=""
          style={{ height: "56px", width: "auto", objectFit: "contain" }}
        />
      )}
      <div
        style={{
          fontSize: "40px",
          fontWeight: 600,
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          color: "var(--scenar-foreground, #0f172a)",
        }}
      >
        {card.title}
      </div>
      {card.subtitle && (
        <div
          style={{
            fontSize: "18px",
            lineHeight: 1.4,
            color: "var(--scenar-muted-foreground, #64748b)",
          }}
        >
          {card.subtitle}
        </div>
      )}
      {card.ctaText && (
        // Display-only pill (never a link): the player's content surface
        // owns clicks for play/pause. Primary-on-surface inverts cleanly
        // in dark mode because both tokens flip together.
        <div
          style={{
            marginTop: "8px",
            padding: "10px 24px",
            borderRadius: "9999px",
            fontSize: "15px",
            fontWeight: 500,
            background: "var(--scenar-primary, #0f172a)",
            color: "var(--scenar-surface, #ffffff)",
          }}
        >
          {card.ctaText}
        </div>
      )}
    </div>
  );
}
