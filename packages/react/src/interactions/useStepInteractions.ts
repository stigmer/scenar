import { useMemo } from "react";
import type { UseStepInteractionsOptions } from "@scenar/core";
import { useTimeSource } from "../time/TimeSource.js";
import { useVideoExport } from "../video/VideoExportContext.js";
import type { InteractionContext } from "./context.js";
import { useBrowserStepInteractions } from "./useBrowserStepInteractions.js";
import { useTimeSourceStepInteractions } from "./useTimeSourceStepInteractions.js";

/**
 * Schedule timed mid-step interactions (scroll, cursor movement,
 * click dispatch, text input, hover reveal, drag-and-drop, viewport
 * transitions) synced to narration duration.
 *
 * Automatically picks the browser setTimeout-driven path or the
 * Remotion frame-driven path based on the presence of a TimeSource
 * context.
 */
export function useStepInteractions<T>(options: UseStepInteractionsOptions<T>): void {
  const timeSource = useTimeSource();
  const { isVideoExport } = useVideoExport();

  const ctx: InteractionContext = useMemo(
    () => ({
      containerRef: options.containerRef,
      setCursorTarget: options.setCursorTarget,
      setShowRipple: options.setShowRipple,
      setDragging: options.setDragging,
      setViewportTransform: options.setViewportTransform,
      isVideoExport,
    }),
    [
      options.containerRef,
      options.setCursorTarget,
      options.setShowRipple,
      options.setDragging,
      options.setViewportTransform,
      isVideoExport,
    ],
  );

  if (timeSource) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useTimeSourceStepInteractions(options, ctx, timeSource);
  } else {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useBrowserStepInteractions(options, ctx);
  }
}
