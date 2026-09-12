import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * App database client. Uses the *pooled* Supabase connection (DATABASE_URL,
 * port 6543). drizzle-kit migrations use the direct connection — see
 * drizzle.config.ts.
 *
 * Lazily instantiated so `next build` doesn't require DATABASE_URL.
 */
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add the Supabase pooled connection string to .env.local (see docs/14-SETUP.md).",
    );
  }
  const client = postgres(url, {
    prepare: false,
    // Supabase's pooled (transaction-mode) connection can close an idle
    // socket server-side without telling this client. Without idle_timeout,
    // the next query on that socket fails with a raw ECONNRESET instead of
    // postgres-js transparently reconnecting first — closing idle
    // connections proactively avoids ever trying to use a stale one.
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });
  _db = drizzle(client, { schema });
  return _db;
}

export { schema };
