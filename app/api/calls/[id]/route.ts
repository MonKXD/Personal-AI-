import { NextResponse } from "next/server";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import { getCall } from "@/lib/db/queries";

export const runtime = "nodejs";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const call = await getCall(user.id, id);
  if (!call) throw new HttpError(404, "not_found", "Call not found.");
  return NextResponse.json({ call });
});
