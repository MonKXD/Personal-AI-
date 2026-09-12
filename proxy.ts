import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js "proxy" convention (formerly middleware). Refreshes the Supabase
 * session on every request and gates the authenticated app.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.svg|apple-icon.png|icon.png|.*\\.(?:svg|png|jpg|jpeg|webp|gif)$).*)",
  ],
};
