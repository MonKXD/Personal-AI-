import { requireUser, userDisplayName, userInitials } from "@/lib/auth";
import { countCapturesSince, getPrefs } from "@/lib/db/queries";
import { getEnv } from "@/lib/env";
import { startOfUtcDayForTz } from "@/lib/time";
import { AppShell } from "@/components/app/app-shell";
import { OnboardingGate } from "@/components/app/onboarding-gate";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const prefs = await getPrefs(user.id).catch(() => null);
  const tz = prefs?.tz || getEnv().APP_TZ;

  const todayCount = await countCapturesSince(
    user.id,
    startOfUtcDayForTz(new Date(), tz),
  ).catch(() => 0);

  return (
    <OnboardingGate>
      <AppShell
        todayCount={todayCount}
        user={{
          name: userDisplayName(user),
          email: user.email ?? "",
          initials: userInitials(user),
          avatarUrl:
            (user.user_metadata?.avatar_url as string | undefined) ?? null,
        }}
      >
        {children}
      </AppShell>
    </OnboardingGate>
  );
}
