import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import { createFolder, countUnfiledMemories, listFolders } from "@/lib/db/queries";

export const runtime = "nodejs";

export const GET = handle(async () => {
  const user = await requireApiUser();
  const [rows, unfiled] = await Promise.all([
    listFolders(user.id),
    countUnfiledMemories(user.id),
  ]);
  return NextResponse.json({
    folders: rows.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      name: r.name,
      position: r.position,
      count: r.count,
    })),
    unfiledCount: unfiled,
  });
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  parentId: z.string().max(40).nullish(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser({ write: true });
  const { name, parentId } = createSchema.parse(await req.json());
  const res = await createFolder(user.id, { name, parentId: parentId ?? null });
  if ("error" in res) throw new HttpError(409, "folder_error", res.error);
  return NextResponse.json({ id: res.id, name }, { status: 201 });
});
