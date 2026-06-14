import OpenAI from "openai";
import type { AiProvider, ChatArgs } from "@/lib/ai/provider";

export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  readonly model: string;
  readonly isStub = false;
  private client: OpenAI;

  constructor(apiKey: string, model?: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model || process.env.OPENAI_MODEL || "gpt-4o-mini";
  }

  async chat({ system, user }: ChatArgs): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    return res.choices[0]?.message?.content ?? "";
  }
}
