import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { ScenarioAudioNotice, ScenarioPoster } from "./ScenarioPoster.js";

afterEach(cleanup);

describe("ScenarioPoster", () => {
  it("labels the action generically without narration", () => {
    const onPlay = vi.fn();
    const { container } = render(<ScenarioPoster onPlay={onPlay} />);
    const button = within(container).getByRole("button", { name: "Play demo" });
    expect(button).toBeDefined();
    expect(within(container).queryByText("Play walkthrough with narration")).toBeNull();
  });

  it("names the audible payoff when narration is present", () => {
    const onPlay = vi.fn();
    const { container } = render(<ScenarioPoster onPlay={onPlay} hasNarration />);
    expect(
      within(container).getByRole("button", { name: "Play walkthrough with narration" }),
    ).toBeDefined();
    expect(within(container).getByText("Play walkthrough with narration")).toBeDefined();
  });

  it("is operable by click and keyboard (Enter / Space)", () => {
    const onPlay = vi.fn();
    const { container } = render(<ScenarioPoster onPlay={onPlay} hasNarration />);
    const button = within(container).getByRole("button");

    fireEvent.click(button);
    expect(onPlay).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(button, { key: "Enter" });
    expect(onPlay).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(button, { key: " " });
    expect(onPlay).toHaveBeenCalledTimes(3);
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
