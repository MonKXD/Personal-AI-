import type { ChatAnswer, ChatInput, ChatModel } from "./types";

/** Errors worth switching provider for: quota, overload, transient 5xx. */
const RETRIABLE = /\b(429|5\d\d)\b|quota|rate.?limit|overloaded|unavailable|deadline|exhausted/i;

/**
 * Try the primary chat model; on a rate-limit / overload error, answer with the
 * secondary instead. Streaming falls back only if the primary fails before it
 * has emitted any text.
 */
export class FallbackChatModel implements ChatModel {
  readonly name: string;
  constructor(
    private primary: ChatModel,
    private secondary: ChatModel,
  ) {
    this.name = `${primary.name}->${secondary.name}`;
  }

  async answer(input: ChatInput): Promise<ChatAnswer> {
    try {
      return await this.primary.answer(input);
    } catch (e) {
      if (!RETRIABLE.test(String(e))) throw e;
      console.warn("[ai] primary chat failed, using fallback:", String(e).slice(0, 160));
      return this.secondary.answer(input);
    }
  }

  async *streamAnswer(input: ChatInput): AsyncGenerator<string, ChatAnswer, void> {
    let emitted = false;
    try {
      if (this.primary.streamAnswer) {
        const gen = this.primary.streamAnswer(input);
        for (;;) {
          const step = await gen.next();
          if (step.done) return step.value;
          emitted = true;
          yield step.value;
        }
      }
      const a = await this.primary.answer(input);
      if (a.answer) yield a.answer;
      return a;
    } catch (e) {
      if (emitted || !RETRIABLE.test(String(e))) throw e;
      console.warn("[ai] primary stream failed, using fallback:", String(e).slice(0, 160));
      const a = await this.secondary.answer(input);
      if (a.answer) yield a.answer;
      return a;
    }
  }
}
