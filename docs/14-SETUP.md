# 14 — Setup & Runbook

**Product:** MirrorMind
**Related:** [TRD](02-TRD.md) §9 · [Rules](06-RULES.md) §2 · [Architecture](03-ARCHITECTURE.md) §2

---

## 1. Prerequisites

| Tool | Version | Note |
|------|---------|------|
| Docker + Compose | 24+ | primary path |
| Python | 3.11.x | for running scripts / api outside Docker |
| Node | 20.x + pnpm 9 | web build |
| Tesseract | 5.x | only for the local OCR fallback outside Docker (`brew install tesseract`) |
| Make | any | shortcuts |

API keys needed: a vision-capable LLM key, an embeddings key, a chat LLM key (can be the same provider/key).

---

## 2. Environment variables (`.env`)

Copy `.env.example` → `.env` and fill in. Names (blank in the example):

```dotenv
# --- core ---
APP_ENV=dev                       # dev | prod
LOG_LEVEL=info
WEB_ORIGIN=http://localhost:5173  # CORS allowlist (dev). In compose: http://localhost
API_BASE_PATH=/api/v1

# --- database ---
DATABASE_URL=postgresql+asyncpg://mirror:mirror@db:5432/mirrormind
# outside docker: postgresql+asyncpg://mirror:mirror@localhost:5432/mirrormind

# --- storage ---
STORAGE_BACKEND=local             # local | s3
STORAGE_LOCAL_DIR=/data/uploads   # bind-mounted volume in compose
# S3_* only when STORAGE_BACKEND=s3
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=

# --- models / adapters ---
VISION_PROVIDER=anthropic
VISION_MODEL=claude-sonnet-5
VISION_API_KEY=
VISION_TIMEOUT_S=30

CHAT_PROVIDER=anthropic
CHAT_MODEL=claude-sonnet-5
CHAT_API_KEY=
CHAT_TIMEOUT_S=30

EMBEDDING_PROVIDER=voyage
EMBEDDING_MODEL=voyage-3.5
EMBEDDING_DIMS=1024               # MUST equal the VECTOR(n) column in migrations
EMBEDDING_API_KEY=
EMBEDDING_TIMEOUT_S=20

QUERY_PARSER_MODEL=claude-haiku-4-5-20251001   # cheap tier for the fallback parser

# --- pipeline tuning ---
MAX_INFLIGHT_JOBS=4
CHUNK_TARGET_TOKENS=300
CHUNK_OVERLAP_RATIO=0.15
RETRIEVAL_K=8
RETRIEVAL_CANDIDATES=24
RETRIEVAL_MIN_SIM=0.20
HNSW_EF_SEARCH=80
USER_DEFAULT_TZ=Asia/Kolkata

# --- dev / demo ---
DRY_RUN=0                         # 1 = adapters return fixtures, zero network
DEFAULT_USER_ID=demo-user
```

> **Guard:** on startup the API asserts `EMBEDDING_DIMS` == the `embeddings.embedding` column dimension and refuses to boot on mismatch. Changing the model/dims requires a new migration + `scripts/reembed.py`.

---

## 3. Quick start (Docker — recommended)

```bash
git clone <repo> mirrormind && cd mirrormind
cp .env.example .env         # then fill in the three API keys
make up                      # docker compose up --build -d
make migrate                 # runs alembic upgrade head inside the api container
make seed                    # optional: ingest demo assets (needs keys, or DRY_RUN=1)
open http://localhost        # web (nginx) proxies /api to the api container
```

`docker-compose.yml` services: `db` (`pgvector/pgvector:pg15`, volume `pgdata`), `api` (`:8000`, volume `uploads` at `/data/uploads`, entrypoint runs `alembic upgrade head`), `web` (`nginx`, serves built SPA, proxies `/api` and `/api/**/events` with buffering off).

Health: `curl localhost/api/v1/healthz` → `{"status":"ok"}`; `curl localhost/api/v1/readyz` checks db + storage + one adapter ping.

---

## 4. Local dev (hot reload)

Two terminals:

```bash
# --- terminal 1: infra + api ---
docker compose up -d db
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
export $(grep -v '^#' ../.env | xargs)         # or use direnv
export DATABASE_URL=postgresql+asyncpg://mirror:mirror@localhost:5432/mirrormind
alembic upgrade head
uvicorn main:app --reload --port 8000
```

