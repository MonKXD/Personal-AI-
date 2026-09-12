"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Plus, Search } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { AppNav } from "@/components/app/app-nav";
import { UserMenu } from "@/components/app/user-menu";
import { MobileTabBar } from "@/components/app/mobile-tab-bar";
import { CommandPalette, OPEN_COMMAND_PALETTE_EVENT } from "@/components/app/command-palette";
import { NotificationBell } from "@/components/app/notification-bell";
import { KeyboardShortcuts } from "@/components/app/keyboard-shortcuts";
import { AmbientBlooms } from "@/components/fx/ambient-blooms";

type ShellUser = {
  name: string;
  email: string;
  initials: string;
  avatarUrl?: string | null;
};

export function AppShell({
  user,
  todayCount,
  children,
}: {
  user: ShellUser;
  todayCount: number;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="bg-cosmic min-h-dvh lg:grid lg:grid-cols-[268px_1fr]">
      <AmbientBlooms />
      <KeyboardShortcuts />
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-card lg:flex">
        <div className="flex items-center justify-between px-5 pb-4 pt-6">
          <Logo href="/capture" withTagline tagline="One assistant, fully cited" />
          <NotificationBell className="-mr-1.5" />
        </div>
        <div className="px-4 pb-2">
          <Button asChild className="mb-2.5 w-full justify-start gap-2">
            <Link href="/capture">
              <Plus className="size-4" /> New capture
            </Link>
          </Button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))}
            className="flex w-full items-center gap-2 rounded-md border border-input bg-muted px-3 py-2.5 font-body text-[13px] text-muted-foreground/80 transition-colors hover:bg-accent"
          >
            <Search className="size-3.5" />
            Search your memory…
            <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px]">
              ⌘K
            </kbd>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <AppNav />
        </div>
        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center gap-2 px-1 text-[12px] text-muted-foreground">
            <span className="size-1.5 shrink-0 rounded-full bg-success" />
            <span>
              <strong className="font-semibold text-foreground">
                {todayCount} {todayCount === 1 ? "memory" : "memories"} today
              </strong>{" "}
              · All synced
            </span>
          </div>
          <div className="flex items-center gap-3 px-1">
            <UserMenu {...user} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile */}
      <div className="bg-cosmic flex flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-md lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetTitle>
                <Logo href={null} withTagline tagline="One assistant, fully cited" />
              </SheetTitle>
              <div className="mt-5">
                <Button
                  asChild
                  className="w-full justify-start gap-2"
                  onClick={() => setMobileOpen(false)}
                >
                  <Link href="/capture">
                    <Plus className="size-4" /> New capture
                  </Link>
                </Button>
              </div>
              <div className="mt-4">
                <AppNav onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <Logo href="/capture" size={26} />
          <div className="flex items-center gap-1">
            <NotificationBell />
            <UserMenu {...user} />
          </div>
        </header>

        <main className="flex-1 pb-20 lg:pb-0">{children}</main>
        <MobileTabBar />
      </div>

      <CommandPalette />
    </div>
  );
}
