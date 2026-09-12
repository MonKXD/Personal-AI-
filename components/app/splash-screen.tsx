import { Orb } from "@/components/brand/logo";

export function SplashScreen() {
  return (
    <div className="bg-cosmic fixed inset-0 z-50 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-12 size-[360px] rounded-full blur-[72px]"
        style={{ background: "radial-gradient(circle, color-mix(in srgb,var(--primary) 32%,transparent), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-28 size-[300px] rounded-full blur-[72px]"
        style={{ background: "radial-gradient(circle, rgba(6,182,212,.18), transparent 70%)" }}
      />

      <div className="relative flex h-full flex-col items-center justify-center gap-9">
        <Orb size={190} glow="lg" />

        <div className="animate-fade-in-up text-center [animation-delay:0.4s] [animation-fill-mode:both]">
          <div className="text-gradient font-display text-[40px] font-bold leading-[1.04] tracking-[-0.045em]">
            Personal AI
          </div>
          <div className="mt-2.5 font-body text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Your AI Memory
          </div>
        </div>

        <div className="animate-fade-in-up flex items-center gap-2.5 [animation-delay:0.9s] [animation-fill-mode:both]">
          <span className="size-1.5 animate-[dot-pulse_1.4s_ease-in-out_infinite] rounded-full bg-violet" />
          <span className="size-1.5 animate-[dot-pulse_1.4s_ease-in-out_0.28s_infinite] rounded-full bg-violet" />
          <span className="size-1.5 animate-[dot-pulse_1.4s_ease-in-out_0.56s_infinite] rounded-full bg-violet" />
        </div>
      </div>
    </div>
  );
}
