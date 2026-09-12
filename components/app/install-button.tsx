"use client";

import { Download } from "lucide-react";
import { useInstallPrompt } from "@/lib/use-install-prompt";
import { Button } from "@/components/ui/button";

export function InstallButton() {
  const { canInstall, promptInstall } = useInstallPrompt();
  if (!canInstall) return null;

  return (
    <Button variant="secondary" size="sm" onClick={promptInstall}>
      <Download /> Install MirrorMind
    </Button>
  );
}
