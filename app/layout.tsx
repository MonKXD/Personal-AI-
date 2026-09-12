import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Sora, Space_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { CursorGlow } from "@/components/fx/cursor-glow";
import { ClickSpark } from "@/components/fx/click-spark";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MirrorMind — Your AI Memory",
    template: "%s · MirrorMind",
  },
  description:
    "Point your camera at a notice, timetable, textbook page, or whiteboard. MirrorMind reads it, remembers it, and answers your questions later — with the original as evidence.",
  applicationName: "MirrorMind",
  appleWebApp: { capable: true, title: "MirrorMind", statusBarStyle: "black-translucent" },
  keywords: [
    "AI memory",
    "visual memory",
    "OCR",
    "personal knowledge",
    "second brain",
    "note capture",
  ],
  authors: [{ name: "MirrorMind" }],
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "MirrorMind — Your AI Memory",
    description:
      "See it once, remember forever. MirrorMind gives an AI a memory of your day.",
    siteName: "MirrorMind",
  },
  twitter: {
    card: "summary_large_image",
    title: "MirrorMind — Your AI Memory",
    description:
      "See it once, remember forever. MirrorMind gives an AI a memory of your day.",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#1a1822" },
    { media: "(prefers-color-scheme: light)", color: "#f6f1e7" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bricolage.variable} ${sora.variable} ${spaceMono.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <ThemeProvider>
          <CursorGlow />
          <ClickSpark />
          <ServiceWorkerRegister />
          {children}
          <Toaster />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
