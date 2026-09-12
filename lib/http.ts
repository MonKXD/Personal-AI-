import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import { reportError } from "@/lib/observe";
import { isDemoUser, DEMO_READONLY_MESSAGE } from "@/lib/demo";

export function jsonError(
  status: number,
  errorCode: string,
  message: string,
  detail?: unknown,
) {
  return NextResponse.json(
    { error_code: errorCode, message, ...(detail ? { detail } : {}) },
    { status },
  );
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public errorCode: string,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
  }
}

/** Resolve the current user or throw a 401 HttpError. Pass `{ write: true }`
 * on any mutating route to also reject the read-only demo account with a 403. */
export async function requireApiUser(opts?: { write?: boolean }): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new HttpError(401, "unauthorized", "Sign in to continue.");
  if (opts?.write && isDemoUser(user.id)) {
    throw new HttpError(403, "demo_read_only", DEMO_READONLY_MESSAGE);
  }
  return user;
}

/** Server-action guard: throw if this is the read-only demo account. */
export function assertCanMutate(user: User): void {
  if (isDemoUser(user.id)) {
    throw new Error(DEMO_READONLY_MESSAGE);
  }
}

/** Wrap a handler so HttpError → JSON and anything else → 500. */
export function handle<T extends unknown[]>(
  fn: (...args: T) => Promise<Response>,
) {
  return async (...args: T): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        // 5xx HttpErrors are still real incidents (e.g. an upstream model
        // 502); 4xx are expected client errors and not worth reporting.
        if (err.status >= 500) reportError(err, { where: routeOf(args), status: err.status });
        return jsonError(err.status, err.errorCode, err.message, err.detail);
      }
      reportError(err, { where: routeOf(args) });
      return jsonError(500, "internal_error", "Something went wrong.");
    }
  };
}

function routeOf(args: unknown[]): string {
  const req = args[0];
  if (req instanceof Request) {
    try {
      return `${req.method} ${new URL(req.url).pathname}`;
    } catch {
      /* fall through */
    }
  }
  return "api";
}
