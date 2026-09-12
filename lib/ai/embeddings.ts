import type { Embedder } from "./types";

/**
 * Embeddings via HTTP (no vendor SDK). Voyage or OpenAI, selected by
 * EMBEDDING_PROVIDER. Batches all texts in one request.
 */

type ProviderConfig = {
  provider: "voyage" | "openai";
  apiKey: string;
  model: string;
  dims: number;
};

export class HttpEmbedder implements Embedder {
  readonly name: string;
  readonly model: string;
  readonly dims: number;
  private cfg: ProviderConfig;

  constructor(cfg: ProviderConfig) {
    this.cfg = cfg;
    this.name = cfg.provider;
    this.model = cfg.model;
    this.dims = cfg.dims;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const clean = texts.map((t) => (t.trim() ? t.slice(0, 8000) : " "));
    return this.cfg.provider === "voyage"
      ? this.voyage(clean)
      : this.openai(clean);
  }

  private async voyage(texts: string[]): Promise<number[][]> {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: this.cfg.model,
        input: texts,
        input_type: "document",
        output_dimension: this.cfg.dims,
      }),
    });
    if (!res.ok) {
      throw new Error(`Voyage embeddings ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      data: { index: number; embedding: number[] }[];
    };
    return json.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }

  private async openai(texts: string[]): Promise<number[][]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: this.cfg.model,
        input: texts,
        dimensions: this.cfg.dims,
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      data: { index: number; embedding: number[] }[];
    };
    return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}
