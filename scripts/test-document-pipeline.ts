/**
 * End-to-end pipeline smoke test for the document capture modality (PDF,
 * DOCX, PPTX) against your real Supabase — the document counterpart to
 * test-pipeline.ts (which covers images/audio).
 *
 *   npm run test:documents                # DRY_RUN fixtures, deterministic
 *   npm run test:documents -- --real      # use the configured AI provider
 *
 * Synthesizes a 3-page PDF, a 3-paragraph DOCX, and a 3-slide PPTX in memory
 * (no fixture files needed), each with a distinct marker on its LAST
 * page/paragraph/slide only. Runs each through the real upload -> capture
 * row -> pipeline path, then checks:
 *   - officeparser's raw text extraction covers the DOCX/PPTX in full (not
 *     just the first paragraph/slide) — checked directly, no AI involved.
 *   - the pipeline reaches "ready" for all three and stores the correct mime.
 *   - (--real only) the model's extracted memory text mentions the marker
 *     that only appears on the LAST page/slide — proving the whole document
 *     was read, not just the first page — and a retrieval query naming that
 *     marker surfaces the right memory (the same proof used for chat/audio
 *     citations elsewhere in this project).
 *
 * Test captures are tagged device_hint='document-pipeline-test' and cleared
 * at the start of each run; the latest run's memories are left in place so
 * you can open them in the app, matching test-pipeline.ts's convention.
 */
const REAL = process.argv.includes("--real");
if (!REAL) process.env.DRY_RUN = "1";

import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { createHash } from "node:crypto";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { zipSync, strToU8 } from "fflate";

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/* --------------------------- synthetic documents --------------------------- */

function escapePdfText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** A minimal but valid multi-page PDF, one line of Helvetica text per page. */
function makeSimplePdf(pageTexts: string[]): Buffer {
  const chunks: string[] = [];
  const offsets: number[] = []; // offsets[objNum] = byte offset, 1-indexed objects
  let pos = 0;
  const header = "%PDF-1.4\n";
  chunks.push(header);
  pos += Buffer.byteLength(header);

  const push = (objNum: number, body: string) => {
    offsets[objNum] = pos;
    const s = `${objNum} 0 obj\n${body}\nendobj\n`;
    chunks.push(s);
    pos += Buffer.byteLength(s);
  };

  const n = pageTexts.length;
  const fontObjNum = 2 + n * 2 + 1; // catalog(1) pages(2) then n*(page+content) then font
  const pageObjNums = pageTexts.map((_, i) => 3 + i * 2);
  const contentObjNums = pageTexts.map((_, i) => 4 + i * 2);

  push(1, `<< /Type /Catalog /Pages 2 0 R >>`);
  push(
    2,
    `<< /Type /Pages /Kids [${pageObjNums.map((o) => `${o} 0 R`).join(" ")}] /Count ${n} >>`,
  );

  pageTexts.forEach((text, i) => {
    const pageObj = pageObjNums[i];
    const contentObj = contentObjNums[i];
    push(
      pageObj,
      `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> /MediaBox [0 0 612 792] /Contents ${contentObj} 0 R >>`,
    );
    const stream = `BT /F1 24 Tf 72 700 Td (${escapePdfText(text)}) Tj ET`;
    push(contentObj, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });

  push(fontObjNum, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);

  const totalObjs = fontObjNum;
  const xrefStart = pos;
  let xref = `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= totalObjs; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  chunks.push(xref);

  return Buffer.from(chunks.join(""), "latin1");
}

const CONTENT_TYPES_DOCX = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS_ROOT_DOCX = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

function makeSimpleDocx(paragraphs: string[]): Buffer {
  const body = paragraphs
    .map((p) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(p)}</w:t></w:r></w:p>`)
    .join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}</w:body>
</w:document>`;

  const zipped = zipSync(
    {
      "[Content_Types].xml": strToU8(CONTENT_TYPES_DOCX),
      "_rels/.rels": strToU8(RELS_ROOT_DOCX),
      "word/document.xml": strToU8(documentXml),
    },
    { level: 0 },
  );
  return Buffer.from(zipped);
}

const CONTENT_TYPES_PPTX = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
</Types>`;

