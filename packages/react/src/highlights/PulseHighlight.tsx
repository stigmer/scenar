"use client";

import { motion } from "framer-motion";

/**
 * Pulsing border overlay that draws the viewer's eye to an element.
 *
 * Place inside a `position: relative` parent and gate with a boolean:
 *
 *     {highlighted && <PulseHighlight />}
 *
 * Ring colour follows `--scenar-foreground` when inside a `.scenar`
 * scope, falling back to `currentColor` otherwise.
 */
export function PulseHighlight() {
  return (
    <motion.span
      className="absolute inset-0 rounded-md border"
      style={{ borderColor: "var(--scenar-foreground, currentColor)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.5, 0] }}
      transition={{
        duration: 1.2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      aria-hidden
    />
  );
}
