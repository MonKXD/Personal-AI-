import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireApiUser } from "@/lib/http";
import { addFinanceTransaction, listFinanceTransactions } from "@/lib/db/queries";
import { newId } from "@/lib/ids";

export const runtime = "nodejs";

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  const url = new URL(req.url);
  const category = url.searchParams.get("category") ?? undefined;
  const source = url.searchParams.get("source");
  const rows = await listFinanceTransactions(user.id, {
    category,
    source: source === "manual" || source === "statement_upload" ? source : undefined,
  });
  return NextResponse.json({ transactions: rows });
});

const addSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  amount: z.number().positive(),
  direction: z.enum(["income", "expense"]),
  category: z.string().min(1).max(60),
  note: z.string().max(500).optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser({ write: true });
  const body = addSchema.parse(await req.json());
  const id = newId();
  await addFinanceTransaction({
    id,
    userId: user.id,
    occurredOn: body.date,
    amount: body.amount.toFixed(2),
    direction: body.direction,
    category: body.category,
    note: body.note ?? null,
    source: "manual",
  });
  return NextResponse.json({ id, ...body }, { status: 201 });
});
