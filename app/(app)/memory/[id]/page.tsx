import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, ExternalLink, FileText, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getMemoryDetail, listFolderPaths, listLinkedMemories } from "@/lib/db/queries";
import { signImageUrl, signImageUrls } from "@/lib/storage";
import { AppPage } from "@/components/app/page-header";
import { FolderSuggestionChip } from "@/components/app/folder-suggestion-chip";
import { Button } from "@/components/ui/button";
import { ConfidenceDot } from "@/components/app/confidence-dot";
import { StructuredCard } from "@/components/app/structured-card";
import { MemoryActions } from "@/components/app/memory-actions";
import { TagEditor } from "@/components/app/tag-editor";
import { RelatedMemories } from "@/components/app/related-memories";
import { ImageLightbox } from "@/components/app/image-lightbox";
import { TextCorrector } from "@/components/app/text-corrector";
import { absoluteTime, relativeTime, isImageThumbUrl } from "@/lib/utils";
import { MEMORY_TYPE_META, type MemoryType, type ConfidenceBand } from "@/lib/memory-types";

export const metadata: Metadata = { title: "Memory" };
export const dynamic = "force-dynamic";

const ENTITY_GROUPS: { label: string; kinds: string[] }[] = [
  { label: "Dates", kinds: ["date", "time", "deadline"] },
  { label: "People", kinds: ["person"] },
  { label: "Places", kinds: ["place", "organization"] },
  { label: "Contacts", kinds: ["contact_email", "contact_phone"] },
  { label: "Topics", kinds: ["subject", "term"] },
  { label: "Links", kinds: ["url"] },
];

