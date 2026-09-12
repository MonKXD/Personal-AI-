import { AppPage } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AppPage>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    </AppPage>
  );
}
