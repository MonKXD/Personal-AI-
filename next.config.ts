import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // We maintain our own CLAUDE.md / AGENTS.md (they point at docs/06-RULES.md).
  agentRules: false,
  // Ship native-binary / heavy packages as-is rather than bundling them:
  // sharp (image processing) and officeparser (DOCX/PPTX text — drags in
  // @napi-rs/canvas + tesseract.js, which must not be traced into the bundle).
  serverExternalPackages: ["sharp", "officeparser", "web-push", "mupdf"],
  // Pin the workspace root (a stray lockfile lives in $HOME on this machine).
  turbopack: { root: import.meta.dirname },
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/**",
          },
        ]
      : [],
  },
  experimental: {
    // Server Action bodies can carry downscaled image data URLs.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

// Sentry: the runtime SDK is inert without SENTRY_DSN (see sentry.*.config.ts).
// The build plugin only uploads source maps when SENTRY_AUTH_TOKEN + org/project
// are set, so this is a no-op until you add a Sentry project.
export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
