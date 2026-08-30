import { createContext, type ReactNode, useContext, useMemo } from "react";
import type { PresenterWindow } from "@scenar/core";

/**
 * Props handed to a {@link PresenterMediaRenderer}: everything the
 * export pipeline needs to place one presenter clip frame-exactly.
 */
export interface PresenterMediaProps {
  /** The clip URL, as written in the presenter manifest. */
  readonly src: string;
  /** The clip's timeline window (from `derivePresenterTimeline`). */
  readonly window: PresenterWindow;
}

/**
 * Renders the media element inside the presenter frame for the video
 * export time domain.
 *
 * The presenter frame (placement, chrome, fade) is owned by this
 * package and renders identically in both outputs, but the media
 * inside it differs per time domain: browser playback drives a plain
 * `<video>`; Remotion needs its frame-locked media component, which
 * this package cannot import (dependencies flow the other way). The
 * export pipeline injects its renderer downward through
 * {@link VideoExportProvider} instead — `@scenar/remotion` passes a
 * `Sequence`/`OffthreadVideo` renderer, and the frame fills its media
 * slot with it.
 */
export type PresenterMediaRenderer = (props: PresenterMediaProps) => ReactNode;

interface VideoExportSettings {
  /** Whether the component tree is rendering inside the video export pipeline. */
  isVideoExport: boolean;
  /** Hide interactive playback controls (prev/play/next/dots). */
  hideControls: boolean;
  /** Start with narration unmuted so step timing accounts for audio duration. */
  initialMuted: boolean;
  /**
   * Export-side renderer for presenter clip media (see
   * {@link PresenterMediaRenderer}). Absent in browser playback, where
   * the presenter frame drives its own `<video>` element.
   */
  presenterMedia?: PresenterMediaRenderer;
}

const defaults: VideoExportSettings = {
  isVideoExport: false,
  hideControls: false,
  initialMuted: true,
};

const VideoExportContext = createContext<VideoExportSettings>(defaults);

interface VideoExportProviderProps {
  children: ReactNode;
  /**
   * Frame-locked renderer for presenter clip media. Pass this when the
   * scenario has a presenter track; `@scenar/remotion`'s
   * `ScenarioComposition` supplies it automatically.
   */
  presenterMedia?: PresenterMediaRenderer;
}

/**
 * Wrap scenario components in this provider when rendering for video
 * capture. Sets unmuted timing and hides interactive controls so the
 * recorded output looks like a polished product walkthrough.
 */
export function VideoExportProvider({ children, presenterMedia }: VideoExportProviderProps) {
  const value = useMemo<VideoExportSettings>(
    () => ({
      isVideoExport: true,
      hideControls: true,
      initialMuted: false,
      presenterMedia,
    }),
    [presenterMedia],
  );
  return (
    <VideoExportContext.Provider value={value}>
      {children}
    </VideoExportContext.Provider>
  );
}

/** Read the video export settings from context. */
export function useVideoExport(): VideoExportSettings {
  return useContext(VideoExportContext);
}
