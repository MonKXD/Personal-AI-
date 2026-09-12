import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSharedMemory } from "@/lib/db/queries";
import { signImageUrl } from "@/lib/storage";
import { isImageThumbUrl, absoluteTime } from "@/lib/utils";
import { MEMORY_TYPE_META, type MemoryType } from "@/lib/memory-types";
import { Logo } from "@/components/brand/logo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}): Promise<Metadata> {
  const { shareId } = await params;
  const mem = await getSharedMemory(shareId);
  if (!mem) return { title: "Not found · Personal AI" };
  const title = mem.title || "Shared memory";
  return {
    title: `${title} · Personal AI`,
    description: mem.summary || undefined,
    robots: { index: false },
    openGraph: { title, description: mem.summary || undefined, type: "article" },
    twitter: { card: "summary", title, description: mem.summary || undefined },
  };
}

export default async function SharedMemoryPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const mem = await getSharedMemory(shareId);
  if (!mem) notFound();

  const meta = MEMORY_TYPE_META[mem.type as MemoryType] ?? MEMORY_TYPE_META.other;
  const Icon = meta.icon;
  const typeVar = `var(--type-${mem.type})`;
  const thumb = await signImageUrl(mem.thumbKey).catch(() => null);
  const showImg = isImageThumbUrl(thumb);

  return (
    <main className="bg-cosmic min-h-dvh">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:py-16">
        <header className="mb-8 flex items-center justify-between">
          <Logo href="/" size={26} />
          <Link
            href="/"
            className="rounded-full border border-border bg-muted px-3 py-1.5 font-body text-xs text-muted-foreground transition-colors hover:border-violet/40"
          >
            What is this?
          </Link>
        </header>

        <article className="overflow-hidden rounded-3xl border border-border bg-muted p-6 shadow-pop sm:p-8">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider"
            style={{ color: typeVar, background: `color-mix(in oklab, ${typeVar} 14%, transparent)` }}
          >
            <Icon className="size-3" />
            {meta.label}
          </div>

          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {mem.title || "Untitled memory"}
          </h1>
          <p className="mt-1.5 font-mono text-xs text-muted-foreground/70">
            captured {absoluteTime(mem.capturedAt)}
          </p>

          {mem.summary && (
            <p className="mt-5 font-body text-[15px] leading-relaxed text-foreground/80">{mem.summary}</p>
          )}

          {showImg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb!}
              alt=""
              className="mt-6 w-full rounded-2xl border border-border object-contain"
            />
          )}

          {mem.text && (
            <div className="mt-6 border-t border-dashed border-border pt-5">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                Full text
              </div>
              <pre className="whitespace-pre-wrap font-body text-[13.5px] leading-relaxed text-muted-foreground">
                {mem.text}
              </pre>
            </div>
          )}
        </article>

        <footer className="mt-8 text-center">
          <Link
            href="/"
            className="font-body text-sm text-muted-foreground transition-colors hover:text-violet-bright"
          >
            Remembered with <span className="font-semibold text-foreground/80">Personal AI</span> —
            capture what you see, ask about it later &rarr;
          </Link>
        </footer>
      </div>
    </main>
  );
}
