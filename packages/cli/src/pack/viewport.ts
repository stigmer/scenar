/**
 * Canonical embed dimensions, mirroring `ai.scenar.scenario.v1.ViewportConfig`:
 * `width` is the canonical render width and `height` the shell/container height
 * (the CLI's `--shell-height`). The engine renders at these fixed dimensions and
 * CSS-zooms to fit the container, so they also define the embed's intrinsic
 * aspect ratio.
 *
 * The proto owns the *concept and vocabulary*; in the code-authored CLI path
 * there is no `ViewportConfig` instance to read, so `pack` resolves the
 * dimensions (flags or these defaults), bakes them into the bundle via
 * `DemoViewport`, and records them in `scenario.json` so `deploy` can derive a
 * correctly-proportioned embed snippet without re-deriving them (DD-004). This
 * one module is the single home for the defaults, consumed by both the bake
 * (`pack`) and the fallback (`deploy`) so they cannot drift.
 */
export interface Viewport {
  /** Canonical render width in px (ViewportConfig.width). */
  readonly width: number;
  /** Shell/container height in px (ViewportConfig.height; CLI `--shell-height`). */
  readonly height: number;
}

/**
 * Pack-time defaults. The width matches `DemoViewport`'s default canonical
 * width (896); the height is the CLI's own default — `DemoViewport` has no
 * height default of its own, and the baked `--scenar-shell-height` variable
 * overrides every per-shell fallback in `@scenar/react`'s `shells/tokens.ts`
 * (380/420/460/500), so this number is what framed shells actually render at.
 */
export const DEFAULT_VIEWPORT: Viewport = { width: 896, height: 480 };

/**
 * Narrow unknown JSON into a {@link Viewport}, or null if it is missing or
 * malformed (non-object, non-positive, or non-finite dimensions). Lets `deploy`
 * accept a recorded viewport while falling back cleanly for older bundles.
 */
export function parseViewport(value: unknown): Viewport | null {
  if (typeof value !== "object" || value === null) return null;
  const { width, height } = value as Record<string, unknown>;
  if (!isPositiveInt(width) || !isPositiveInt(height)) return null;
  return { width, height };
}

/** A resolved pack viewport plus where each number came from (for the log). */
export interface ResolvedPackViewport extends Viewport {
  readonly source: "explicit" | "authored" | "default";
}

/**
 * Resolve the canonical viewport a bundle is packed at: explicit options
 * (CLI flags / MCP params) > the scenario's own authored viewport > the
 * packer default. Width and height resolve as a pair — an explicit *partial*
 * override (only `--width`) still counts as explicit, filling the other axis
 * from the authored viewport when present, else the default — and the
 * source names the strongest contributor so the pack log can explain a
 * surprising size in one line.
 */
export function resolvePackViewport(
  options: { readonly width?: number; readonly shellHeight?: number },
  authored: Viewport | null,
): ResolvedPackViewport {
  const width = options.width ?? authored?.width ?? DEFAULT_VIEWPORT.width;
  const height = options.shellHeight ?? authored?.height ?? DEFAULT_VIEWPORT.height;
  const source =
    options.width !== undefined || options.shellHeight !== undefined
      ? "explicit"
      : authored
        ? "authored"
        : "default";
  return { width, height, source };
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
