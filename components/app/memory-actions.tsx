"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Trash2,
  Copy,
  Check,
  FolderInput,
  Link2,
  Link2Off,
  Pin,
  PinOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderPickerDialog } from "@/components/app/folder-picker";
import { shareMemory, unshareMemory, pinMemory, unpinMemory } from "@/lib/api-client";

export function MemoryActions({
  memoryId,
  text,
  folderId = null,
  shared = false,
  pinned = false,
}: {
  memoryId: string;
  text: string;
  folderId?: string | null;
  shared?: boolean;
  pinned?: boolean;
}) {
  const router = useRouter();
  const [copied, setCopied] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [folderOpen, setFolderOpen] = React.useState(false);
  const [isShared, setIsShared] = React.useState(shared);
  const [sharing, setSharing] = React.useState(false);
  const [isPinned, setIsPinned] = React.useState(pinned);
  const [pinning, setPinning] = React.useState(false);

  async function togglePin() {
    setPinning(true);
    try {
      if (isPinned) {
        await unpinMemory(memoryId);
        setIsPinned(false);
        toast("Unpinned");
      } else {
        await pinMemory(memoryId);
        setIsPinned(true);
        toast.success("Pinned to the top of your Timeline");
      }
      router.refresh();
    } catch {
      toast.error("Couldn't update the pin.");
    } finally {
      setPinning(false);
    }
  }

  async function toggleShare() {
    setSharing(true);
    try {
      if (isShared) {
        await unshareMemory(memoryId);
        setIsShared(false);
        toast("Public link revoked");
      } else {
        const { url } = await shareMemory(memoryId);
        setIsShared(true);
        await navigator.clipboard.writeText(url).catch(() => {});
        toast.success("Public link copied to clipboard");
      }
      router.refresh();
    } catch {
      toast.error("Couldn't update sharing.");
    } finally {
      setSharing(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy.");
    }
  }

  async function remove() {
    if (!confirm("Delete this memory? It leaves search immediately.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/memories/${memoryId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error();
      toast("Memory deleted");
      router.push("/timeline");
      router.refresh();
    } catch {
      toast.error("Delete failed.");
      setDeleting(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Memory actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={(e) => (e.preventDefault(), copy())}>
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy text"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pinning}
            onSelect={(e) => (e.preventDefault(), togglePin())}
          >
            {isPinned ? <PinOff /> : <Pin />} {isPinned ? "Unpin" : "Pin to top"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={(e) => (e.preventDefault(), setFolderOpen(true))}>
            <FolderInput /> Move to folder
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={sharing}
            onSelect={(e) => (e.preventDefault(), toggleShare())}
          >
            {isShared ? <Link2Off /> : <Link2 />}
            {isShared ? "Revoke public link" : "Share public link"}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={deleting}
            onSelect={(e) => (e.preventDefault(), remove())}
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FolderPickerDialog
        memoryIds={[memoryId]}
        currentFolderId={folderId}
        open={folderOpen}
        onOpenChange={setFolderOpen}
      />
    </>
  );
}
