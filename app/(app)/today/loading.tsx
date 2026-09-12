import { AppPage } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AppPage>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="mt-2 h-4 w-48" />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    </AppPage>
  );
}
