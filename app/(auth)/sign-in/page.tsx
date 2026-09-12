import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Personal AI memory.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="animate-rise">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to Personal AI</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your captures and memories, private to you. No password needed.
      </p>
      <div className="mt-8">
        <SignInForm next={next} initialError={error} />
      </div>
    </div>
  );
}
