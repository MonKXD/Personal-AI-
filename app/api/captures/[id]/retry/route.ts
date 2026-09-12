import { after, NextResponse } from "next/server";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import { getCapture, setCaptureStatus } from "@/lib/db/queries";
import { runPipeline } from "@/lib/pipeline/run";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireApiUser({ write: true });
    const { id } = await ctx.params;

    const cap = await getCapture(user.id, id);
    if (!cap) throw new HttpError(404, "not_found", "Capture not found.");
    if (cap.status !== "failed") {
      throw new HttpError(409, "not_retryable", "This capture isn't in a failed state.");
    }

    await setCaptureStatus(id, "queued");
    after(() => runPipeline(id));
    return NextResponse.json({ id, status: "queued" }, { status: 202 });
  },
);
