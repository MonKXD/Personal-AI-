import type { Metadata } from "next";
import Link from "next/link";
import { LegalProse } from "@/components/marketing/legal-prose";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalProse title="Terms of Service" updated="8 September 2026">
      <p>
        By using MirrorMind you agree to these terms. They&rsquo;re short on
        purpose.
      </p>

      <h2>What MirrorMind is</h2>
      <p>
        A personal project offered free during a private beta. It is not a paid
        service. Access is limited, and may be closed, paused, or revoked at any
        time. There is no warranty, uptime commitment, or SLA — features may change
        and downtime may happen.
      </p>

      <h2>Your account</h2>
      <p>
        You&rsquo;re responsible for activity under your account. Keep your email
        access secure, since sign-in links are sent there.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Capture content you have the right to capture.</li>
        <li>Don&rsquo;t upload content that is illegal, or that violates
          someone&rsquo;s privacy or intellectual-property rights.</li>
        <li>Don&rsquo;t attempt to disrupt the service or abuse the API and capture
          limits.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You keep ownership of everything you capture. You grant MirrorMind only the
        permission needed to store, process, and display it back to you as part of
        the service. Processing involves a third-party AI provider — see the{" "}
        <Link href="/privacy">Privacy Policy</Link> for what that means during the
        beta.
      </p>

      <h2>Termination</h2>
      <p>
        You can delete your account at any time from Settings. Accounts that violate
        these terms may be suspended or removed.
      </p>

      <h2>Contact</h2>
      <p>
        Use <strong>Report a problem</strong> in the app.
      </p>
    </LegalProse>
  );
}
