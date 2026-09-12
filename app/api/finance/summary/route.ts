import { NextResponse } from "next/server";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import { getSpendingSummary } from "@/lib/db/queries";

export const runtime = "nodejs";

const MONTH_RE = /^\d{4}-\d{2}$/;

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  const month = new URL(req.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!MONTH_RE.test(month)) {
    throw new HttpError(400, "invalid_month", "month must be YYYY-MM.");
  }
  const categories = await getSpendingSummary(user.id, month);
  const total = categories.reduce((sum, c) => sum + Number(c.total), 0);
  return NextResponse.json({ month, total, categories });
});
