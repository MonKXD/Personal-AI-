# Module Spec: Finance Tracking (Deepened)

## Chosen approach: manual entry (existing) + statement upload with AI categorization

Not the Account Aggregator framework — that's usage-based per linked account/fetch and generally built for registered fintech businesses acting as an FIU, which is real friction for a personal project without a clear present need for live balances. This spec gets most of the practical value (categorized spending, trends, budget awareness) without that friction. It's a clean upgrade path later if it turns out live bank data is actually wanted.

## What's new vs. the existing expense-logging page

The existing page presumably already handles manual entry — this spec adds statement upload as a second, faster input path, plus categorization and a proper transactions view on top of both.

## Statement upload flow

1. User uploads a bank/UPI statement (PDF or CSV export) via a new upload UI, labeling which account it's from (e.g., "HDFC Savings")
2. Backend parses the file:
   - CSV: straightforward column parsing
   - PDF: extract text (a PDF text-extraction library), then pass to Claude to normalize into structured rows — bank statement PDF formats vary too much for hand-written regex to hold up
3. Each parsed row goes through a categorization step: Claude assigns `category` and confidence based on `merchant`/description text (e.g., "Zomato" → "Food", "Uber" → "Travel")
4. Dedupe against existing transactions in the same date range (avoid double-counting if a statement is re-uploaded) before writing
5. Write to `finance_transactions` with `source: "statement_upload"` and the batch's `statementBatchId`; write batch metadata to `finance_statement_batches`

## Data model

See `finance_transactions` and `finance_statement_batches` in `docs/00-firestore-schema.md`.

## Category taxonomy (starting point — adjust freely)

Food, Travel, Subscriptions, Education, Shopping, Rent/Housing, Health, Entertainment, Transfers, Income, Other. Let categorization suggest new categories if a transaction clearly doesn't fit, rather than forcing everything into "Other."

## Budgets (optional — build only if wanted after the base is working)

Simple monthly limit per category (`finance_budgets`), dashboard shows spend-vs-limit as a progress indicator. Not essential for v1.

## Agent tools to register

```json
{
  "name": "add_transaction",
  "description": "Log a manual income or expense entry",
  "input_schema": {
    "type": "object",
    "properties": {
      "date": { "type": "string" },
      "amount": { "type": "number" },
      "direction": { "type": "string", "enum": ["income", "expense"] },
      "category": { "type": "string" },
      "note": { "type": "string" }
    },
    "required": ["date", "amount", "direction", "category"]
  }
}
```

```json
{
  "name": "get_spending_summary",
  "description": "Get a category breakdown of spending for a given period",
  "input_schema": {
    "type": "object",
    "properties": {
      "month": { "type": "string", "description": "YYYY-MM" }
    }
  }
}
```

## UI

Transactions table (sortable, filterable by category/source/date range), a category breakdown chart for the current month, and a simple month-over-month trend view. Keep it in the existing dark charcoal + teal-green design system.

## Privacy note

Statement uploads contain real financial data — make sure uploaded files aren't left sitting in any public/temp storage bucket longer than needed for parsing, and that Firestore security rules restrict `finance_*` collections to Harsh's own authenticated session only (should already be true if auth is set up correctly for the rest of the app, but worth explicitly verifying for this module given the sensitivity).
