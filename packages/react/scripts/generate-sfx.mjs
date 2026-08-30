/**
 * Generates Scenar's default interaction sound-effect set.
 *
 * Provenance: every sample is synthesized below from first principles —
 * seeded noise and sine partials under exponential decay — so the assets
 * carry no third-party recordings and no license obligations beyond the
 * repository's own (Apache-2.0). The PRNG is seeded, making regeneration
 * byte-identical: `node scripts/generate-sfx.mjs` from packages/react.
 *
 * Output: assets/sfx/click.mp3 and assets/sfx/keystroke.mp3 (checked in;
 * the build copies assets/ into dist/assets/). MP3 because it is the one
 * audio format the packed-embed deploy contract serves — the same format
 * narration uses.
 *
 * Sound design intent (reviewed by ear at the project's Gate B):
 * - click: a soft, rounded UI tick — noise transient over a ~1.9 kHz
 *   partial, ~35 ms, felt more than heard.
 * - keystroke: a shorter, duller tap so rapid typing (20 chars/s) reads
 *   as texture, not percussion.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import lamejs from "@breezystack/lamejs";

const SAMPLE_RATE = 44_100;
const KBPS = 128;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "sfx");

/** Deterministic PRNG (mulberry32) so regeneration is byte-identical. */
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Synthesize a percussive tick: seeded noise plus a sine partial, both
 * under an exponential decay envelope, with a 1 ms linear attack to
 * avoid an onset click.
 */
function synthesizeTick({ seed, durationMs, decayMs, toneHz, toneMix, gain }) {
  const random = mulberry32(seed);
  const length = Math.round((durationMs / 1000) * SAMPLE_RATE);
  const samples = new Int16Array(length);

  const attackSamples = Math.round(0.001 * SAMPLE_RATE);
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const noise = random() * 2 - 1;
    const tone = Math.sin(2 * Math.PI * toneHz * t);
    const envelope = Math.exp(-t / (decayMs / 1000));
    const attack = i < attackSamples ? i / attackSamples : 1;
    const value = (noise * (1 - toneMix) + tone * toneMix) * envelope * attack * gain;
    samples[i] = Math.max(-32768, Math.min(32767, Math.round(value * 32767)));
  }
  return samples;
}

/** Encode mono 16-bit PCM to MP3. */
function encodeMp3(samples) {
  const encoder = new lamejs.Mp3Encoder(1, SAMPLE_RATE, KBPS);
  const chunks = [];
  const frame = 1152;
  for (let i = 0; i < samples.length; i += frame) {
    const encoded = encoder.encodeBuffer(samples.subarray(i, i + frame));
    if (encoded.length > 0) chunks.push(Buffer.from(encoded));
  }
  const flushed = encoder.flush();
  if (flushed.length > 0) chunks.push(Buffer.from(flushed));
  return Buffer.concat(chunks);
}

const SOUNDS = {
  "click.mp3": synthesizeTick({
    seed: 0x5ce7a201,
    durationMs: 35,
    decayMs: 6,
    toneHz: 1900,
    toneMix: 0.35,
    gain: 0.8,
  }),
  "keystroke.mp3": synthesizeTick({
    seed: 0x5ce7a202,
    durationMs: 25,
    decayMs: 4,
    toneHz: 1300,
    toneMix: 0.25,
    gain: 0.55,
  }),
};

await mkdir(OUT_DIR, { recursive: true });
for (const [name, samples] of Object.entries(SOUNDS)) {
  const mp3 = encodeMp3(samples);
  await writeFile(join(OUT_DIR, name), mp3);
  console.log(`wrote assets/sfx/${name} (${mp3.length} bytes)`);
}
