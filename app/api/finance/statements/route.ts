import { NextResponse } from "next/server";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import { getFinanceCategorizer } from "@/lib/ai";
import {
  createStatementBatch,
  finishStatementBatch,
  insertFinanceTransactionsBatch,
  listStatementBatches,
} from "@/lib/db/queries";
import { newId } from "@/lib/ids";
import { extractPdfText, parseStatementCsv, parseStatementPdfText } from "@/lib/finance/parse-statement";
import { reportError } from "@/lib/observe";

export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = handle(async () => {
  const user = await requireApiUser();
  const batches = await listStatementBatches(user.id);
  return NextResponse.json({ batches });
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser({ write: true });
  const form = await req.formData();
  const file = form.get("file");
  const accountLabel = String(form.get("accountLabel") ?? "").trim();
  if (!(file instanceof Blob) || file.size === 0) {
    throw new HttpError(400, "missing_file", "Upload a CSV or PDF statement file.");
  }
  if (!accountLabel) {
    throw new HttpError(400, "missing_account_label", "Label which account this statement is from.");
  }

  const batchId = newId();
  const fileName = file instanceof File ? file.name : "statement";
  await createStatementBatch({ id: batchId, userId: user.id, accountLabel, fileName });

  try {
    const isPdf = fileName.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    const buf = Buffer.from(await file.arrayBuffer());

    const parsedRows = isPdf
      ? await parseStatementPdfText(await extractPdfText(buf))
      : parseStatementCsv(buf.toString("utf-8"));

    if (parsedRows.length === 0) {
      await finishStatementBatch(batchId, {
        status: "failed",
        rowCount: 0,
        errorDetail: "No transaction rows could be extracted from this file.",
      });
      return NextResponse.json(
        { error_code: "no_rows_parsed", message: "No transaction rows could be extracted from this file." },
        { status: 422 },
      );
    }

    const categorizer = getFinanceCategorizer();
    const withRefs = parsedRows.map((r, i) => ({ ...r, ref: String(i) }));
    const categories = await categorizer.categorize(
      withRefs.map((r) => ({
        ref: r.ref,
        date: r.date,
        amount: r.amount,
        direction: r.direction,
        merchant: r.merchant ?? undefined,
      })),
    );
    const categoryByRef = new Map(categories.map((c) => [c.ref, c]));

    const inserted = await insertFinanceTransactionsBatch(
      withRefs.map((r) => {
        const cat = categoryByRef.get(r.ref);
        return {
          id: newId(),
          userId: user.id,
          occurredOn: r.date,
          amount: r.amount.toFixed(2),
          direction: r.direction,
          category: cat?.category ?? "Other",
          categoryConfidence: cat?.confidence ?? null,
          merchant: r.merchant,
          source: "statement_upload" as const,
          statementBatchId: batchId,
        };
      }),
    );

    await finishStatementBatch(batchId, { status: "done", rowCount: inserted });
    return NextResponse.json({ batchId, rowsParsed: parsedRows.length, rowsInserted: inserted });
  } catch (e) {
    reportError(e, { where: "finance/statements upload", batchId });
    await finishStatementBatch(batchId, {
      status: "failed",
      rowCount: 0,
      errorDetail: e instanceof Error ? e.message : String(e),
    });
    throw new HttpError(500, "statement_parse_failed", "Couldn't process that statement file.");
  }
});
