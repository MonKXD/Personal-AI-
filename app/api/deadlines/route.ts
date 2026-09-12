import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireApiUser } from "@/lib/http";
import { computeDeadlinePriority } from "@/lib/ai/types";
import { insertDeadline, listDeadlines } from "@/lib/db/queries";
import { newId } from "@/lib/ids";

export const runtime = "nodejs";

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const before = url.searchParams.get("before");
  const rows = await listDeadlines(user.id, {
    status: status === "pending" || status === "done" ? status : undefined,
    before: before ? new Date(before) : undefined,
  });
  return NextResponse.json({
    deadlines: rows.map((d) => ({
      id: d.id,
      title: d.title,
      dueAt: d.dueAt,
      status: d.status,
      priority: computeDeadlinePriority(d.dueAt),
      source: d.source,
      sourceRefId: d.sourceRefId,
      confidence: d.confidence,
    })),
  });
});

const addSchema = z.object({
  title: z.string().min(1).max(200),
  dueDate: z.string(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser({ write: true });
  const { title, dueDate } = addSchema.parse(await req.json());
  const dueAt = new Date(dueDate);
  if (Number.isNaN(dueAt.getTime())) {
    return NextResponse.json({ error_code: "invalid_date", message: "dueDate is not a valid date." }, { status: 400 });
  }
  const id = newId();
  await insertDeadline({ id, userId: user.id, title, dueAt, source: "manual" });
  return NextResponse.json({ id, title, dueAt, status: "pending" }, { status: 201 });
});
