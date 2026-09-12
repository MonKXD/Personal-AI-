import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import { setDeadlineStatus } from "@/lib/db/queries";

export const runtime = "nodejs";

const patchSchema = z.object({ status: z.enum(["pending", "done"]) });

export const PATCH = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireApiUser({ write: true });
    const { id } = await ctx.params;
    const { status } = patchSchema.parse(await req.json());
    const ok = await setDeadlineStatus(user.id, id, status);
    if (!ok) throw new HttpError(404, "not_found", "Deadline not found.");
    return NextResponse.json({ ok: true, status });
  },
);
