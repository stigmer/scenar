import type { TtsProvider } from "./types.js";
import { createEchogardenProvider, isEchogardenAvailable } from "./echogarden.js";
import { createEdgeTtsProvider, isEdgeTtsAvailable } from "./edge-tts.js";
import { createOpenAIProvider } from "./openai.js";

export type TtsProviderName = "echogarden" | "edge-tts" | "openai";

const KNOWN_PROVIDERS: ReadonlySet<string> = new Set<TtsProviderName>([
  "echogarden",
  "edge-tts",
  "openai",
]);

/**
 * Resolve a TTS provider by name.
 *
 * When `providerName` is `"echogarden"` (the default), verifies
 * the optional peer dependency is installed before returning it.
 * Falls back to a clear error message guiding the user.
 */
export async function resolveProvider(providerName: string): Promise<TtsProvider> {
  if (!KNOWN_PROVIDERS.has(providerName)) {
    throw new Error(
      `Unknown TTS provider: "${providerName}". ` +
      `Supported providers: ${[...KNOWN_PROVIDERS].join(", ")}.`,
    );
  }

  if (providerName === "openai") {
    return createOpenAIProvider();
  }

  if (providerName === "edge-tts") {
    const available = await isEdgeTtsAvailable();
    if (!available) {
      throw new Error(
        "edge-tts-universal is not installed. To use free online TTS:\n\n" +
        "  pnpm add edge-tts-universal\n\n" +
        "Or use a different provider:\n\n" +
        "  scenar narrate <file> --tts echogarden   (offline, pnpm add echogarden)\n" +
        "  scenar narrate <file> --tts openai        (requires OPENAI_API_KEY)",
      );
    }
    return createEdgeTtsProvider();
  }

  const available = await isEchogardenAvailable();
  if (!available) {
    throw new Error(
      "Echogarden is not installed. To use free offline TTS:\n\n" +
      "  pnpm add echogarden\n\n" +
      "Or use free online TTS (requires network):\n\n" +
      "  scenar narrate <file> --tts edge-tts\n" +
      "  pnpm add edge-tts-universal\n\n" +
      "Or use OpenAI TTS (requires API key):\n\n" +
      "  scenar narrate <file> --tts openai",
    );
  }

  return createEchogardenProvider();
}
