import "server-only";

import { OfficeParser } from "officeparser";

/**
 * Plain-text extraction for DOCX/PPTX, ahead of a text-only Gemini call
 * (Gemini doesn't accept these formats directly — see lib/ai/gemini.ts's
 * GeminiTextDocumentExtractor). Never call this with anything other than a
 * validated docx/pptx buffer: `officeparser` also bundles a PDF parser
 * (pdfjs-dist) with a known CVE for malicious PDFs
 * (GHSA-hq66-cqwq-w95j) — passing an explicit fileType here, rather than
 * letting it auto-detect, guarantees that code path is never reached.
 */
export type OfficeKind = "docx" | "pptx";

export async function extractOfficeText(buf: Buffer, kind: OfficeKind): Promise<string> {
  const ast = await OfficeParser.parseOffice(buf, { fileType: kind });
  const { value } = await ast.to("text");
  return value.trim();
}
