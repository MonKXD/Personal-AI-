import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireApiUser } from "@/lib/http";
import { beginCaptureUpload } from "@/lib/pipeline/create-capture";

export const runtime = "nodejs";
export const maxDuration = 30;

const beginSchema = z.object({
  mime: z.string().min(1).max(200),
  sha256: z.string().min(32).max(128),
  bytes: z.number().int().positive(),
});

/** Step 1 of 2 for a capture: auth + daily cap + dedupe, then mint a signed
 * Storage upload URL. The browser PUTs the file straight to Storage next,
 * then calls POST /api/captures (finish) with a small JSON body. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser({ write: true });
  const body = beginSchema.parse(await req.json());
  const result = await beginCaptureUpload(user, body);
  return NextResponse.json(result);
});
