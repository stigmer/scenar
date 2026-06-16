import { describe, it, expect } from "vitest";
import { localViewUrl } from "../serve/local-url.js";

describe("localViewUrl", () => {
  it("downgrades https to http for *.localhost hosts (local edges serve http)", () => {
    expect(localViewUrl("https://d-abc.localhost:8787/")).toBe("http://d-abc.localhost:8787/");
    expect(localViewUrl("https://localhost:8787/")).toBe("http://localhost:8787/");
  });

  it("leaves production https URLs untouched", () => {
    expect(localViewUrl("https://d-abc.scenar.ai/")).toBe("https://d-abc.scenar.ai/");
  });

  it("returns non-URL input unchanged", () => {
    expect(localViewUrl("not a url")).toBe("not a url");
  });
});
