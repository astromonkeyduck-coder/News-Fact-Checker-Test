import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider, ChatArgs } from "@/lib/ai/provider";

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  readonly model: string;
  readonly isStub = false;
  private client: Anthropic;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model || process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
  }

  async chat({ system, user }: ChatArgs): Promise<string> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 1500,
      temperature: 0.2,
      system: `${system}\n\nRespond with ONLY a single JSON object and no other text.`,
      messages: [{ role: "user", content: user }],
    });
    const block = res.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text : "";
  }
}
