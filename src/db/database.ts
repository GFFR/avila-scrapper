import postgres, { type Sql } from "postgres";
import { config } from "../config.js";
import type { OrndRecord } from "../officernd/client.js";

/**
 * Postgres backup store.
 *
 * Each OfficeRnD collection gets its own table with a schemaless shape:
 *   _id         TEXT PRIMARY KEY  — the OfficeRnD record id
 *   created_at  TIMESTAMPTZ       — extracted for convenience/queries
 *   modified_at TIMESTAMPTZ       — extracted; drives incremental sync
 *   synced_at   TIMESTAMPTZ       — when we last wrote this row
 *   data        JSONB             — full raw record (source of truth, queryable)
 *
 * Keeping the full JSONB makes the store resilient to OfficeRnD adding/renaming
 * fields, keeps it queryable for the future views app, and trivially
 * re-exportable to portable JSON snapshots.
 */
const VALID_IDENT = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export class BackupDB {
  readonly sql: Sql;

  constructor(connectionString: string = config.db.url) {
    this.sql = postgres(connectionString, {
      ssl: config.db.ssl ? "require" : false,
      max: 5,
      onnotice: () => {}, // silence NOTICE noise (e.g. "table already exists")
    });
  }

  private ident(name: string): string {
    if (!VALID_IDENT.test(name)) throw new Error(`Unsafe identifier: ${name}`);
    return name;
  }

  /** Create the sync-state bookkeeping table. */
  async init(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS _sync_state (
        resource           TEXT PRIMARY KEY,
        last_full_sync_at  TIMESTAMPTZ,
        last_modified_seen TIMESTAMPTZ,
        last_run_at        TIMESTAMPTZ,
        last_record_count  INTEGER
      )
    `;
  }

  /** Ensure a per-resource table exists. */
  async ensureTable(resource: string): Promise<void> {
    const table = this.sql(this.ident(resource));
    await this.sql`
      CREATE TABLE IF NOT EXISTS ${table} (
        _id         TEXT PRIMARY KEY,
        created_at  TIMESTAMPTZ,
        modified_at TIMESTAMPTZ,
        synced_at   TIMESTAMPTZ NOT NULL,
        data        JSONB NOT NULL
      )
    `;
    await this.sql`
      CREATE INDEX IF NOT EXISTS ${this.sql(this.ident(`idx_${resource}_modified_at`))}
      ON ${table} (modified_at)
    `;
  }

  /** Upsert a batch of records into a resource table. Returns rows written. */
  async upsertBatch(resource: string, records: OrndRecord[]): Promise<number> {
    if (records.length === 0) return 0;
    const table = this.sql(this.ident(resource));
    const syncedAt = new Date().toISOString();
    const rows = records.map((r) => ({
      _id: r._id,
      created_at: r.createdAt ?? null,
      modified_at: r.modifiedAt ?? r.updatedAt ?? null,
      synced_at: syncedAt,
      data: this.sql.json(r as unknown as Parameters<Sql["json"]>[0]),
    }));

    await this.sql`
      INSERT INTO ${table} ${this.sql(rows, "_id", "created_at", "modified_at", "synced_at", "data")}
      ON CONFLICT (_id) DO UPDATE SET
        created_at  = EXCLUDED.created_at,
        modified_at = EXCLUDED.modified_at,
        synced_at   = EXCLUDED.synced_at,
        data        = EXCLUDED.data
    `;
    return records.length;
  }

  async countRows(resource: string): Promise<number> {
    const table = this.sql(this.ident(resource));
    const [row] = await this.sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM ${table}`;
    return row?.n ?? 0;
  }

  /** Highest modified_at currently stored — the watermark for incremental sync. */
  async maxModifiedAt(resource: string): Promise<string | undefined> {
    const table = this.sql(this.ident(resource));
    const [row] = await this.sql<{ m: Date | null }[]>`
      SELECT MAX(modified_at) AS m FROM ${table}
    `;
    return row?.m ? row.m.toISOString() : undefined;
  }

  async getSyncState(resource: string) {
    const [row] = await this.sql`SELECT * FROM _sync_state WHERE resource = ${resource}`;
    return row as
      | {
          resource: string;
          last_full_sync_at: Date | null;
          last_modified_seen: Date | null;
          last_run_at: Date | null;
          last_record_count: number | null;
        }
      | undefined;
  }

  async recordSyncState(
    resource: string,
    opts: { full: boolean; modifiedSeen?: string; count: number },
  ): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.getSyncState(resource);
    const fullAt = opts.full ? now : existing?.last_full_sync_at ?? null;
    const modified = opts.modifiedSeen ?? existing?.last_modified_seen ?? null;
    await this.sql`
      INSERT INTO _sync_state (resource, last_full_sync_at, last_modified_seen, last_run_at, last_record_count)
      VALUES (${resource}, ${fullAt}, ${modified}, ${now}, ${opts.count})
      ON CONFLICT (resource) DO UPDATE SET
        last_full_sync_at  = ${fullAt},
        last_modified_seen = ${modified},
        last_run_at        = ${now},
        last_record_count  = ${opts.count}
    `;
  }

  /** Read all rows of a resource as parsed records, ordered by _id (stable diffs). */
  async allRecords(resource: string): Promise<OrndRecord[]> {
    const table = this.sql(this.ident(resource));
    const rows = await this.sql<{ data: OrndRecord }[]>`
      SELECT data FROM ${table} ORDER BY _id
    `;
    return rows.map((r) => r.data);
  }

  async close(): Promise<void> {
    await this.sql.end();
  }
}
