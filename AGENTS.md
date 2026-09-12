# MirrorMind — agent guide

**Read `docs/06-RULES.md` first.** It is the engineering + AI-assistant rulebook and takes precedence. Then skim `docs/08-MEMORY.md` (decisions), `docs/15-BUILD-LOG.md` (what's built), and `docs/09-API-SPEC.md` / `docs/05-SCHEMA.md` for contracts.

## Stack (as built)

- **Next.js 16 (App Router) + React 19 + TypeScript**, one deploy target (Vercel).
- **Tailwind v4** (CSS-first tokens in `app/globals.css`), shadcn-style primitives in `components/ui/*`.
- **Supabase**: Postgres + `pgvector` + Auth (magic link + Google) + Storage. Auth wiring in `lib/supabase/*` and `proxy.ts`. RLS is the security boundary — see `db/migrations/0000_init.sql`.
- **Drizzle ORM** (`db/schema.ts`, client in `db/index.ts`). Hand-written SQL migration is authoritative.
- AI (vision / embeddings / chat) is **not wired yet** — Foundation build. Adapters land behind interfaces in `lib/ai/*` next.

## Conventions (short form)

- Every DB query filters the owner and `deleted_at is null`. RLS also enforces this — don't rely on only one layer.
- Captured text is untrusted: never in a system prompt; only inside delimited context blocks.
- Env via `lib/env.ts` (`getEnv()` server, `publicEnv` client). Never read `process.env` elsewhere.
- Server-only modules import `"server-only"`. Supabase browser client only in client components.
- Keep `EMBEDDING_DIMS` (env) == the `vector(n)` column == `db/vector.ts` `EMBEDDING_DIMS`.
- `npm run typecheck && npm run lint && npm run build` must pass before a change is done.

## Commands

```
npm run dev         # local dev (http://localhost:3000)
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint          # eslint
npm run db:push       # push db/schema.ts to Supabase (needs DATABASE_URL_UNPOOLED)
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->
