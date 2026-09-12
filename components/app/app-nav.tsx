"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  Camera,
  Clock3,
  FolderTree,
  LayoutGrid,
  MessageCircle,
  MessagesSquare,
  Phone,
  Share2,
  Sun,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const APP_NAV = [
  { href: "/capture", label: "Capture", icon: Camera },
  { href: "/timeline", label: "Timeline", icon: LayoutGrid },
  { href: "/folders", label: "Folders", icon: FolderTree },
  { href: "/graph", label: "Graph", icon: Share2 },
  { href: "/chat", label: "Chat", icon: MessagesSquare },
  { href: "/today", label: "Today", icon: Sun },
  { href: "/deadlines", label: "Deadlines", icon: Clock3 },
  { href: "/finance", label: "Finance", icon: Wallet },
  { href: "/calls", label: "Calls", icon: Phone },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
] as const;

export function AppNav({
  orientation = "vertical",
  onNavigate,
}: {
  orientation?: "vertical" | "horizontal";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav
      className={cn(
        orientation === "vertical" ? "flex flex-col gap-1" : "flex items-center gap-1",
      )}
    >
      {APP_NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              active
                ? "font-semibold text-violet-bright"
                : "font-normal text-foreground/80 hover:bg-accent",
            )}
          >
            {active && (
              <motion.span
                layoutId="app-nav-active"
                className="absolute inset-0 -z-10 rounded-lg bg-[var(--tint-violet)]"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <Icon
              className={cn(
                "size-4 shrink-0 transition-transform duration-200",
                "group-hover:scale-110 group-active:scale-95",
              )}
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
