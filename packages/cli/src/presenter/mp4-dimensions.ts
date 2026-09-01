/**
 * Probe an MP4's pixel dimensions from its bytes — no dependencies,
 * no spawned tools.
 *
 * This exists because HeyGen's video API reports no geometry (only
 * `status`/`video_url`) while clip aspect is avatar-dependent
 * (scenar#30): a stock studio avatar returns near-square 788x720, a
 * digital twin returns 16:9. The dimensions are written into the
 * presenter manifest so playback treats clip geometry as data.
 *
 * Deliberately presenter-domain code (beside `heygen-client.ts`), not
 * a shared util: narration's precedent is that media metadata comes
 * from the provider, and this parser exists solely to fill the gap
 * HeyGen leaves. Pure TS in the client's spirit ("native fetch, no
 * new runtime dependencies").
 *
 * Parsing strategy — the minimal honest subset of ISO BMFF (the MP4
 * box format): walk top-level boxes to `moov`, walk its children, and
 * read the presentation width/height from the first `trak` whose
 * `tkhd` carries nonzero dimensions (audio tracks carry 0x0). The
 * values are the trailing 8 bytes of `tkhd` as 16.16 fixed-point —
 * the same offset in both tkhd versions, so no version branching.
 *
 * Every failure path returns `undefined`: a probe miss must never
 * fail generation — the manifest entry is simply written without
 * dimensions and playback falls back to the fixed 16:9 frame.
 */

/** Probed pixel dimensions of an MP4 video track. */
export interface Mp4Dimensions {
  readonly width: number;
  readonly height: number;
}

/** Box header size: 32-bit size + 4-char type. */
const HEADER_SIZE = 8;

interface Box {
  readonly type: string;
  /** Absolute offset of the box's payload (after size/type/largesize). */
  readonly payloadStart: number;
  /** Absolute offset one past the box's last byte. */
  readonly end: number;
}

/**
 * Read the box at `offset`, or return null when the bytes there cannot
 * be a well-formed box that fits inside `limit`.
 */
function readBox(view: DataView, offset: number, limit: number): Box | null {
  if (offset + HEADER_SIZE > limit) return null;
  let size = view.getUint32(offset);
  let payloadStart = offset + HEADER_SIZE;
  if (size === 1) {
    // 64-bit largesize follows the type.
    if (offset + HEADER_SIZE + 8 > limit) return null;
    const large = view.getBigUint64(offset + HEADER_SIZE);
    if (large > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(large);
    payloadStart += 8;
  } else if (size === 0) {
    // "To end of enclosing container."
    size = limit - offset;
  }
  const end = offset + size;
  if (size < payloadStart - offset || end > limit) return null;
  const type = String.fromCharCode(
    view.getUint8(offset + 4),
    view.getUint8(offset + 5),
    view.getUint8(offset + 6),
    view.getUint8(offset + 7),
  );
  return { type, payloadStart, end };
}

/** Yield the child boxes spanning [start, limit). Stops at malformed bytes. */
function* childBoxes(view: DataView, start: number, limit: number): Generator<Box> {
  let offset = start;
  while (offset < limit) {
    const box = readBox(view, offset, limit);
    if (!box) return;
    yield box;
    offset = box.end;
  }
}

/**
 * Extract the video track's presentation dimensions from MP4 bytes.
 * Returns `undefined` when the bytes are not parseable MP4 or no track
 * carries nonzero dimensions.
 */
export function probeMp4Dimensions(bytes: Uint8Array): Mp4Dimensions | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const moov = [...childBoxes(view, 0, bytes.byteLength)].find((b) => b.type === "moov");
  if (!moov) return undefined;

  for (const trak of childBoxes(view, moov.payloadStart, moov.end)) {
    if (trak.type !== "trak") continue;
    const tkhd = [...childBoxes(view, trak.payloadStart, trak.end)].find(
      (b) => b.type === "tkhd",
    );
    // Width and height are the last 8 bytes of tkhd in both v0 and v1,
    // as 16.16 fixed-point. Integer pixel counts have zero fractions.
    if (!tkhd || tkhd.end - tkhd.payloadStart < 8) continue;
    const width = view.getUint32(tkhd.end - 8) / 0x10000;
    const height = view.getUint32(tkhd.end - 4) / 0x10000;
    if (width > 0 && height > 0) return { width, height };
  }
  return undefined;
}
