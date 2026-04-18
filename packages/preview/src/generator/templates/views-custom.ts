/**
 * Render the initial `views.custom.tsx` template.
 * This file is created once and never overwritten by the scanner.
 */
export function renderViewsCustom(): string {
  return `// Custom views — add components that the scanner couldn't discover,
// or composite views you've built specifically for demos.
//
// This file is yours. \`scenar preview sync\` will never overwrite it.

// Example:
// import { AppShell } from "../src/components/shells/AppShell";

export const customViews = {
  // AppShell,
} as const;
`;
}
