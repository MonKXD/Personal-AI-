"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import {
  listNotifications,
  markNotificationsRead,
  type AppNotification,
} from "@/lib/api-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { relativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function NotificationBell({ className }: { className?: string }) {
  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [wobble, setWobble] = React.useState(false);
  const prevUnread = React.useRef(0);
  const loaded = React.useRef(false);

  const refresh = React.useCallback(() => {
    listNotifications()
      .then((r) => {
        setItems(r.items);
        setUnread(r.unread);
        if (loaded.current && r.unread > prevUnread.current) {
          setWobble(true);
          window.setTimeout(() => setWobble(false), 600);
        }
        prevUnread.current = r.unread;
        loaded.current = true;
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      setItems((xs) => xs.map((x) => ({ ...x, read: true })));
      await markNotificationsRead().catch(() => {});
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/80",
            className,
          )}
          aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        >
          <Bell
            className={cn("size-4.5 origin-top", wobble && "animate-[wobble_0.5s_var(--ease-spring)]")}
          />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-violet px-1 text-[10px] font-bold text-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="font-display text-sm font-semibold text-foreground/80">Notifications</span>
          {items.length > 0 && (
            <span className="flex items-center gap-1 font-body text-[11px] text-muted-foreground/70">
              <CheckCheck className="size-3" /> all read
            </span>
          )}
        </div>
        <div className="max-h-[22rem] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center font-body text-xs text-muted-foreground/70">
              Nothing yet. Deadlines and weekly recaps show up here.
            </p>
          ) : (
            items.map((n) => {
              const inner = (
                <div
                  className={cn(
                    "border-b border-border px-3 py-2.5 transition-colors",
                    n.href && "hover:bg-accent",
                    !n.read && "bg-violet/[0.05]",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-violet-bright" />
                    )}
                    <div className="min-w-0">
                      <p className="font-body text-[13px] font-medium text-foreground/80">{n.title}</p>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 font-body text-xs text-muted-foreground">{n.body}</p>
                      )}
                      <p className="mt-1 font-body text-[10px] text-muted-foreground/70">
                        {relativeTime(n.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
              return n.href ? (
                <Link key={n.id} href={n.href} onClick={() => setOpen(false)}>
                  {inner}
                </Link>
              ) : (
                <div key={n.id}>{inner}</div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
