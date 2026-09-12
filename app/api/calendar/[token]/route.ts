import { listActionItems, userIdForCalendarToken } from "@/lib/db/queries";
import { buildIcs, type IcsItem } from "@/lib/ics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public calendar feed — a calendar app subscribes to
 * webcal://<host>/api/calendar/<token>. No auth: the token is the secret
 * (52 random chars). Emits one all-day VEVENT per action item with a due
 * date; dismissed items are skipped, done items get a ✓ and no alarm.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const userId = await userIdForCalendarToken(token);
  if (!userId) {
    return new Response("Calendar not found.", { status: 404 });
  }

  const items = await listActionItems(userId, {});
  const events: IcsItem[] = items
    .filter((i) => i.dueAt && i.status !== "dismissed")
    .map((i) => ({
      id: i.id,
      title: i.title,
      due: i.dueAt as Date,
      memoryTitle: i.memoryTitle ?? null,
      done: i.status === "done",
    }));

  return new Response(buildIcs(events, "Personal AI deadlines"), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="personal-ai.ics"',
      "cache-control": "public, max-age=1800",
    },
  });
}
