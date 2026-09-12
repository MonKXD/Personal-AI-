import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  accent,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Violet accent line below the title (e.g. "4 things remembered today"). */
  accent?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div>
        {eyebrow && (
          <div className="font-body text-[13px] text-muted-foreground/70">{eyebrow}</div>
        )}
        <h1 className="font-display mt-0.5 text-[28px] font-bold leading-[1.1] tracking-tight text-foreground sm:text-[32px]">
          {title}
        </h1>
        {accent && (
          <p className="mt-1 font-body text-sm font-medium text-violet-bright">
            {accent}
          </p>
        )}
        {description && !accent && (
          <p className="mt-1 font-body text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function AppPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("container-px mx-auto w-full max-w-5xl py-8", className)}>
      {children}
    </div>
  );
}