const RELS_ROOT_PPTX = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function makeSimplePptx(slideTexts: string[]): Buffer {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(CONTENT_TYPES_PPTX),
    "_rels/.rels": strToU8(RELS_ROOT_PPTX),
    "ppt/presentation.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`,
    ),
  };
  slideTexts.forEach((text, i) => {
    files[`ppt/slides/slide${i + 1}.xml`] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p><a:r><a:t>${escapeXml(text)}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`,
    );
  });
  return Buffer.from(zipSync(files, { level: 0 }));
}

/* ------------------------------- test runner ------------------------------- */

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !supaUrl || !serviceKey) {
    console.error(
      "Need DATABASE_URL(_UNPOOLED), NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
    process.exit(1);
  }

  console.log(`Mode: ${REAL ? "REAL (configured provider)" : "DRY_RUN fixtures"}\n`);

  // 0. officeparser unit check — pure extraction, no AI, no DB. Proves the
  // whole document is read, not just the first paragraph/slide.
  const { extractOfficeText } = await import("../lib/pipeline/office-text");
  const docxMarkers = ["Intro paragraph.", "Middle paragraph.", "MARKER_DOCX_TAIL_9f31"];
  const pptxMarkers = ["Slide one.", "Slide two.", "MARKER_PPTX_TAIL_2ac7"];
  const docxText = await extractOfficeText(makeSimpleDocx(docxMarkers), "docx");
  const pptxText = await extractOfficeText(makeSimplePptx(pptxMarkers), "pptx");
  const docxOk = docxMarkers.every((m) => docxText.includes(m));
  const pptxOk = pptxMarkers.every((m) => pptxText.includes(m));
  console.log("─── officeparser extraction (no AI) ───");
  console.log("docx: all paragraphs present  :", docxOk, docxOk ? "" : `\n  got: ${docxText}`);
  console.log("pptx: all slides present      :", pptxOk, pptxOk ? "" : `\n  got: ${pptxText}`);

  const sql = postgres(url, { prepare: false, max: 1 });
  const supabase = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  const [u] = await sql<{ id: string; email: string }[]>`
    select id, email from auth.users order by created_at asc limit 1
  `;
  if (!u) {
    console.error("No users yet — sign in to the app once, then re-run.");
    process.exit(1);
  }
  console.log(`\nUsing user ${u.email} (${u.id})`);

  const cleared = await sql`
    delete from captures where user_id = ${u.id} and device_hint = 'document-pipeline-test'
  `;
  if (cleared.count) console.log(`Cleared ${cleared.count} previous test capture(s)`);
  await sql.end();

  const { ulid } = await import("ulid");
  const { runPipeline } = await import("../lib/pipeline/run");

  const pdfMarker = "MARKER_PDF_TAIL_7e4d";
  const cases: { kind: string; mime: string; buf: Buffer; tailMarker: string }[] = [
    {
      kind: "pdf",
      mime: PDF_MIME,
      buf: makeSimplePdf(["Cover page.", "Middle page.", `Last page fact: ${pdfMarker}`]),
      tailMarker: pdfMarker,
    },
    {
      kind: "docx",
      mime: DOCX_MIME,
      buf: makeSimpleDocx(docxMarkers),
      tailMarker: "MARKER_DOCX_TAIL_9f31",
    },
    {
      kind: "pptx",
      mime: PPTX_MIME,
      buf: makeSimplePptx(pptxMarkers),
      tailMarker: "MARKER_PPTX_TAIL_2ac7",
    },
  ];

  let allOk = docxOk && pptxOk;

  for (const c of cases) {
    console.log(`\n─── ${c.kind} ───`);
    const captureId: string = ulid();
    const sha256 = createHash("sha256").update(c.buf).digest("hex");
    const ext = c.kind === "pdf" ? "pdf" : c.kind;
    const key = `${u.id}/${captureId}/original.${ext}`;

    const up = await supabase.storage
      .from("captures")
      .upload(key, c.buf, { contentType: c.mime, upsert: true });
    if (up.error) {
      console.error("upload failed:", up.error.message);
      allOk = false;
      continue;
    }

    const sqlIns = postgres(url, { prepare: false, max: 1 });
    await sqlIns`
      insert into captures (id, user_id, status, original_key, display_key, thumb_key,
        mime, bytes, sha256, source, device_hint, captured_at)
      values (${captureId}, ${u.id}, 'queued', ${key}, ${key}, ${key},
        ${c.mime}, ${c.buf.length}, ${sha256}, 'upload', 'document-pipeline-test', now())
    `;
    await sqlIns.end();
    console.log(`Inserted capture ${captureId} (${c.buf.length} bytes)`);

    await runPipeline(captureId);

    const sqlChk = postgres(url, { prepare: false, max: 1 });
    const [cap] = await sqlChk<
      { status: string; error_code: string | null; mime: string }[]
    >`select status, error_code, mime from captures where id = ${captureId}`;
    const [mem] = await sqlChk<{ id: string; type: string; title: string; text: string }[]>`
      select id, type, title, text from memories where capture_id = ${captureId}
    `;
    await sqlChk.end();

    console.log("status        :", cap?.status, cap?.error_code ? `(${cap.error_code})` : "");
    console.log("mime stored   :", cap?.mime, cap?.mime === c.mime ? "(matches)" : "(MISMATCH)");
    const ready = cap?.status === "ready" && !!mem;
    let tailFound: boolean | null = null;
    if (REAL && mem) {
      tailFound = mem.text.includes(c.tailMarker);
      console.log("memory.type   :", mem.type);
      console.log("memory.title  :", mem.title);
      console.log(`tail marker ("${c.tailMarker}") in extracted text:`, tailFound);
    }
    const caseOk = ready && cap?.mime === c.mime && (tailFound === null || tailFound === true);
    if (!caseOk) allOk = false;
    console.log(caseOk ? "OK" : "FAILED");

    if (REAL && mem) {
      const { getEmbedder } = await import("../lib/ai");
      const { searchChunks } = await import("../lib/db/queries");
      const [qvec] = await getEmbedder().embed([c.tailMarker]);
      const hits = await searchChunks(u.id, qvec, { limit: 5 });
      const top = hits[0];
      const hitOk = !!top && top.memoryId === mem.id;
      console.log(
        "retrieval for tail marker → top hit:",
        top ? `${top.title} (sim ${top.sim.toFixed(3)})` : "none",
        hitOk ? "(correct memory)" : "(WRONG memory)",
      );
      if (!hitOk) allOk = false;
    }
  }

  console.log(
    allOk ? "\n\x1b[32mDocument pipeline OK.\x1b[0m\n" : "\n\x1b[31mSomething did not complete.\x1b[0m\n",
  );
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
