See [AGENTS.md](AGENTS.md) for the working guide, and **[docs/06-RULES.md](docs/06-RULES.md)** for the full rulebook (it wins on any conflict).

Quick orientation:

- `docs/00-OVERVIEW.md` — index of all spec docs + product recommendations
- `docs/15-BUILD-LOG.md` — what is actually built vs. still spec
- `docs/08-MEMORY.md` — decision log (why the stack looks like this)
- `docs/05-SCHEMA.md` + `db/migrations/0000_init.sql` — data model (SQL migration is authoritative)
- `docs/09-API-SPEC.md` — endpoint contracts (some still to be implemented on Next route handlers)

Before finishing any change: `npm run typecheck && npm run lint && npm run build`.
