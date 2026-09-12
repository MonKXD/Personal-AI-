import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { recoverStuckGlobal } from "@/lib/pipeline/recover";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Vercel Cron backstop for stuck captures. Auth: `Authorization: Bearer <CRON_SECRET>`. */
export async function GET(req: NextRequest) {
  const secret = getEnv().CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error_code: "unauthorized" }, { status: 401 });
    }
  }
  const result = await recoverStuckGlobal();
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}
