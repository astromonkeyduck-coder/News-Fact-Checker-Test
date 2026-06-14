export interface ChatArgs {
  system: string;
  user: string;
}

/**
 * Minimal provider contract. LLM providers return raw text (expected to be
 * JSON). The stub provider sets isStub=true and is handled with deterministic
 * local logic in triage.ts / captions.ts instead of calling chat().
 */
export interface AiProvider {
  name: string;
  model: string | null;
  isStub: boolean;
  chat(args: ChatArgs): Promise<string>;
}
