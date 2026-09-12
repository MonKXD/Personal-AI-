import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo />
      <div>
        <div className="font-mono text-sm text-muted-foreground">404</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          No memory of this page
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          The link may be broken, or the page may have moved.
        </p>
      </div>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/capture">Open app</Link>
        </Button>
      </div>
    </div>
  );
}
