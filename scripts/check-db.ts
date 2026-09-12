/**
 * Verifies the Supabase database is wired up correctly.
 * Run after applying db/migrations/0000_init.sql:  npm run check:db
 *
 * Uses DATABASE_URL_UNPOOLED (direct connection) if present, else DATABASE_URL.
 * Reads no secrets beyond the connection string in your .env.local.
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: [".env.local", ".env"] });

const whichVar = process.env.DATABASE_URL_UNPOOLED
  ? "DATABASE_URL_UNPOOLED"
  : "DATABASE_URL";
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

/** Redacted view of a connection string — never prints the password. */
function describeUrl(raw: string) {
  try {
    const u = new URL(raw);
    return {
      user: decodeURIComponent(u.username),
      host: u.hostname,
      port: u.port || "(default)",
      db: u.pathname.replace(/^\//, "") || "(none)",
      hasPassword: u.password.length > 0,
      rawPassword: u.password, // used only for placeholder detection below
    };
  } catch {
    return null;
  }
}

const EXPECTED_TABLES = [
  "profiles",
  "captures",
  "memories",
  "chunks",
  "embeddings",
  "entities",
  "tags",
  "memory_tags",
  "action_items",
  "memory_links",
  "chat_sessions",
  "chat_messages",
  "idempotency_keys",
];

const EXPECTED_EXTENSIONS = ["vector", "pg_trgm"];

function line(ok: boolean, label: string, extra = "") {
  const mark = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
  console.log(`  ${mark} ${label}${extra ? `  ${extra}` : ""}`);
  return ok;
}

async function main() {
  console.log("\nMirrorMind · Supabase check\n");

  if (!url) {
    line(false, "DATABASE_URL not set");
    console.log(
      "\n  Add DATABASE_URL (and ideally DATABASE_URL_UNPOOLED) to .env.local.\n" +
        "  See docs/14-SETUP.md.\n",
    );
    process.exit(1);
  }

  const info = describeUrl(url);
  if (!info) {
    line(false, `${whichVar} is not a valid URL`);
    console.log(
      "\n  It should look like:\n" +
        "  postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres\n",
    );
    process.exit(1);
  }

  console.log(
    `  using ${whichVar}  →  ${info.user}@${info.host}:${info.port}/${info.db}\n`,
  );

  const placeholder = /^\[?your[-_]?password\]?$/i.test(info.rawPassword);
  if (!info.hasPassword || placeholder) {
    line(false, "password missing or still a placeholder in " + whichVar);
    console.log(
      "\n  Replace [YOUR-PASSWORD] with your real database password.\n" +
        "  If it contains special characters, percent-encode them (see below),\n" +
        "  or reset it to letters+digits only in Supabase → Settings → Database.\n",
    );
    process.exit(1);
  }
  if (/%[0-9a-fA-F]{2}/.test(info.rawPassword) === false && /[@#/:?&! $%^*()+=]/.test(info.rawPassword)) {
    console.log(
      "  \x1b[33m! the password contains characters that usually need URL-encoding\x1b[0m\n" +
        "    @ → %40   # → %23   / → %2F   : → %3A   ? → %3F   & → %26   ! → %21   $ → %24   space → %20\n" +
        "    Easiest fix: reset the DB password to letters+digits only.\n",
    );
  }

  const sql = postgres(url, { prepare: false, idle_timeout: 5, max: 1 });
  let allGood = true;

  try {
    const [{ version }] = await sql<{ version: string }[]>`select version()`;
    line(true, "Connected", version.split(" ").slice(0, 2).join(" "));

    // Extensions
    const exts = await sql<{ extname: string }[]>`
      select extname from pg_extension where extname = any(${EXPECTED_EXTENSIONS})
    `;
    const extNames = exts.map((e) => e.extname);
    for (const e of EXPECTED_EXTENSIONS) {
      allGood = line(extNames.includes(e), `extension "${e}"`) && allGood;
    }

    // Tables
    const rows = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public'
    `;
    const present = new Set(rows.map((r) => r.table_name));
    const missing = EXPECTED_TABLES.filter((t) => !present.has(t));
    allGood =
      line(
        missing.length === 0,
        `public tables (${EXPECTED_TABLES.length} expected)`,
        missing.length ? `missing: ${missing.join(", ")}` : "",
      ) && allGood;

    // RLS enabled on our tables
    const rls = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      select c.relname, c.relrowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = any(${EXPECTED_TABLES})
    `;
    const noRls = rls.filter((r) => !r.relrowsecurity).map((r) => r.relname);
    allGood =
      line(
        noRls.length === 0,
        "row-level security enabled on all tables",
        noRls.length ? `off: ${noRls.join(", ")}` : "",
      ) && allGood;

    // Storage bucket
    const buckets = await sql<{ id: string }[]>`
      select id from storage.buckets where id = 'captures'
    `;
    allGood = line(buckets.length === 1, 'storage bucket "captures"') && allGood;

    // auth trigger
    const trg = await sql<{ tgname: string }[]>`
      select tgname from pg_trigger where tgname = 'on_auth_user_created'
    `;
    allGood =
      line(trg.length === 1, "auth.users → profiles trigger") && allGood;

    // Embedding dimension matches env
    const dims = await sql<{ udt: string; typ: string }[]>`
      select a.attname, format_type(a.atttypid, a.atttypmod) as typ
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'embeddings' and a.attname = 'embedding'
    ` as unknown as { typ: string }[];
    const envDims = process.env.EMBEDDING_DIMS ?? "1024";
    const colType = dims[0]?.typ ?? "?";
    allGood =
      line(
        colType === `vector(${envDims})`,
        `embeddings.embedding is vector(${envDims})`,
        colType !== `vector(${envDims})` ? `found ${colType}` : "",
      ) && allGood;
  } catch (err) {
    allGood = false;
    const msg = (err as Error).message;
    line(false, "Query failed", msg);

    if (/password authentication failed/i.test(msg)) {
      console.log(
        `\n  The host was reachable but the password in ${whichVar} is wrong.\n` +
          "  Fixes, easiest first:\n" +
          "   1. Supabase → Settings → Database → Reset database password → set one\n" +
          "      with letters + digits only (24+ chars). Paste it into BOTH\n" +
          "      DATABASE_URL and DATABASE_URL_UNPOOLED, replacing [YOUR-PASSWORD].\n" +
          "   2. Or percent-encode special characters in the current password.\n" +
          "   3. Make sure the user matches the connection type: pooler = \n" +
          "      'postgres.<ref>', direct = 'postgres'.\n",
      );
    } else if (/getaddrinfo|ENOTFOUND|ETIMEDOUT|ECONNREFUSED/i.test(msg)) {
      console.log(
        "\n  Could not reach the host. If you used the Direct connection, your\n" +
          "  network may be IPv4-only — use the Session pooler URI instead\n" +
          "  (host aws-0-<region>.pooler.supabase.com, port 5432).\n",
      );
    } else if (/relation .* does not exist|permission denied for schema/i.test(msg)) {
      console.log(
        "\n  Connected, but the schema isn't there. Run db/migrations/0000_init.sql\n" +
          "  in the Supabase SQL editor.\n",
      );
    }
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log(
    allGood
      ? "\n\x1b[32mAll checks passed.\x1b[0m Database is ready.\n"
      : "\n\x1b[31mSome checks failed.\x1b[0m Re-run db/migrations/0000_init.sql or fix .env.local.\n",
  );
  process.exit(allGood ? 0 : 1);
}

main();
