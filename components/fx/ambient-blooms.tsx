/**
 * Two large, soft colour blooms that drift very slowly behind the app —
 * the "warm room" atmosphere from the redesign. Pure CSS animation
 * (`--animate-bloom-drift`), pointer-events off, and paused entirely under
 * `prefers-reduced-motion` via the global rule in globals.css.
 */
export function AmbientBlooms() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -left-[15%] -top-[10%] size-[46vw] rounded-full blur-[110px] animate-[bloom-drift_42s_ease-in-out_infinite]"
        style={{ background: "var(--bloom-1)" }}
      />
      <div
        className="absolute -bottom-[18%] -right-[12%] size-[42vw] rounded-full blur-[120px] animate-[bloom-drift_53s_ease-in-out_infinite_reverse]"
        style={{ background: "var(--bloom-2)" }}
      />
    </div>
  );
}
