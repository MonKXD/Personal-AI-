import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireApiUser } from "@/lib/http";
import { setMemoryFolder } from "@/lib/db/queries";

export const runtime = "nodejs";

const bodySchema = z.object({
  memoryIds: z.array(z.string().min(1).max(40)).min(1).max(200),
  folderId: z.string().max(40).nullable(), // null = Unfiled
});

/** Move one or many memories into a folder (or Unfiled). */
export const PATCH = handle(async (req: Request) => {
  const user = await requireApiUser({ write: true });
  const { memoryIds, folderId } = bodySchema.parse(await req.json());
  const moved = await setMemoryFolder(user.id, memoryIds, folderId);
  return NextResponse.json({ moved });
});
