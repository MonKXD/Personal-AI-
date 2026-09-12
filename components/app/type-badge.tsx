import { Badge } from "@/components/ui/badge";
import { MEMORY_TYPE_META, type MemoryType } from "@/lib/memory-types";
import { cn } from "@/lib/utils";

export function TypeBadge({
  type,
  className,
}: {
  type: MemoryType;
  className?: string;
}) {
  const { label, icon: Icon } = MEMORY_TYPE_META[type];
  return (
    <Badge variant="secondary" className={cn("gap-1.5", className)}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}
