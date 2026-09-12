import { NextResponse } from "next/server";
import { handle, requireApiUser } from "@/lib/http";
import { listActionItems } from "@/lib/db/queries";

export const runtime = "nodejs";

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  const status = new URL(req.url).searchParams.get("status");
  const rows = await listActionItems(user.id, {
    status:
      status === "open" || status === "done" || status === "dismissed"
        ? status
        : undefined,
  });
  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      dueAt: r.dueAt,
      status: r.status,
      memoryId: r.memoryId,
      memoryTitle: r.memoryTitle,
    })),
  });
});
