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

/**
 * Default height (px) for MobileView shells.
 *
 * Taller than the standard shell to accommodate the iPhone 15 Pro
 * aspect ratio (~393×852pt logical) within the shell container.
 */
export const MOBILE_SHELL_HEIGHT_DEFAULT = 500;

/**
 * Default height (px) for SlideView shells.
 *
 * Taller than the standard shell to accommodate a 16:9 slide canvas
 * plus the optional speaker-notes panel below.
 */
export const SLIDE_SHELL_HEIGHT_DEFAULT = 460;
