import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../util/load-ts.js", () => ({
  loadStepsFromTs: vi.fn(),
}));

import { loadStepsFromTs } from "../util/load-ts.js";
import { runPresenter } from "../presenter/run-presenter.js";
import { videoMp4 } from "./synth-mp4.js";

const mockLoadTs = vi.mocked(loadStepsFromTs);

/** A minimal fetch Response stand-in (the client touches only this surface). */
function fakeResponse(input: {
  status?: number;
  body?: unknown;
  bytes?: Buffer;
  headers?: Record<string, string>;
}) {
  const status = input.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key: string) => input.headers?.[key.toLowerCase()] ?? null },
    json: async () => input.body ?? {},
    arrayBuffer: async () => {
      const bytes = input.bytes ?? Buffer.alloc(0);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
}

const CLIP_BYTES = Buffer.from("fake-mp4-bytes");

/**
 * Route the HeyGen API surface: upload → create → poll → download.
 * Overridable per test for the failure paths.
 */
function heygenFetchMock(overrides?: {
  onCreate?: () => ReturnType<typeof fakeResponse>;
  onPoll?: () => ReturnType<typeof fakeResponse>;
}) {
  return vi.fn(async (url: string | URL, init?: { method?: string }) => {
    const u = String(url);
    if (u.endsWith("/v3/assets")) {
      return fakeResponse({ body: { data: { asset_id: "asset-1" } } });
    }
    if (u.endsWith("/v3/videos") && init?.method === "POST") {
      return overrides?.onCreate?.() ?? fakeResponse({ body: { data: { video_id: "63a1b2c3d4e5" } } });
    }
    if (u.includes("/v3/videos/")) {
      return (
        overrides?.onPoll?.() ??
        fakeResponse({
          body: { data: { status: "completed", video_url: "https://cdn.heygen.test/clip.mp4" } },
        })
      );
    }
    if (u.startsWith("https://cdn.heygen.test/")) {
      return fakeResponse({ bytes: CLIP_BYTES });
    }
    throw new Error(`unexpected fetch: ${u}`);
  });
}

const instantSleep = () => Promise.resolve();

