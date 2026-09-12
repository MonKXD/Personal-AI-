"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTS = [
  { v: "system", label: "System", icon: Monitor },
  { v: "light", label: "Light", icon: Sun },
  { v: "dark", label: "Dark", icon: Moon },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  // next-themes hydration guard: value is only known client-side.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), []);
  const current = mounted ? theme ?? "light" : "light";

  return (
    <div className="flex items-center justify-between gap-4 font-body text-sm">
      <span className="text-muted-foreground">Theme</span>
      <div className="inline-flex gap-1 rounded-full bg-secondary p-1">
        {OPTS.map(({ v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => setTheme(v)}
            aria-pressed={current === v}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              current === v
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground/80",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
