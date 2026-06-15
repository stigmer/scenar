import { describe, it, expect } from "vitest";
import { buildEmbedSnippet } from "../deploy/embed-snippet.js";

describe("buildEmbedSnippet", () => {
  const embedUrl = "https://d-dep1.scenarusercontent.net/";

  it("pins the responsive box to the canonical aspect ratio and max width", () => {
    const snippet = buildEmbedSnippet({ embedUrl, viewport: { width: 896, height: 480 } });
    expect(snippet).toContain("aspect-ratio:896/480");
    expect(snippet).toContain("max-width:896px");
    expect(snippet).toContain("width:100%");
  });

  it("embeds the URL as the iframe src and lazy-loads", () => {
    const snippet = buildEmbedSnippet({ embedUrl, viewport: { width: 896, height: 480 } });
    expect(snippet).toContain(`src="${embedUrl}"`);
    expect(snippet).toContain('loading="lazy"');
  });

  it("delegates autoplay and fullscreen (the host half of the permission pair)", () => {
    const snippet = buildEmbedSnippet({ embedUrl, viewport: { width: 896, height: 480 } });
    expect(snippet).toContain('allow="autoplay; fullscreen"');
    expect(snippet).toContain("allowfullscreen");
  });

  it("uses a default title and honors an explicit one", () => {
    const def = buildEmbedSnippet({ embedUrl, viewport: { width: 896, height: 480 } });
    expect(def).toContain('title="Scenar embed"');

    const named = buildEmbedSnippet({
      embedUrl,
      viewport: { width: 896, height: 480 },
      title: "Welcome tour",
    });
    expect(named).toContain('title="Welcome tour"');
  });

  it("escapes attribute-breaking characters in the URL and title", () => {
    const snippet = buildEmbedSnippet({
      embedUrl: 'https://x.test/?a=1&b="2"',
      viewport: { width: 800, height: 600 },
      title: '<script>"&',
    });
    expect(snippet).toContain("https://x.test/?a=1&amp;b=&quot;2&quot;");
    expect(snippet).toContain('title="&lt;script&gt;&quot;&amp;"');
    // No raw quote/angle bracket leaked into an attribute value.
    expect(snippet).not.toContain('b="2"');
    expect(snippet).not.toContain("<script>");
  });

  it("reflects different viewports in the aspect ratio", () => {
    const snippet = buildEmbedSnippet({ embedUrl, viewport: { width: 1280, height: 720 } });
    expect(snippet).toContain("aspect-ratio:1280/720");
    expect(snippet).toContain("max-width:1280px");
  });
});
