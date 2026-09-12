import type { Metadata } from "next";
import { LegalProse } from "@/components/marketing/legal-prose";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalProse title="Privacy Policy" updated="8 September 2026">
      <p>
        Personal AI is a small personal project, currently in a private beta open to
        a handful of people. This page explains what is stored, how captures are
        processed, and the controls you have. Plain language, no dark patterns.
      </p>

      <h2>What is stored</h2>
      <ul>
        <li>The images, PDFs, documents, voice notes and links you capture, plus
          smaller display and thumbnail versions of images.</li>
        <li>The text and structured details extracted from them (dates, rooms,
          deadlines, key terms, and so on).</li>
        <li>Your questions and Personal AI&rsquo;s answers, so your history is there
          when you come back.</li>
        <li>Deadlines, from manual entries and (if connected) WhatsApp and calls.</li>
        <li>Finance transactions you log manually or upload via a bank/UPI
          statement, plus the category each was assigned.</li>
        <li>If you connect WhatsApp triage or the calling assistant yourself
          (both require your own separately-hosted setup — see
          <code> docs/modules/</code>): the categorized WhatsApp messages and
          call transcripts/summaries those produce. Neither is connected by
          default.</li>
        <li>Your account email — used for sign-in, and for reminder / weekly-recap
          emails if you leave those switched on (Settings lets you turn them off).</li>
      </ul>

      <h2>How captures are processed — the important caveat</h2>
      <p>
        To read a capture and to answer your questions, the relevant image or text
        is sent to <strong>Google&rsquo;s Gemini API</strong>. During the beta,
        Personal AI runs on Google&rsquo;s <strong>free tier</strong>, and under
        Google&rsquo;s terms for that tier{" "}
        <strong>
          your prompts and the model&rsquo;s responses may be used by Google to
          improve their products, and human reviewers may see them
        </strong>
        . Personal AI itself does not sell your data or train any model on it, but it
        cannot change what Google does with free-tier traffic. Practical advice:{" "}
        <strong>don&rsquo;t capture anything you&rsquo;d be unwilling to share with
        Google</strong> while the app is in this beta. A future paid tier would not
        train on your content.
      </p>
      <p>
        Only the specific image or text needed for a task is sent — never your whole
        library.
      </p>

      <h2>Prompt-injection safety</h2>
      <p>
        Text found inside a capture is treated strictly as data. Personal AI does not
        follow instructions that appear in a photographed notice, email, or
        whiteboard.
      </p>

      <h2>Your controls</h2>
      <ul>
        <li>Delete any memory — it leaves search immediately, and its stored files
          are removed from storage right away (routine infrastructure backups roll
          off on their own within about a week).</li>
        <li>Export everything, or delete your entire account and all its data, from
          Settings.</li>
        <li>Location is never attached to a capture. Image processing also removes
          most embedded metadata, including GPS.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Files are held in access-controlled storage. Every database query is scoped
        to your own account, and this is verified by an automated cross-account
        test on every change to the data layer.
      </p>

      <h2>Contact</h2>
      <p>
        Use <strong>Report a problem</strong> in the app for anything privacy- or
        data-related; it goes straight to the owner. There is no separate support
        address during the beta.
      </p>
    </LegalProse>
  );
}
