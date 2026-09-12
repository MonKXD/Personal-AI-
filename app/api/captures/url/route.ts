import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireApiUser } from "@/lib/http";
import { createCaptureFromUrl } from "@/lib/pipeline/create-capture";

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = z.object({ url: z.string().trim().min(4).max(2000) });

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser({ write: true });
  const { url } = schema.parse(await req.json());
  const res = await createCaptureFromUrl(user.id, url);
  return NextResponse.json(res, { status: res.deduped ? 200 : 202 });
});
