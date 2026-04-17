/**
 * CSS class that activates the `--scenar-*` token scope.
 *
 * Wrap your scenario container with this class so that shell components
 * resolve their CSS custom properties. In dark mode, add both:
 *
 *     <div className={`${SCENAR_CLASS} dark`}>…</div>
 */
export const SCENAR_CLASS = "scenar" as const;