describe("scenar presenter", () => {
  let tempDir: string;
  let scenarioDir: string;
  let stepsPath: string;
  let logs: string[];
  const savedEnv = { key: process.env["HEYGEN_API_KEY"], avatar: process.env["HEYGEN_AVATAR_ID"] };

  /** Two authored steps; step 0 opts in. Narration audio exists for both. */
  const STEPS = [
    { delayMs: 0, narration: "Welcome to the demo.", presenter: true },
    { delayMs: 1500, narration: "That's it." },
  ];

  function writeNarrationFixture(durations = [4100, 2000]) {
    const narrationDir = join(scenarioDir, "narration");
    mkdirSync(narrationDir, { recursive: true });
    writeFileSync(
      join(narrationDir, "manifest.json"),
      JSON.stringify({
        steps: durations.map((durationMs, i) => ({ src: `./step-${i}.mp3`, durationMs })),
      }),
    );
    durations.forEach((_, i) => {
      writeFileSync(join(narrationDir, `step-${i}.mp3`), `mp3-bytes-${i}`);
    });
  }

  function run(overrides?: Partial<Parameters<typeof runPresenter>[0]>) {
    return runPresenter({
      target: stepsPath,
      avatar: "de95f90d748e4df3afbec3b7f8078ad8",
      yes: true,
      sleep: instantSleep,
      pollIntervalMs: 0,
      pollTimeoutMs: 1_000,
      onLog: (message) => logs.push(message),
      ...overrides,
    });
  }

  beforeEach(() => {
    logs = [];
    process.env["HEYGEN_API_KEY"] = "test-key";
    delete process.env["HEYGEN_AVATAR_ID"];
    tempDir = mkdtempSync(join(tmpdir(), "scenar-presenter-"));
    scenarioDir = join(tempDir, "welcome-tour");
    mkdirSync(scenarioDir, { recursive: true });
    stepsPath = join(scenarioDir, "steps.ts");
    writeFileSync(stepsPath, "");
    mockLoadTs.mockResolvedValue(STEPS);
    vi.stubGlobal("fetch", heygenFetchMock());
  });

  afterEach(() => {
    if (savedEnv.key === undefined) delete process.env["HEYGEN_API_KEY"];
    else process.env["HEYGEN_API_KEY"] = savedEnv.key;
    if (savedEnv.avatar === undefined) delete process.env["HEYGEN_AVATAR_ID"];
    else process.env["HEYGEN_AVATAR_ID"] = savedEnv.avatar;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("generates a clip and writes an authored-keyed manifest with narration durations", async () => {
    writeNarrationFixture();
    const result = await run();

    expect(result.totalGenerated).toBe(1);
    expect(result.totalFailed).toBe(0);

    const clipPath = join(scenarioDir, "presenter", "step-0.mp4");
    expect(existsSync(clipPath)).toBe(true);
    expect(readFileSync(clipPath)).toEqual(CLIP_BYTES);

    const manifest = JSON.parse(
      readFileSync(join(scenarioDir, "presenter", "manifest.json"), "utf-8"),
    );
    // Positional, keyed to AUTHORED steps; durationMs from the narration
    // manifest (B-2), never a duration probe. The fake clip bytes are
    // not parseable MP4, so the dimension probe (scenar#30) degrades:
    // entry written, no width/height — exactly the graceful path.
    expect(manifest).toEqual({
      steps: [{ src: "./step-0.mp4", durationMs: 4100 }, null],
    });

    const cache = JSON.parse(
      readFileSync(join(scenarioDir, "presenter", ".presenter-cache.json"), "utf-8"),
    );
    expect(cache.fingerprint).toBe(
      "heygen/iii/720p/mp4/de95f90d748e4df3afbec3b7f8078ad8",
    );
  });

  it("prints the plan and the uncached-only estimate before generating", async () => {
    writeNarrationFixture();
    await run();

    const output = logs.join("\n");
    expect(output).toContain(
      "Presenter plan — welcome-tour (engine iii, 720p, avatar de95…8ad8)",
    );
    expect(output).toContain("step 0   4.1s   generate");
    // 4.1s at ~$1/min (engine iii) ≈ $0.07.
    expect(output).toContain(
      "Estimated cost: 1 clip(s), 4.1s audio → ~$0.07 (rate: ~$1.00/min, engine iii)",
    );
  });

  describe("cost gate", () => {
    beforeEach(() => writeNarrationFixture());

    it("declining the prompt aborts with nothing spent and nothing written", async () => {
      const result = await run({ yes: false, isTty: true, confirmImpl: async () => false });

      expect(result.aborted).toBe(true);
      expect(result.totalGenerated).toBe(0);
      expect(fetch).not.toHaveBeenCalled();
      expect(existsSync(join(scenarioDir, "presenter"))).toBe(false);
      expect(logs.join("\n")).toContain("Aborted — nothing generated, nothing spent.");
    });

    it("accepting the prompt proceeds", async () => {
      const result = await run({ yes: false, isTty: true, confirmImpl: async () => true });
      expect(result.aborted).toBe(false);
      expect(result.totalGenerated).toBe(1);
    });

    it("--yes skips the prompt entirely", async () => {
      const confirmImpl = vi.fn(async () => true);
      await run({ yes: true, confirmImpl });
      expect(confirmImpl).not.toHaveBeenCalled();
    });

    it("refuses on a non-TTY without --yes — never spend silently", async () => {
      const result = await run({ yes: false, isTty: false });

      expect(result.aborted).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
      expect(logs.join("\n")).toContain(
        "stdin is not a TTY; pass --yes to confirm the estimated spend.",
      );
    });
  });

  describe("cache", () => {
    beforeEach(() => writeNarrationFixture());

    it("a fully-cached rerun makes no network calls and exits without prompting", async () => {
      await run();
      vi.stubGlobal("fetch", heygenFetchMock());

      const confirmImpl = vi.fn(async () => true);
      const result = await run({ yes: false, isTty: true, confirmImpl });

      expect(result.totalGenerated).toBe(0);
      expect(result.totalCached).toBe(1);
      expect(result.aborted).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
      expect(confirmImpl).not.toHaveBeenCalled();
      expect(logs.join("\n")).toContain("Nothing to generate — all clips cached.");
    });

    it("a cached rerun rewrites a deleted manifest without a paid call", async () => {
      await run();
      rmSync(join(scenarioDir, "presenter", "manifest.json"));
      vi.stubGlobal("fetch", heygenFetchMock());

      await run();
      expect(fetch).not.toHaveBeenCalled();
      const manifest = JSON.parse(
        readFileSync(join(scenarioDir, "presenter", "manifest.json"), "utf-8"),
      );
      expect(manifest.steps[0]).toEqual({ src: "./step-0.mp4", durationMs: 4100 });
    });

    it("a fingerprint change (different avatar) regenerates", async () => {
      await run();
      vi.stubGlobal("fetch", heygenFetchMock());

      const result = await run({ avatar: "another-avatar-id-000000" });
      expect(result.totalGenerated).toBe(1);
      expect(fetch).toHaveBeenCalled();
    });

    it("re-narrated audio (changed mp3 bytes) regenerates that step", async () => {
      await run();
      writeFileSync(join(scenarioDir, "narration", "step-0.mp3"), "different-bytes");
      vi.stubGlobal("fetch", heygenFetchMock());

      const result = await run();
      expect(result.totalGenerated).toBe(1);
    });
  });

  describe("failure mapping", () => {
    it("errors before any work when HEYGEN_API_KEY is missing", async () => {
      delete process.env["HEYGEN_API_KEY"];
      await expect(run()).rejects.toThrow(/HEYGEN_API_KEY environment variable is not set/);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("errors when no avatar id is given by flag or env", async () => {
      await expect(run({ avatar: undefined })).rejects.toThrow(
        "No avatar id. Pass --avatar <id> or set HEYGEN_AVATAR_ID.",
      );
    });

    it("falls back to HEYGEN_AVATAR_ID when the flag is absent", async () => {
      writeNarrationFixture();
      process.env["HEYGEN_AVATAR_ID"] = "env-avatar-id-00000000";
      const result = await run({ avatar: undefined });
      expect(result.totalGenerated).toBe(1);
    });

    it("hard-errors listing the steps when narration audio is missing", async () => {
      // No narration fixture written at all.
      await expect(run()).rejects.toThrow(
        `steps 0 opt into the presenter but have no narration audio. ` +
          `Run 'scenar narrate ${stepsPath}' first — presenter clips are derived from narration audio.`,
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it("guards an opted-in step without narration text in the validator's wording", async () => {
      mockLoadTs.mockResolvedValue([{ delayMs: 0, presenter: true }]);
      await expect(run()).rejects.toThrow(
        "steps[0].presenter: presenter requires narration_text — " +
          "a presenter clip is derived from the step's narration audio.",
      );
    });

    it("surfaces a HeyGen failure verbatim, nulls the manifest entry, and reports it", async () => {
      writeNarrationFixture();
      vi.stubGlobal(
        "fetch",
        heygenFetchMock({
          onPoll: () =>
            fakeResponse({
              body: { data: { status: "failed", failure_message: "avatar quota exceeded" } },
            }),
        }),
      );

      const result = await run();
      expect(result.totalFailed).toBe(1);
      expect(logs.join("\n")).toContain(
        "step 0: HeyGen generation failed: avatar quota exceeded",
      );

      const manifest = JSON.parse(
        readFileSync(join(scenarioDir, "presenter", "manifest.json"), "utf-8"),
      );
      expect(manifest.steps).toEqual([null, null]);
    });

    it("honors Retry-After on 429 and succeeds on the retry", async () => {
      writeNarrationFixture();
      let createCalls = 0;
      vi.stubGlobal(
        "fetch",
        heygenFetchMock({
          onCreate: () => {
            createCalls++;
            return createCalls === 1
              ? fakeResponse({ status: 429, headers: { "retry-after": "1" } })
              : fakeResponse({ body: { data: { video_id: "63a1b2c3d4e5" } } });
          },
        }),
      );

      const result = await run();
      expect(result.totalGenerated).toBe(1);
      expect(createCalls).toBe(2);
      expect(logs.join("\n")).toContain("rate-limited, retrying in 1s (1/3)");
    });

    it("fails a step that never completes within the poll timeout, naming the video id", async () => {
      writeNarrationFixture();
      vi.stubGlobal(
        "fetch",
        heygenFetchMock({
          onPoll: () => fakeResponse({ body: { data: { status: "processing" } } }),
        }),
      );

      const result = await run({ pollTimeoutMs: 5, pollIntervalMs: 1, sleep: instantSleep });
      expect(result.totalFailed).toBe(1);
      expect(logs.join("\n")).toContain("check video 63a1b2c3d4e5 in the HeyGen dashboard");
    });
  });

  describe("clip dimensions (scenar#30)", () => {
    const NEAR_SQUARE_CLIP = Buffer.from(videoMp4(788, 720));

    function realClipFetchMock() {
      const base = heygenFetchMock();
      return vi.fn(async (url: string | URL, init?: { method?: string }) => {
        if (String(url).startsWith("https://cdn.heygen.test/")) {
          return fakeResponse({ bytes: NEAR_SQUARE_CLIP });
        }
        return base(url, init);
      });
    }

    beforeEach(() => {
      writeNarrationFixture();
      vi.stubGlobal("fetch", realClipFetchMock());
    });

    it("probes the downloaded clip and writes its dimensions into the manifest", async () => {
      await run();

      const manifest = JSON.parse(
        readFileSync(join(scenarioDir, "presenter", "manifest.json"), "utf-8"),
      );
      expect(manifest.steps[0]).toEqual({
        src: "./step-0.mp4",
        durationMs: 4100,
        width: 788,
        height: 720,
      });
    });

    it("a cached rewrite re-probes the clip on disk — dimensions never depend on the download path", async () => {
      await run();
      rmSync(join(scenarioDir, "presenter", "manifest.json"));
      vi.stubGlobal("fetch", realClipFetchMock());

      await run();
      expect(fetch).not.toHaveBeenCalled();
      const manifest = JSON.parse(
        readFileSync(join(scenarioDir, "presenter", "manifest.json"), "utf-8"),
      );
      expect(manifest.steps[0]).toEqual({
        src: "./step-0.mp4",
        durationMs: 4100,
        width: 788,
        height: 720,
      });
    });
  });

  it("skips a scenario with no opted-in steps", async () => {
    mockLoadTs.mockResolvedValue([{ delayMs: 0, narration: "Hello." }]);
    const result = await run();
    expect(result.totalSkipped).toBe(1);
    expect(result.scenarios[0]!.skipped).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});
