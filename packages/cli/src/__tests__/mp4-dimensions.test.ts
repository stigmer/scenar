import { describe, expect, it } from "vitest";
import { probeMp4Dimensions } from "../presenter/mp4-dimensions.js";
import { box, largesizeBox, mp4File, trak, videoMp4 } from "./synth-mp4.js";

describe("probeMp4Dimensions", () => {
  it("reads the video track's dimensions past a 0x0 audio track", () => {
    expect(probeMp4Dimensions(videoMp4(788, 720))).toEqual({ width: 788, height: 720 });
    expect(probeMp4Dimensions(videoMp4(1280, 720))).toEqual({ width: 1280, height: 720 });
  });

  it("parses a moov that precedes mdat (faststart layout)", () => {
    const bytes = mp4File(
      box("ftyp", new Uint8Array(8)),
      box("moov", trak(640, 480)),
      box("mdat", new Uint8Array(16)),
    );
    expect(probeMp4Dimensions(bytes)).toEqual({ width: 640, height: 480 });
  });

  it("parses a 64-bit largesize moov", () => {
    const bytes = mp4File(
      box("ftyp", new Uint8Array(8)),
      largesizeBox("moov", trak(788, 720)),
    );
    expect(probeMp4Dimensions(bytes)).toEqual({ width: 788, height: 720 });
  });

  it("returns undefined when no moov exists", () => {
    const bytes = mp4File(box("ftyp", new Uint8Array(8)), box("mdat", new Uint8Array(16)));
    expect(probeMp4Dimensions(bytes)).toBeUndefined();
  });

  it("returns undefined for non-MP4 bytes", () => {
    expect(probeMp4Dimensions(new TextEncoder().encode("fake-mp4-bytes"))).toBeUndefined();
    expect(probeMp4Dimensions(new Uint8Array(0))).toBeUndefined();
  });

  it("returns undefined for a truncated file", () => {
    const whole = videoMp4(788, 720);
    // Cut inside the moov payload: its declared size now overruns the
    // buffer, so the box is rejected rather than read out of bounds.
    expect(probeMp4Dimensions(whole.slice(0, whole.byteLength - 20))).toBeUndefined();
  });

  it("returns undefined when every track is dimensionless", () => {
    const bytes = mp4File(box("moov", trak(0, 0), trak(0, 0)));
    expect(probeMp4Dimensions(bytes)).toBeUndefined();
  });

  it("survives a box declaring a nonsense size", () => {
    const bytes = videoMp4(788, 720);
    // Corrupt the top-level ftyp size to 3 (< header size).
    new DataView(bytes.buffer).setUint32(0, 3);
    expect(probeMp4Dimensions(bytes)).toBeUndefined();
  });
});
