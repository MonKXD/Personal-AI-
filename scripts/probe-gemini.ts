/** Probe which Gemini models actually respond for this API key. npm run probe:gemini */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

const KEY = process.env.GOOGLE_API_KEY!;
const CANDIDATES = [
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
];

async function tryModel(m: string) {
  const t = Date.now();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "reply with the single word: ok" }] }],
          generationConfig: { maxOutputTokens: 10, temperature: 0 },
        }),
      },
    );
    const body = await res.text();
    const ms = Date.now() - t;
    if (res.ok) {
      const txt =
        JSON.parse(body).candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      console.log(`  ✓ ${m.padEnd(26)} ${ms}ms   "${txt}"`);
    } else {
      const msg = (() => {
        try {
          return JSON.parse(body).error?.message?.slice(0, 90);
        } catch {
          return body.slice(0, 90);
        }
      })();
      console.log(`  ✗ ${m.padEnd(26)} ${res.status}  ${msg}`);
    }
  } catch (e) {
    console.log(`  ✗ ${m.padEnd(26)} ERR ${(e as Error).message}`);
  }
}

async function main() {
  console.log("\nProbing generateContent models for this key:\n");
  for (const m of CANDIDATES) await tryModel(m);

  console.log("\nEmbeddings:");
  for (const m of ["gemini-embedding-001", "gemini-embedding-2"]) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:embedContent`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": KEY },
          body: JSON.stringify({
            content: { parts: [{ text: "hello" }] },
            outputDimensionality: 1024,
          }),
        },
      );
      const body = await res.text();
      if (res.ok) {
        const n = JSON.parse(body).embedding?.values?.length;
        console.log(`  ✓ ${m.padEnd(26)} dims=${n}`);
      } else {
        console.log(`  ✗ ${m.padEnd(26)} ${res.status} ${body.slice(0, 90)}`);
      }
    } catch (e) {
      console.log(`  ✗ ${m.padEnd(26)} ERR ${(e as Error).message}`);
    }
  }
  console.log();
}

main();
