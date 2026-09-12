import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: 0.05,
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
