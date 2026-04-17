import { describe, expect, it, vi } from "vitest";
import { register, notifyPlaying } from "./PlaybackCoordinator.js";

describe("PlaybackCoordinator", () => {
  it("pauses other players when one starts playing", () => {
    const pause1 = vi.fn();
    const pause2 = vi.fn();

    const p1 = register(pause1);
    const p2 = register(pause2);

    notifyPlaying(p1.id);
    expect(pause1).not.toHaveBeenCalled();
    expect(pause2).toHaveBeenCalledOnce();

    notifyPlaying(p2.id);
    expect(pause1).toHaveBeenCalledOnce();

    p1.unregister();
    p2.unregister();
  });

  it("unregistered players are not paused", () => {
    const pause1 = vi.fn();
    const pause2 = vi.fn();

    const p1 = register(pause1);
    const p2 = register(pause2);

    p1.unregister();
    notifyPlaying(p2.id);
    expect(pause1).not.toHaveBeenCalled();

    p2.unregister();
  });
});
