"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, LayoutGrid, MessagesSquare, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const SIDE_LEFT = [
  { href: "/timeline", label: "Timeline", icon: LayoutGrid },
  { href: "/chat", label: "Chat", icon: MessagesSquare },
] as const;
const SIDE_RIGHT = [{ href: "/today", label: "Today", icon: Sun }] as const;

/** Bottom tab bar for mobile — floating violet Capture button in the middle. */
export function MobileTabBar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-20 items-center justify-around border-t border-border bg-[#05030f]/96 pb-2 backdrop-blur-2xl lg:hidden"
      aria-label="Primary"
    >
      {SIDE_LEFT.map((item) => (
        <TabLink key={item.href} {...item} active={isActive(item.href)} />
      ))}

      <Link
        href="/capture"
        aria-label="Capture"
        className="relative -mt-7 flex flex-1 flex-col items-center"
      >
        <span
          className={cn(
            "grid size-[60px] place-items-center rounded-full bg-[image:var(--brand-grad)] shadow-[0_4px_22px_color-mix(in srgb,var(--primary) 65%,transparent),0_0_0_4px_var(--color-background)] transition-shadow",
            isActive("/capture") && "shadow-[0_6px_30px_color-mix(in srgb,var(--primary) 85%,transparent),0_0_0_4px_var(--color-background)]",
          )}
        >
          <Camera className="size-[26px] text-foreground" strokeWidth={1.8} />
        </span>
        <span className="mt-1.5 font-body text-[10px] font-medium text-muted-foreground">Capture</span>
      </Link>

      {SIDE_RIGHT.map((item) => (
        <TabLink key={item.href} {...item} active={isActive(item.href)} />
      ))}
    </nav>
  );
}

function TabLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="flex flex-1 flex-col items-center gap-1 pt-2 transition-opacity active:opacity-70"
    >
      <Icon
        className={cn("size-6", active ? "text-violet-bright" : "text-muted-foreground/70")}
        strokeWidth={1.8}
      />
      <span
        className={cn(
          "font-body text-[10px] font-semibold",
          active ? "text-violet-bright" : "text-muted-foreground/70",
        )}
      >
        {label}
      </span>
    </Link>
  );
}
