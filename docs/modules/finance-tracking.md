# Module: Finance Tracking

**Status: built.** Schema in `db/migrations/0017_deadlines_finance_calls_whatsapp.sql`
(`finance_transactions`, `finance_statement_batches`). Parsing in
`lib/finance/parse-statement.ts`. AI categorization in
`lib/ai/{types,prompts,gemini,fixtures,index}.ts` (`getFinanceCategorizer`,
`getStatementParser`). API in `app/api/finance/`. UI at `/finance`
(`components/app/finance-view.tsx`).

## Chosen approach: manual entry + statement upload with AI categorization

Same choice as the original spec: not the Account Aggregator framework (real
friction for a personal project, built for registered fintech FIUs) — manual
entry plus statement upload gets most of the practical value (categorized
spending, trends) without it. Clean upgrade path later if live bank data
turns out to be worth the friction.

## Statement upload flow

1. `POST /api/finance/statements` (`multipart/form-data`: `file`, `accountLabel`).
2. CSV is parsed directly (`parseStatementCsv` — header-based column
   detection: `Date`, `Debit`/`Credit` or `Amount`+`Type`,
   `Narration`/`Description`/`Particulars`). No AI needed.
3. PDF: text is extracted with `mupdf` (`extractPdfText`, page by page — this
   app already depends on `mupdf` for capture thumbnails), then normalized
   into rows by a single Gemini call (`getStatementParser().parseText`) —
   bank statement PDF layouts vary too much for hand-written regex to hold up.
4. Each row is categorized in one batched Gemini call
   (`getFinanceCategorizer().categorize`, chunked at 60 rows/call to keep
   token budgets bounded).
5. Rows are inserted with `ON CONFLICT DO NOTHING` against a unique index on
   `(user_id, occurred_on, amount, direction, merchant, statement_batch_id)`
   — a re-uploaded statement doesn't double-count.
6. `finance_statement_batches` tracks status (`processing`/`done`/`failed`)
   and row count per upload.

## Category taxonomy

Food, Travel, Subscriptions, Education, Shopping, Rent/Housing, Health,
Entertainment, Transfers, Income, Other (`FINANCE_CATEGORIES` in
`lib/ai/types.ts`) — the categorizer may also return a short new category
name when nothing in the list fits well, rather than forcing "Other."

## Budgets

Not built — the original spec marked this optional ("build only if wanted
after the base is working"). `finance_budgets` isn't in the 0017 migration;
add it in a follow-up migration if wanted.

## API

- `GET /api/finance/transactions?category=&source=`
- `POST /api/finance/transactions` `{date, amount, direction, category, note?}`
- `POST /api/finance/statements` (upload, see above) · `GET` (list batches)
- `GET /api/finance/summary?month=YYYY-MM` — category totals, expenses only

## UI

`/finance`: manual-entry form, statement upload form, this-month category
breakdown, transactions table (source-tagged, sortable by the browser's
default table order — add client-side sort/filter later if needed).

## Privacy note

Uploaded statement files are parsed in-memory in the API route (never
written to storage) and only the extracted rows are persisted — no more
sensitive than any other row in this app's already-RLS-protected database.
Verify `finance_*` RLS policies (added alongside every other 0017 table)
before relying on this for real financial data.
