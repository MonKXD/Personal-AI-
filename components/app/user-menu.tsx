"use client";

import * as React from "react";
import { LifeBuoy, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FeedbackDialog } from "@/components/app/feedback-dialog";

export function UserMenu({
  name,
  email,
  initials,
  avatarUrl,
}: {
  name: string;
  email: string;
  initials: string;
  avatarUrl?: string | null;
}) {
  const [reportOpen, setReportOpen] = React.useState(false);
  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="ring-1 ring-border">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium text-foreground">{name}</div>
          <div className="truncate text-xs text-muted-foreground">{email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => (e.preventDefault(), setReportOpen(true))}>
          <LifeBuoy /> Report a problem
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" asChild>
          <form action="/auth/sign-out" method="post" className="w-full">
            <button type="submit" className="flex w-full items-center gap-2">
              <LogOut /> Sign out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <FeedbackDialog open={reportOpen} onOpenChange={setReportOpen} />
    </>
  );
}
