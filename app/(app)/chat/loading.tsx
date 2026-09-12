import { AppPage } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AppPage className="max-w-3xl py-4">
      <div className="flex h-[calc(100dvh-8rem)] gap-4 lg:h-[calc(100dvh-6rem)]">
        <div className="hidden w-60 shrink-0 space-y-2 border-r border-border pr-3 lg:block">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Skeleton className="size-12 rounded-xl" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
    </AppPage>
  );
}
