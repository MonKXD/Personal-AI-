import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { graphData } from "@/lib/db/queries";
import { AppPage, PageHeader } from "@/components/app/page-header";
import { MemoryGraph } from "@/components/app/memory-graph";

export const metadata: Metadata = { title: "Graph" };
export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const user = await requireUser("/graph");
  const { nodes, edges } = await graphData(user.id);

  return (
    <AppPage>
      <PageHeader
        title="Graph"
        description="How your memories connect — Personal AI links related captures automatically."
      />
      <div className="mt-6">
        <MemoryGraph nodes={nodes} edges={edges} />
      </div>
    </AppPage>
  );
}
