import type { Metadata } from "next";
import { Orb } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="bg-cosmic flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Orb size={64} glow="sm" />
      <div>
        <h1 className="font-display text-xl font-bold text-foreground">You&rsquo;re offline</h1>
        <p className="mt-2 max-w-xs font-body text-sm text-muted-foreground">
          Personal AI needs a connection to read and remember new captures.
          Reconnect and try again.
        </p>
      </div>
    </div>
  );
}
