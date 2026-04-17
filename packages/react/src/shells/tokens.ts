/**
 * Default height (px) for shell containers (AppShell, TerminalView, CodeEditorView).
 *
 * Matches the docs-site canonical height. Overridden at runtime via the
 * `--scenar-shell-height` CSS variable (set by `DemoViewport`).
 */
export const SHELL_HEIGHT_DEFAULT = 380;

/**
 * Minimum shell height (px) for short viewports.
 *
 * Used as the floor in `clamp(SHELL_HEIGHT_MIN, 55vh, SHELL_HEIGHT_DEFAULT)`.
 * Prevents sidebar content from clipping on narrow/short screens.
 */
export const SHELL_HEIGHT_MIN = 320;

/**
 * Default height (px) for BrowserView shells.
 *
 * Taller than the standard shell because browser mockups display
 * centered cards (login, signup) that need visible top/bottom margins.
 */
export const BROWSER_SHELL_HEIGHT_DEFAULT = 420;
