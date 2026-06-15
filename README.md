# Avila Scrapper

Daily backup/sync of **OfficeRnD Flex** data. OfficeRnD has no export feature, so
this tool maintains our own vendor-portable backup: it pulls every collection via
the OfficeRnD API v2 into a **Postgres** database and writes **git-committed JSON
snapshots** alongside it. If we ever switch vendors, the JSON is the canonical,
portable copy.

## How it works

```
OfficeRnD API v2  ──►  Postgres (jsonb per record)  ──►  JSON (data/json/*.json)
   (cursor paging)     live queryable store (Dokploy)      committed to git
```

- **Postgres** = the live queryable store the future "views" app reads. Runs as a
  Dokploy-managed service (with its own backups). Tables hold one `jsonb` row per
  record, so it's resilient to OfficeRnD adding/renaming fields.
- **JSON snapshots** = the canonical backup, committed to this repo. Stably
  ordered by record id for clean day-to-day diffs, and host-independent — the
  store can be rebuilt into any fresh Postgres via `pnpm restore`.
- **Sync** is incremental by default (uses each record's `modifiedAt` watermark),
  with automatic fallback to a full pull when an API filter isn't supported.
  Static/small collections (plans, locations, tax rates…) are pulled in full.

Each record is stored with its OfficeRnD `_id` as the primary key plus the full
raw record as `jsonb`.

## Setup

Requires Node ≥ 20, pnpm, and a Postgres database.

```bash
pnpm install
cp .env.example .env   # then fill in credentials + DATABASE_URL
```

For local development, `docker compose up db` starts a Postgres matching the
default `DATABASE_URL` in `.env.example`.

### Credentials

In OfficeRnD: **Settings → Data & Extensibility → Developer Tools → Add
Application** (Read-only is enough). Copy the Client ID and Client Secret into
`.env`, and set `OFFICERND_ORG_SLUG` to your org slug.

If list calls return 403, set explicit read scopes in `OFFICERND_SCOPES`
(space-separated, e.g. `flex.community.members.read flex.billing.payments.read`).

## Usage

```bash
pnpm sync                 # incremental sync of all resources + JSON export
pnpm sync:full            # full pull of everything
pnpm dev sync --only members,companies   # sync specific resources
pnpm export               # re-export Postgres -> JSON
pnpm restore              # rebuild Postgres from committed JSON
pnpm dev resources        # list backed-up collections
pnpm dev backup           # sync + export + git commit/push snapshots
```

## Deployment (VPS / Dokploy)

The container's default command is a long-running **scheduler** that runs an
incremental sync on `SYNC_CRON` (default `15 3 * * *`, Europe/Lisbon).

1. In Dokploy, provision a **Postgres** database service (it handles backups).
2. Create a Dokploy application from this repo (Dockerfile build).
3. Set the environment variables from `.env.example` as Dokploy secrets — point
   `DATABASE_URL` at the provisioned Postgres' internal connection string.
4. Add a **persistent volume** mounted at `/app/data` so the JSON snapshots
   survive redeploys.
5. (Optional) Set `AUTO_GIT_COMMIT=true` and provide a write-enabled deploy key
   to push JSON snapshots back to this repo after each run.

Locally: `docker compose up --build` (starts Postgres + the scrapper).

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `OFFICERND_CLIENT_ID` / `OFFICERND_CLIENT_SECRET` | — | OAuth2 client-credentials |
| `OFFICERND_ORG_SLUG` | — | Organization slug |
| `OFFICERND_SCOPES` | _(empty)_ | Optional explicit OAuth scopes |
| `DATABASE_URL` | — | Postgres connection string |
| `DB_SSL` | `false` | Require TLS for the Postgres connection |
| `DATA_DIR` | `./data` | Where JSON snapshots are written |
| `SYNC_CRON` | `15 3 * * *` | Scheduler cron |
| `SYNC_TZ` | `Europe/Lisbon` | Cron timezone |
| `AUTO_GIT_COMMIT` | `false` | Commit & push snapshots after each sync |

## API notes

- Auth: OAuth2 client-credentials, token at `identity.officernd.com/oauth/token`
  (cached ~1h; token endpoint limited to 5 req/min).
- Base: `app.officernd.com/api/v2/organizations/{slug}`.
- Pagination: cursor-based, `$limit` max 50, follow `cursorNext`.
- Rate limits: ~400 reads/min. Handled with 429/`Retry-After` backoff.
- Incremental: `modifiedAt[$gte]=<ISO>`. Filterability per collection isn't
  guaranteed by docs, hence the automatic full-pull fallback.

See `src/officernd/` for the client and resource registry.
