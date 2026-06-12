import { describe, it, expect, vi, afterEach } from "vitest";
import { putFile } from "../deploy/upload.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("putFile", () => {
  it("PUTs the raw bytes and replays required headers verbatim", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    globalThis.fetch = vi.fn(async (url: any, init: any) => {
      seen.url = String(url);
      seen.init = init;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const bytes = new Uint8Array([1, 2, 3]);
    const headers = { "Content-Type": "text/html", "x-amz-checksum-sha256": "AAAA" };
    await putFile("https://store/key", headers, bytes);

    expect(seen.url).toBe("https://store/key");
    expect(seen.init!.method).toBe("PUT");
    expect(seen.init!.headers).toEqual(headers);
    expect(seen.init!.body).toBe(bytes);
  });

  it("throws with the status and body detail on a non-2xx response", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("SignatureDoesNotMatch", { status: 403, statusText: "Forbidden" }),
    ) as unknown as typeof fetch;

    await expect(putFile("https://store/key", {}, new Uint8Array())).rejects.toThrow(
      /upload failed \(403 Forbidden\): SignatureDoesNotMatch/,
    );
  });
});
