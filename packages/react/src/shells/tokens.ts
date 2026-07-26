/**
 * Shell height fallbacks.
 *
 * These constants are the `var(--scenar-shell-height, <fallback>)` second
 * arguments in each shell's inline style. They apply ONLY when a host embeds
 * `@scenar/react` components directly without a `DemoViewport` that sets the
 * variable. In every packed embed (`scenar pack`), `DemoViewport` always
 * sets `--scenar-shell-height` to the scenario's viewport height (CLI
 * `--shell-height`, default in `@scenar/cli`'s `pack/viewport.ts`), which
 * overrides every per-shell fallback below — including MobileView's taller
 * one. Authors packing mobile scenarios should pass a `--shell-height` that
 * accommodates the device frame rather than relying on these numbers.
 */

/**
 * Fallback height (px) for standard shell containers (TerminalView,
 * CodeEditorView, ChatView, DashboardView, APIClientView).
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
 * Fallback height (px) for BrowserView shells.
 *
 * Taller than the standard shell because browser mockups display
 * centered cards (login, signup) that need visible top/bottom margins.
 */
export const BROWSER_SHELL_HEIGHT_DEFAULT = 420;

/**
 * Fallback height (px) for MobileView shells.
 *
 * Taller than the standard shell to accommodate the iPhone 15 Pro
 * aspect ratio (~393×852pt logical) within the shell container. Note:
 * a packed embed's `--shell-height` overrides this — pick a pack height
 * that fits the device frame, or the phone renders squashed.
 */
export const MOBILE_SHELL_HEIGHT_DEFAULT = 500;

/**
 * Fallback height (px) for SlideView shells.
 *
 * Taller than the standard shell to accommodate a 16:9 slide canvas
 * plus the optional speaker-notes panel below.
 */
export const SLIDE_SHELL_HEIGHT_DEFAULT = 460;
