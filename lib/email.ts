import "server-only";

import { Resend } from "resend";
import { getEnv } from "@/lib/env";
import type { MemoryType } from "@/lib/memory-types";

/**
 * Resend wrapper. Degrades gracefully without a key — same philosophy as the
 * AI provider adapters (lib/ai/index.ts): the app works end-to-end without
 * RESEND_API_KEY, it just doesn't send mail. Warns once, not on every call.
 */

let client: Resend | null | undefined;
let warned = false;

function getResend(): Resend | null {
  if (client !== undefined) return client;
  const key = getEnv().RESEND_API_KEY;
  if (!key) {
    if (!warned) {
      console.warn("[email] RESEND_API_KEY not set — emails will be logged, not sent.");
      warned = true;
    }
    client = null;
    return null;
  }
  client = new Resend(key);
  return client;
}

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#04040f;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;">
      <tr>
        <td style="padding-bottom:24px;text-align:center;">
          <div style="display:inline-block;width:36px;height:36px;border-radius:50%;background:radial-gradient(circle at 33% 28%,#ede9fe,#a78bfa 22%,#7c3aed 46%,#4c1d95 68%,#1e1b4b 85%,#04040f);"></div>
          <div style="margin-top:8px;font-size:15px;font-weight:700;color:#ffffff;">Personal AI</div>
        </td>
      </tr>
      <tr>
        <td style="background:#0a0a18;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:28px 24px;">
          <h1 style="margin:0 0 12px;font-size:18px;color:#ffffff;">${title}</h1>
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="padding-top:20px;text-align:center;font-size:12px;color:rgba(255,255,255,.35);">
          Personal AI — your AI memory. <a href="${siteUrl()}/settings" style="color:rgba(167,139,250,.9);">Manage email preferences</a>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendWeeklyDigestEmail(
  to: string,
  data: { sentence: string; groups: { type: MemoryType; label: string; items: { id: string; title: string }[] }[] },
): Promise<boolean> {
  const groupsHtml = data.groups
    .map(
      (g) => `
      <div style="margin-top:16px;">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.4);">${g.label}</div>
        <ul style="margin:6px 0 0;padding-left:18px;color:rgba(255,255,255,.7);font-size:14px;">
          ${g.items.map((it) => `<li style="margin-top:4px;"><a href="${siteUrl()}/memory/${it.id}" style="color:rgba(255,255,255,.85);text-decoration:none;">${escapeHtml(it.title || "Untitled memory")}</a></li>`).join("")}
        </ul>
      </div>`,
    )
    .join("");

  const html = shell(
    "Your week in Personal AI",
    `<p style="margin:0 0 4px;font-size:14px;color:rgba(255,255,255,.7);">${escapeHtml(data.sentence)}</p>${groupsHtml}
     <a href="${siteUrl()}/today" style="display:block;margin-top:24px;padding:12px;border-radius:12px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;text-align:center;text-decoration:none;font-size:14px;font-weight:600;">Open Personal AI</a>`,
  );

  return send(to, "Your week in Personal AI", html);
}

export async function sendReminderEmail(
  to: string,
  data: { title: string; dueAt: string; memoryTitle: string; memoryId: string },
): Promise<boolean> {
  const html = shell(
    "A deadline is coming up",
    `<p style="margin:0 0 4px;font-size:15px;color:#ffffff;">${escapeHtml(data.title)}</p>
     <p style="margin:0;font-size:13px;color:rgba(255,255,255,.5);">Due ${escapeHtml(data.dueAt)} · from <a href="${siteUrl()}/memory/${data.memoryId}" style="color:rgba(167,139,250,.9);">${escapeHtml(data.memoryTitle || "a memory")}</a></p>
     <a href="${siteUrl()}/today" style="display:block;margin-top:20px;padding:12px;border-radius:12px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;text-align:center;text-decoration:none;font-size:14px;font-weight:600;">View in Personal AI</a>`,
  );

  return send(to, `Reminder: ${data.title}`, html);
}

/** Never throws — a batch cron loop over many recipients must not abort
 * because one send hit a network blip. Callers just check the boolean. */
async function send(to: string, subject: string, html: string): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.log(`[email] (no key, not sent) to=${to} subject=${JSON.stringify(subject)}`);
    return false;
  }
  try {
    const { error } = await resend.emails.send({
      from: getEnv().EMAIL_FROM,
      to,
      subject,
      html,
    });
    if (error) {
      console.error("[email] send failed:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] send threw:", e);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
