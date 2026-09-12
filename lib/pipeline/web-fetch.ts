import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

/**
 * Fetch a public web page and pull its readable text out, for URL capture.
 *
 * SSRF is the risk here: this runs server-side and would otherwise let a user
 * point us at internal services or the cloud metadata endpoint. Every hostname
 * (initial and every redirect hop) is DNS-resolved and rejected if it lands on
 * a private / loopback / link-local address.
 */

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 12_000;
const MAX_TEXT = 40_000;
const UA =
  "Mozilla/5.0 (compatible; MirrorMindBot/1.0; +https://mirror-mindai.vercel.app)";

export class WebFetchError extends Error {}

function isBlockedIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (v === 6) {
    const lo = ip.toLowerCase();
    return (
      lo === "::1" ||
      lo === "::" ||
      lo.startsWith("fc") ||
      lo.startsWith("fd") || // unique-local
      lo.startsWith("fe80") || // link-local
      lo.startsWith("::ffff:") // IPv4-mapped — re-check the v4 part
    );
  }
  return true; // unknown format → refuse
}

async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new WebFetchError("That address isn't reachable.");
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new WebFetchError("Couldn't resolve that address.");
  }
  for (const { address } of addrs) {
    const v4 = address.startsWith("::ffff:") ? address.slice(7) : address;
    if (isBlockedIp(v4) || isBlockedIp(address)) {
      throw new WebFetchError("That address isn't allowed.");
    }
  }
}

export type ReadablePage = {
  title: string;
  text: string;
  siteName: string | null;
  finalUrl: string;
};

export async function fetchReadable(input: string): Promise<ReadablePage> {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new WebFetchError("That doesn't look like a URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new WebFetchError("Only http and https links are supported.");
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    let current = url;
    for (let hop = 0; ; hop++) {
      await assertPublicHost(current.hostname);
      const r = await fetch(current, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      });
      if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
        if (hop >= MAX_REDIRECTS) throw new WebFetchError("Too many redirects.");
        current = new URL(r.headers.get("location")!, current);
        continue;
      }
      res = r;
      url = current;
      break;
    }
  } catch (e) {
    if (e instanceof WebFetchError) throw e;
    throw new WebFetchError(
      (e as Error)?.name === "AbortError" ? "That page took too long to load." : "Couldn't reach that page.",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new WebFetchError(`That page returned ${res.status}.`);
  const ctype = res.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml/i.test(ctype)) {
    throw new WebFetchError("That link isn't a web page.");
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new WebFetchError("That page is too large.");
  const html = buf.toString("utf8");

  const { document } = parseHTML(html);
  let title = document.querySelector("title")?.textContent?.trim() ?? "";
  let text = "";
  let siteName: string | null = null;

  try {
    const article = new Readability(document as unknown as Document, {
      charThreshold: 200,
    }).parse();
    if (article?.textContent) {
      text = article.textContent;
      title = article.title?.trim() || title;
      siteName = article.siteName?.trim() || null;
    }
  } catch {
    /* fall through to the crude path */
  }

  if (!text || text.trim().length < 200) {
    document.querySelectorAll("script,style,noscript,nav,footer,header,aside").forEach((n) => n.remove());
    text = document.body?.textContent ?? "";
  }

  text = text.replace(/[ \t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT);
  if (text.length < 200) throw new WebFetchError("Couldn't find readable text on that page.");

  return {
    title: (title || url.hostname).slice(0, 200),
    text,
    siteName,
    finalUrl: url.toString(),
  };
}
