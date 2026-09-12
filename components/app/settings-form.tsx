"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { savePrefs } from "@/app/(app)/settings/actions";

const COMMON_TZ = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />} Save
    </Button>
  );
}

export function SettingsForm({
  initial,
}: {
  initial: { tz: string; emailReminders: boolean; weeklyDigest: boolean };
}) {
  const router = useRouter();
  const [state, action] = useActionState(
    async (_prev: { ok?: boolean; error?: string }, fd: FormData) => savePrefs(fd),
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("Settings saved.");
      router.refresh();
    }
    if (state.error) toast.error(state.error);
  }, [state, router]);

  const tzOptions = COMMON_TZ.includes(initial.tz)
    ? COMMON_TZ
    : [initial.tz, ...COMMON_TZ];

  return (
    <form action={action} className="space-y-5">
      <label className="flex items-center justify-between gap-4 font-body text-sm">
        <span className="text-muted-foreground">Timezone</span>
        <select
          name="tz"
          defaultValue={initial.tz}
          className="h-9 rounded-md border border-input bg-muted px-2 text-sm text-foreground outline-none focus-visible:border-violet/40 focus-visible:ring-2 focus-visible:ring-violet/20"
        >
          {tzOptions.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </label>

      <Toggle
        name="emailReminders"
        label="Email me when an action item is due soon"
        defaultChecked={initial.emailReminders}
      />
      <Toggle
        name="weeklyDigest"
        label="Send me a weekly digest email"
        defaultChecked={initial.weeklyDigest}
      />

      <Save />
    </form>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-4 font-body text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="checkbox"
        name={name}
        value="on"
        defaultChecked={defaultChecked}
        className="size-4 rounded border-border accent-[var(--color-violet)]"
      />
    </label>
  );
}
