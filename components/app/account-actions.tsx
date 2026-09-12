"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function AccountActions() {
  const router = useRouter();
  const [exporting, setExporting] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function exportData(format: "json" | "md" | "anki") {
    setExporting(format);
    try {
      const res = await fetch(`/api/export?format=${format}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ext = format === "json" ? "json" : format === "md" ? "zip" : "txt";
      a.href = url;
      a.download = `mirrormind-${format}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed. Try again.");
    } finally {
      setExporting(null);
    }
  }

  async function deleteAccount() {
    const typed = window.prompt(
      "This permanently deletes your account, every memory, and all images. Type DELETE to confirm.",
    );
    if (typed !== "DELETE") return;
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) throw new Error();
      toast("Account deleted.");
      router.push("/");
    } catch {
      toast.error("Delete failed. Contact the owner.");
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => exportData("json")}
        disabled={!!exporting}
      >
        {exporting === "json" ? <Loader2 className="animate-spin" /> : <Download />} JSON
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => exportData("md")}
        disabled={!!exporting}
      >
        {exporting === "md" ? <Loader2 className="animate-spin" /> : <Download />} Markdown (.zip)
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => exportData("anki")}
        disabled={!!exporting}
      >
        {exporting === "anki" ? <Loader2 className="animate-spin" /> : <Download />} Anki
      </Button>
      <Button variant="destructive" size="sm" onClick={deleteAccount} disabled={deleting}>
        {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete account
      </Button>
    </div>
  );
}
