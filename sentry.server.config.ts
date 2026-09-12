import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

// No DSN → the SDK is inert (no network, negligible overhead). Set SENTRY_DSN
// in the environment to turn it on.
Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV ?? "development",
});