```bash
# --- terminal 2: web ---
cd web
pnpm install
echo "VITE_API_BASE=http://localhost:8000/api/v1" > .env.local
pnpm dev            # http://localhost:5173
```

Set `WEB_ORIGIN=http://localhost:5173` in `.env` for CORS during dev.

---

## 5. Make targets

| Target | Does |
|--------|------|
| `make up` / `make down` | compose up --build -d / down |
| `make migrate` | `alembic upgrade head` (in api container) |
| `make revision m="..."` | `alembic revision --autogenerate -m "..."` |
| `make seed` | `python scripts/seed_demo.py` |
| `make reembed` | `python scripts/reembed.py` after an embedding-model change |
| `make eval` | `python scripts/eval_retrieval.py` (+ prints table) |
| `make eval-extract` | `python scripts/eval_extraction.py` |
| `make test` | `pytest` (unit + integration, `DRY_RUN=1`) |
| `make lint` | `ruff check . && mypy && (cd web && pnpm lint && pnpm tsc --noEmit)` |
| `make gen-client` | regenerate `web/src/lib/api.ts` from `/api/v1/openapi.json` |
| `make backup` | `scripts/backup.sh` → `pg_dump` + tar of `uploads/` into `./backups/<ts>/` |
| `make dry` | `DRY_RUN=1 make up` — fixtures only, no network (demo fallback) |

---

## 6. Database

```bash
# psql into the running DB
docker compose exec db psql -U mirror -d mirrormind

# confirm pgvector + HNSW index
\dx                                   -- expect: vector, pg_trgm
\d+ embeddings                        -- embedding column: vector(1024)
SELECT indexname FROM pg_indexes WHERE tablename='embeddings';
```

Reset everything (dev only):
```bash
docker compose down -v && make up && make migrate && make seed
```

---

## 7. Seed & demo data

- `scripts/seed_demo.py`:
  - inserts `users` row `demo-user` (tz `Asia/Kolkata`);
  - ingests `docs/assets/demo/{timetable,circular,textbook}.jpg` + 4 distractors through the **real** pipeline (or fixtures if `DRY_RUN=1`);
  - waits for all to reach `ready`, prints a summary table (id, type, title, #chunks).
- Assets are self-made (no real personal data). Replace freely; keep filenames or update the script.
- Pre-demo: `make seed && make eval` and confirm the scripted questions ([Demo Script](11-DEMO-SCRIPT.md) §4).

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| API won't boot: "EMBEDDING_DIMS mismatch" | `.env` dims ≠ `VECTOR(n)` | set `EMBEDDING_DIMS` to match, or new migration + `make reembed` |
| `extension "vector" is not available` | wrong Postgres image | use `pgvector/pgvector:pg15` (pinned in compose) |
| Captures stuck at `queued` | `MAX_INFLIGHT_JOBS` reached or background task crashed | check api logs; `make down && make up`; lower image size |
| `vision_unavailable` on every capture | bad/missing `VISION_API_KEY` or network | verify key; `curl` provider; or run `make dry` |
| SSE never updates in browser | proxy buffering on | nginx `proxy_buffering off;` for `/api/**/events`; dev: hitting `:8000` directly is fine |
| HEIC upload fails | `pillow-heif` not installed in image | rebuild api image; or convert to JPG client-side |
| Webcam blocked | not `localhost`/HTTPS | use `http://localhost` (allowed) or serve web over HTTPS |
| `pnpm dev` CORS errors | `WEB_ORIGIN` not set to `:5173` | update `.env`, restart api |
| Retrieval returns nothing | `HNSW_EF_SEARCH` too low / index not built | raise `HNSW_EF_SEARCH`; confirm index exists; `ANALYZE embeddings;` |
| Timezone off by hours in "this morning" | `USER_DEFAULT_TZ` / user tz wrong | set `USER_DEFAULT_TZ`; check `users.tz` |

---

## 9. Pre-demo runbook (condensed)

```bash
make up && make migrate
make seed                      # all 7 -> ready
make eval-extract              # cache extraction accuracy
make eval                      # hit-rate >= 0.85, scripted Qs pass
make backup                    # note ./backups/<ts>/
make dry                       # sanity: fixtures work with Wi-Fi off
# switch back:  DRY_RUN=0 make up
```

Keep a terminal ready on `make dry` and the recorded demo video one tab away. See [Demo Script](11-DEMO-SCRIPT.md) §5 for the fallback ladder.
