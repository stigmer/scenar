import type { TtsProvider } from "./types.js";
import { createEchogardenProvider, isEchogardenAvailable } from "./echogarden.js";
import { createOpenAIProvider } from "./openai.js";

export type TtsProviderName = "echogarden" | "openai";

const KNOWN_PROVIDERS: ReadonlySet<string> = new Set<TtsProviderName>(["echogarden", "openai"]);

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

  const available = await isEchogardenAvailable();
  if (!available) {
    throw new Error(
      "Echogarden is not installed. To use free offline TTS:\n\n" +
      "  pnpm add echogarden\n\n" +
      "Or use OpenAI TTS instead:\n\n" +
      "  scenar narrate <file> --tts openai",
    );
  }

  return createEchogardenProvider();
}
