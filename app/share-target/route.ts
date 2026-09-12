import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createCaptureFromServerBytes } from "@/lib/pipeline/create-capture";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Handles the OS "Share to MirrorMind" sheet (see share_target in
 * app/manifest.ts). This is a top-level browser navigation, not a fetch —
 * failures redirect back into the app rather than returning JSON.
 */
export async function POST(req: Request) {
  const site = new URL(req.url).origin;
  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(`${site}/sign-in?next=/capture`, 303);
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.redirect(`${site}/capture`, 303);
    }
    const result = await createCaptureFromServerBytes(user, file, { source: "share" });
    return NextResponse.redirect(`${site}/capture?processing=${result.id}`, 303);
  } catch {
    return NextResponse.redirect(`${site}/capture`, 303);
  }
}
