/**
 * Synthesize minimal-but-structurally-honest MP4 bytes for tests of
 * the presenter's dimension probe (`presenter/mp4-dimensions.ts`).
 *
 * Emits real ISO-BMFF boxes — sized headers, a version 0 `tkhd` with
 * its full 84-byte payload, an audio-style 0x0 track ahead of the
 * video track (HeyGen files carry both) — so the probe's box walk is
 * exercised on the same shapes a genuine muxer produces, without
 * checking a binary fixture into the repo.
 */

/** Encode one box: 32-bit size + 4-char type + payload. */
export function box(type: string, ...payloads: Uint8Array[]): Uint8Array {
  const payloadLength = payloads.reduce((sum, p) => sum + p.byteLength, 0);
  const bytes = new Uint8Array(8 + payloadLength);
  new DataView(bytes.buffer).setUint32(0, bytes.byteLength);
  bytes.set(new TextEncoder().encode(type), 4);
  let offset = 8;
  for (const payload of payloads) {
    bytes.set(payload, offset);
    offset += payload.byteLength;
  }
  return bytes;
}

/** Encode one box using the 64-bit `largesize` form (size field = 1). */
export function largesizeBox(type: string, ...payloads: Uint8Array[]): Uint8Array {
  const payloadLength = payloads.reduce((sum, p) => sum + p.byteLength, 0);
  const bytes = new Uint8Array(16 + payloadLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 1);
  bytes.set(new TextEncoder().encode(type), 4);
  view.setBigUint64(8, BigInt(bytes.byteLength));
  let offset = 16;
  for (const payload of payloads) {
    bytes.set(payload, offset);
    offset += payload.byteLength;
  }
  return bytes;
}

/**
 * A version 0 `tkhd` box: 84-byte payload with the presentation
 * width/height as 16.16 fixed-point in the trailing 8 bytes. All
 * other fields are zero — the probe never reads them.
 */
export function tkhd(width: number, height: number): Uint8Array {
  const payload = new Uint8Array(84);
  const view = new DataView(payload.buffer);
  view.setUint32(76, Math.round(width * 0x10000));
  view.setUint32(80, Math.round(height * 0x10000));
  return box("tkhd", payload);
}

/** A `trak` box holding one `tkhd`. 0x0 dimensions model an audio track. */
export function trak(width: number, height: number): Uint8Array {
  return box("trak", tkhd(width, height));
}

/** Concatenate top-level boxes into one file buffer. */
export function mp4File(...boxes: Uint8Array[]): Uint8Array {
  const total = boxes.reduce((sum, b) => sum + b.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const b of boxes) {
    bytes.set(b, offset);
    offset += b.byteLength;
  }
  return bytes;
}

/**
 * A complete synthetic HeyGen-shaped file: ftyp, mdat, then moov with
 * an audio track ahead of the video track carrying `width`x`height`.
 */
export function videoMp4(width: number, height: number): Uint8Array {
  return mp4File(
    box("ftyp", new Uint8Array(8)),
    box("mdat", new Uint8Array(16)),
    box("moov", trak(0, 0), trak(width, height)),
  );
}
