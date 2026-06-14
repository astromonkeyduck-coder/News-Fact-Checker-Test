import type { AiProvider } from "@/lib/ai/provider";
import { OpenAiProvider } from "@/lib/ai/openai";
import { AnthropicProvider } from "@/lib/ai/anthropic";

class StubProvider implements AiProvider {
  readonly name = "stub";
  readonly model = null;
  readonly isStub = true;
  async chat(): Promise<string> {
    // Never called; triage/captions handle stub deterministically.
    return "{}";
  }
}

/**
 * Resolves the active AI provider from env. Defaults to the deterministic stub
 * so the app runs with zero configuration. Falls back to the stub if a live
 * provider is selected but its key is missing.
 */
export function getProvider(): AiProvider {
  const choice = (process.env.AI_PROVIDER || "stub").toLowerCase();

  if (choice === "openai" && process.env.OPENAI_API_KEY) {
    return new OpenAiProvider(process.env.OPENAI_API_KEY);
  }
  if (choice === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  }
  return new StubProvider();
}

export { computeStubTriage, computeStubCaptions } from "@/lib/ai/stub";
