import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"] });

/**
 * Drizzle uses the *direct* (unpooled) connection for schema operations.
 * On Supabase that is the port-5432 URI; the app itself uses the pooled
 * port-6543 URI (DATABASE_URL). See docs/14-SETUP.md.
 */
const url =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
  // Supabase-managed schemas we don't want drizzle to touch.
  schemaFilter: ["public"],
  entities: {
    roles: { provider: "supabase" },
  },
});
