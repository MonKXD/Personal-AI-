import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import {
  deleteFolder,
  moveFolder,
  renameFolder,
  updateFolderStyle,
} from "@/lib/db/queries";

export const runtime = "nodejs";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    parentId: z.string().max(40).nullable().optional(), // null = move to top level
    color: z.string().max(9).nullable().optional(),
    emoji: z.string().max(8).nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "Nothing to update." });

export const PATCH = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireApiUser({ write: true });
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());

    if (body.name !== undefined) {
      const r = await renameFolder(user.id, id, body.name);
      if (!r.ok) throw new HttpError(409, "folder_error", r.error ?? "Not found.");
    }
    if (body.parentId !== undefined) {
      const r = await moveFolder(user.id, id, body.parentId);
      if (!r.ok) throw new HttpError(409, "folder_error", r.error ?? "Not found.");
    }
    if (body.color !== undefined || body.emoji !== undefined) {
      await updateFolderStyle(user.id, id, {
        ...(body.color !== undefined ? { color: body.color } : {}),
        ...(body.emoji !== undefined ? { emoji: body.emoji } : {}),
      });
    }
    return NextResponse.json({ ok: true });
  },
);

export const DELETE = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireApiUser({ write: true });
    const { id } = await ctx.params;
    await deleteFolder(user.id, id);
    return new NextResponse(null, { status: 204 });
  },
);