export default async function MemoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const detail = await getMemoryDetail(user.id, id);
  if (!detail) notFound();

  const [displayUrl, linked, folderPaths] = await Promise.all([
    signImageUrl(detail.capture.displayKey),
    listLinkedMemories(user.id, id),
    listFolderPaths(user.id),
  ]);
  const linkedThumbUrls = await signImageUrls(linked.map((m) => m.thumbKey));
  const { memory, entities, tags, actionItems } = detail;

  // Uploaded documents (PDF / Word / PowerPoint) keep their original file in
  // Storage — surface a link to open it. `displayKey` may point at a
  // rendered page-1 JPEG, so always sign `originalKey` for the real file.
  const docKind =
    detail.capture.mime === "application/pdf"
      ? "PDF"
      : detail.capture.mime.includes("wordprocessingml")
        ? "Word document"
        : detail.capture.mime.includes("presentationml")
          ? "PowerPoint"
          : null;
  const originalUrl = docKind ? await signImageUrl(detail.capture.originalKey) : null;
  const suggestedPath =
    memory.suggestedFolderId && !memory.folderId
      ? folderPaths.find((f) => f.id === memory.suggestedFolderId)?.path
      : undefined;
  const text = memory.correctedText ?? memory.text;
  const type = memory.type as MemoryType;
  const { icon: Icon, label: typeLabel } = MEMORY_TYPE_META[type];
  const typeVar = `var(--type-${type})`;

  return (
    <AppPage>
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/timeline">
            <ArrowLeft /> Timeline
          </Link>
        </Button>
        <MemoryActions memoryId={memory.id} text={text} folderId={memory.folderId ?? null} shared={!!memory.shareId} pinned={!!memory.pinnedAt} />
      </div>

      {suggestedPath && memory.suggestedFolderId && (
        <div className="mt-3">
          <FolderSuggestionChip
            memoryId={memory.id}
            folderId={memory.suggestedFolderId}
            path={suggestedPath}
          />
        </div>
      )}

      <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Image / audio */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            {type === "voice_note" ? (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-5 p-8">
                <span className="grid size-16 place-items-center rounded-full bg-violet/12 text-violet-bright">
                  <Icon className="size-7" />
                </span>
                {displayUrl && <audio controls src={displayUrl} className="w-full max-w-xs" />}
              </div>
            ) : isImageThumbUrl(displayUrl) ? (
              <ImageLightbox src={displayUrl!} alt={memory.title || "Captured image"} />
            ) : detail.capture.mime.startsWith("image/") ? (
              <div className="aspect-[3/4]" />
            ) : (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-4 p-8">
                <span className="grid size-16 place-items-center rounded-full bg-violet/12 text-violet-bright">
                  <FileText className="size-7" />
                </span>
                <p className="font-body text-sm text-muted-foreground">
                  {detail.capture.mime === "application/pdf"
                    ? "PDF document"
                    : detail.capture.mime.includes("wordprocessingml")
                      ? "Word document"
                      : detail.capture.mime.includes("presentationml")
                        ? "PowerPoint presentation"
                        : detail.capture.sourceUrl
                          ? "Web page"
                          : "Document"}
                </p>
                {detail.capture.sourceUrl && (
                  <a
                    href={detail.capture.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="max-w-full truncate font-body text-xs text-violet-bright hover:underline"
                  >
                    {detail.capture.sourceUrl.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
            )}
          </div>

          {docKind && originalUrl && (
            <a
              href={originalUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-body text-sm text-foreground shadow-card transition-colors hover:border-violet/40 hover:text-violet-bright"
            >
              <ExternalLink className="size-4" />
              Open {docKind}
            </a>
          )}
        </div>

        {/* Details */}
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <div
              className="grid size-14 shrink-0 place-items-center rounded-2xl"
              style={{ background: `color-mix(in oklab, ${typeVar} 16%, transparent)`, color: typeVar }}
            >
              <Icon className="size-6" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-[22px] font-bold leading-tight tracking-tight text-foreground sm:text-[26px]">
                {memory.title || "Untitled memory"}
              </h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 font-body text-[13px] text-muted-foreground">
                <span>{relativeTime(memory.capturedAt)}</span>
                <span>· {typeLabel}</span>
                <ConfidenceDot band={memory.ocrConfidence as ConfidenceBand} withLabel className="ml-1" />
              </p>
              <p className="mt-0.5 font-body text-xs text-muted-foreground/70">
                {absoluteTime(memory.capturedAt)}
              </p>
            </div>
          </div>

          {memory.summary && (
            <p className="font-body text-sm leading-relaxed text-muted-foreground">{memory.summary}</p>
          )}

          <StructuredCard type={type} structured={memory.structured} />

          {actionItems.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="font-display text-sm font-semibold text-foreground/80">
                Action items
              </div>
              <ul className="mt-2 space-y-2">
                {actionItems.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 font-body text-sm text-foreground/80">
                    <CalendarClock className="mt-0.5 size-4 shrink-0 text-warning" />
                    <span>
                      {a.title}
                      {a.dueAt && (
                        <span className="block text-xs text-muted-foreground/70">
                          Due {absoluteTime(a.dueAt)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {text && <TextCorrector memoryId={memory.id} text={text} />}

          {entities.length > 0 && (
            <div className="space-y-3">
              {ENTITY_GROUPS.map((g) => {
                const rows = entities.filter((e) => g.kinds.includes(e.kind));
                if (rows.length === 0) return null;
                return (
                  <div key={g.label}>
                    <div className="font-body text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground/70">
                      {g.label}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {rows.map((e) => (
                        <span
                          key={e.id}
                          className="rounded-md bg-muted px-2 py-1 font-body text-xs text-foreground/80"
                        >
                          {e.valueText}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <TagEditor memoryId={memory.id} initialTags={tags} />

          <RelatedMemories
            memoryId={memory.id}
            initial={linked.map((m) => ({
              id: m.id,
              type: m.type,
              title: m.title,
              thumbUrl: linkedThumbUrls[m.thumbKey] ?? null,
              mime: m.mime,
            }))}
          />

          <Button
            asChild
            size="lg"
            className="w-full justify-center gap-2 sm:w-auto"
          >
            <Link href="/chat">
              <Sparkles className="size-4" /> Ask about this memory
            </Link>
          </Button>
        </div>
      </div>
    </AppPage>
  );
}
