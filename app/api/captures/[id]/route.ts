import { NextResponse } from "next/server";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import { getCapture } from "@/lib/db/queries";

export const runtime = "nodejs";

export const GET = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const cap = await getCapture(user.id, id);
    if (!cap) throw new HttpError(404, "not_found", "Capture not found.");
    return NextResponse.json({
      id: cap.id,
      status: cap.status,
      errorCode: cap.errorCode,
      // Owner-only; short and secret-free. Helps diagnose a failed capture.
      errorDetail: cap.status === "failed" ? (cap.errorDetail ?? null) : null,
      memoryId: cap.memoryId,
      capturedAt: cap.capturedAt,
      updatedAt: cap.updatedAt,
    });
  },
);
