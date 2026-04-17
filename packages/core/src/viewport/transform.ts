/** Viewport transform state produced by step interactions. */
export interface ViewportTransform {
  scale: number;
  x: number;
  y: number;
}

/** The identity transform — no zoom, no translation. */
export const VIEWPORT_TRANSFORM_IDENTITY: Readonly<ViewportTransform> = {
  scale: 1,
  x: 0,
  y: 0,
};
