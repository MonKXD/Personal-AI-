"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import {
  sendMagicLink,
  signInWithGoogle,
  signInAsDemo,
  type AuthFormState,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthFormState = { ok: false };

const ERROR_MESSAGES: Record<string, string> = {
  not_invited:
    "This email isn't on the invite list yet. Ask the owner to add you, then try again.",
  missing_code: "That sign-in link didn't work. Request a fresh one.",
  oauth_failed: "Google sign-in failed. Try again or use an email link.",
  at_capacity:
    "Personal AI is at capacity right now — the beta is limited to a small group. Existing members can still sign in; new spots open up when someone leaves.",
};

function friendlyError(raw: string): string {
  const v = decodeURIComponent(raw);
  return ERROR_MESSAGES[v] ?? v;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" /> Sending link…
        </>
      ) : (
        <>
          <Mail /> Email me a sign-in link
        </>
      )}
    </Button>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="secondary"
      size="lg"
      className="w-full"
      disabled={pending}
    >
      {pending ? <Loader2 className="animate-spin" /> : <GoogleGlyph />}
      Continue with Google
    </Button>
  );
}

export function SignInForm({
  next,
  initialError,
}: {
  next?: string;
  initialError?: string;
}) {
  const [state, formAction] = useActionState(sendMagicLink, initialState);

  useEffect(() => {
    if (initialError) toast.error(friendlyError(initialError));
  }, [initialError]);

  useEffect(() => {
    if (state.message && !state.ok) toast.error(state.message);
  }, [state]);

  if (state.ok) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-card animate-rise">
        <CheckCircle2 className="mx-auto size-8 text-success" />
        <h2 className="mt-3 font-semibold">Check your email</h2>
        <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
        <p className="mt-4 text-xs text-muted-foreground">
          Wrong address?{" "}
          <button
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => window.location.reload()}
          >
            Start over
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next ?? ""} />
        <GoogleButton />
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="next" value={next ?? ""} />
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            autoFocus
          />
        </div>
        <SubmitButton />
      </form>

      <p className="text-center text-xs text-muted-foreground">
        New here? The same link creates your account.
      </p>

      <form action={signInAsDemo} className="border-t border-border pt-4 text-center">
        <button
          type="submit"
          className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
        >
          Just looking? Open the read-only demo →
        </button>
      </form>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6.01-2.74-6.01-6.12S8.69 5.96 12 5.96c1.88 0 3.14.8 3.86 1.49l2.63-2.53C16.86 3.36 14.65 2.4 12 2.4 6.98 2.4 2.9 6.48 2.9 11.5S6.98 20.6 12 20.6c5.78 0 9.6-4.06 9.6-9.78 0-.66-.07-1.16-.16-1.66H12z"
      />
    </svg>
  );
}
