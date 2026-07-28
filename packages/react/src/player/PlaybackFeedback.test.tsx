import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { PlaybackBurst, ScenarioAudioNotice } from "./PlaybackFeedback.js";

afterEach(cleanup);

describe("PlaybackBurst", () => {
  it("is decorative: hidden from the a11y tree and inert to the pointer", () => {
    const { container } = render(<PlaybackBurst kind="play" />);
    const burst = container.querySelector('[data-playback-burst="play"]')!;
    expect(burst).not.toBeNull();
    expect(burst.getAttribute("aria-hidden")).not.toBeNull();
    expect(burst.className).toContain("pointer-events-none");
  });

  it("layers between content overlays and the control bar", () => {
    // z-[15]: above content and any overlay (z-10), below the control bar
    // (z-20) — the fading glyph must never obscure the transport.
    const { container } = render(<PlaybackBurst kind="pause" />);
    const burst = container.querySelector('[data-playback-burst="pause"]')!;
    expect(burst.className).toContain("z-[15]");
  });
});

describe("ScenarioAudioNotice", () => {
  it("offers a gesture-based audio retry", () => {
    const onEnableAudio = vi.fn();
    const { container } = render(<ScenarioAudioNotice onEnableAudio={onEnableAudio} />);
    const button = within(container).getByRole("button", { name: /enable audio/i });

    fireEvent.click(button);
    expect(onEnableAudio).toHaveBeenCalledTimes(1);
  });
});
