import Anthropic from "@anthropic-ai/sdk";
import { extractionSchema, type Extraction, type VisionExtractor, type VisionInput } from "./types";
import { EXTRACT_SYSTEM, buildExtractUserPrompt } from "./prompts";

/** Strip ```json fences / leading prose and parse the first JSON object. */
function parseJsonObject(raw: string): unknown {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

export class AnthropicVisionExtractor implements VisionExtractor {
  readonly name = "anthropic";
  readonly model: string;
  private client: Anthropic;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async extract(input: VisionInput): Promise<Extraction> {
    // Claude needs a "document" content block (not "image") for PDFs —
    // not wired up here. Fail clearly rather than send a malformed request.
    if (input.mediaType === "application/pdf") {
      throw new Error(
        "PDF capture needs AI_PROVIDER=gemini (or DRY_RUN=1) — PDF isn't wired up for anthropic yet.",
      );
    }
    const mediaType = input.mediaType;
    const doOnce = async (nudge?: string): Promise<Extraction> => {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: EXTRACT_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: input.imageBase64,
                },
              },
              {
                type: "text",
                text:
                  buildExtractUserPrompt(input.now, input.timezone) +
                  (nudge ? `\n\n${nudge}` : ""),
              },
            ],
          },
        ],
      });

      const textPart = message.content.find((c) => c.type === "text");
      const raw = textPart && "text" in textPart ? textPart.text : "";
      const json = parseJsonObject(raw);
      return extractionSchema.parse(json);
    };

    try {
      return await doOnce();
    } catch {
      // One retry with an explicit nudge; let a second failure bubble up.
      return await doOnce(
        "Your previous output could not be parsed. Return ONLY the JSON object, no fences, no prose.",
      );
    }
  }
}
