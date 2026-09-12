# Personal AI

**Your AI memory for the physical world.** Point your camera at a notice, timetable, textbook page, or whiteboard. Personal AI reads it, structures it, remembers it — and answers your questions later, showing the original image as evidence.

> Status: capture → AI extraction → structured memory → embeddings → cited recall works end to end. Runs on deterministic offline fixtures until an AI key is added.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn-style primitives, `next-themes` (light/dark) |
| Auth | Supabase Auth — email magic link + Google OAuth |
| Data | Supabase Postgres + `pgvector`, Drizzle ORM, Row-Level Security |
| Storage | Supabase Storage (private `captures` bucket) |
| AI | Pluggable adapters (`lib/ai/`): **Google Gemini** (free), Ollama (local), or Anthropic. Falls back to fixtures with no key. |
| Deploy | Vercel |

## Quick start

```bash
npm install
cp .env.example .env.local     # fill in Supabase values (see below)
npm run dev                     # http://localhost:3000
```

The app builds and runs without Supabase configured — you'll see the marketing site
and the app shell, and sign-in will tell you it needs configuration.

### Configure Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **Database** → run `db/migrations/0000_init.sql` in the SQL editor (creates the
   schema, `pgvector`, RLS policies, and the `captures` storage bucket).
3. **Project Settings → API** → copy the URL and `anon` key into `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), and the
   `service_role` key into `SUPABASE_SERVICE_ROLE_KEY`.
4. **Project Settings → Database** → copy the pooled URI into `DATABASE_URL` and
   the direct URI into `DATABASE_URL_UNPOOLED`.
5. **Authentication → Providers** → enable Email and Google. Add
   `http://localhost:3000/auth/callback` (and your production URL) to the
   redirect allow-list.
6. Verify: `npm run check:db` (all green), then `npm run test:pipeline`.

### Configure AI (optional — fixtures work without it)

Pick one and add to `.env.local` (`AI_PROVIDER=auto` picks it up):

- **Google Gemini — free.** Key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → `GOOGLE_API_KEY=...`. Multimodal, works on Vercel. The *free* tier may train on your content — move to a paid key before real users (see `docs/12`).
- **Ollama — free, local, private.** `ollama pull llama3.2-vision && ollama pull llama3.1 && ollama pull bge-m3`, then `AI_PROVIDER=ollama`. Not available on Vercel.
- **Anthropic — paid.** `ANTHROPIC_API_KEY=...`.

Verify the real path: `npm run test:pipeline -- --real ./some-notice.jpg`.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run check:db` | Verify the Supabase schema/RLS/pgvector setup |
| `npm run test:pipeline` | End-to-end pipeline test (`-- --real [image]` for the live provider) |
| `npm run db:push` | Push `db/schema.ts` to the database (uses `DATABASE_URL_UNPOOLED`) |
| `npm run db:studio` | Drizzle Studio |

## Project layout

```
app/
  (marketing)/       landing, pricing, privacy, terms  — public
  (auth)/            sign-in  — magic link + Google
  (app)/             capture · timeline · chat · today · memory/[id] · settings  — requires auth
  auth/              OAuth callback + sign-out route handlers
  api/health/        health check
components/
  ui/                shadcn-style primitives (button, card, sheet, …)
  marketing/         site header/footer, landing visuals
  app/               app shell, nav, capture panel, chat shell, empty states
  brand/             logo
lib/
  supabase/          server + browser clients, session proxy helper
  env.ts             validated environment access
  auth.ts            getUser / requireUser
  image.ts           client-side downscale before upload
  memory-types.ts    shared enums + type metadata
db/
  schema.ts          Drizzle schema
  migrations/         hand-written SQL (authoritative)
docs/                 full product + engineering spec (00–15)
```

## Documentation

Everything lives in [`docs/`](docs/): PRD, TRD, architecture, design system, schema,
rules, tracker, project memory, API spec, prompt library, demo script, security &
privacy, test plan, setup, and the build log.

## Deploy (Vercel)

1. Push to GitHub, import the repo in Vercel.
2. Add all `.env.local` values as Vercel environment variables (set
   `NEXT_PUBLIC_SITE_URL` to your production URL).
3. Add `https://<your-domain>/auth/callback` to Supabase's redirect allow-list.
4. Deploy.

## License

Proprietary — © Personal AI. All rights reserved.
