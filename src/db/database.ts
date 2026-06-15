import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import type { OrndRecord } from "../officernd/client.js";

/**
 * SQLite backup store.
 *
 * Each OfficeRnD collection gets its own table with a schemaless shape:
 *   _id        TEXT PRIMARY KEY  — the OfficeRnD record id
 *   createdAt  TEXT              — extracted for convenience/queries
 *   modifiedAt TEXT             — extracted; drives incremental sync
 *   syncedAt   TEXT             — when we last wrote this row
 *   data       TEXT             — full raw JSON of the record (source of truth)
 *
 * Keeping the full JSON makes the store resilient to OfficeRnD adding/renaming
 * fields, and trivially re-exportable to portable JSON snapshots.
 */
export class BackupDB {
  readonly db: Database.Database;

  constructor(file: string = config.paths.sqliteFile) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initMeta();
  }

  private initMeta() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _sync_state (
        resource          TEXT PRIMARY KEY,
        last_full_sync_at  TEXT,
        last_modified_seen TEXT,
        last_run_at        TEXT,
        last_record_count  INTEGER
      );
    `);
  }

  /** Ensure a per-resource table exists. */
  ensureTable(resource: string) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS "${resource}" (
        _id        TEXT PRIMARY KEY,
        createdAt  TEXT,
        modifiedAt TEXT,
        syncedAt   TEXT NOT NULL,
        data       TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "idx_${resource}_modifiedAt" ON "${resource}" (modifiedAt);
    `);
  }

  /** Upsert a batch of records into a resource table. Returns rows written. */
  upsertBatch(resource: string, records: OrndRecord[]): number {
    if (records.length === 0) return 0;
    const syncedAt = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO "${resource}" (_id, createdAt, modifiedAt, syncedAt, data)
      VALUES (@_id, @createdAt, @modifiedAt, @syncedAt, @data)
      ON CONFLICT(_id) DO UPDATE SET
        createdAt  = excluded.createdAt,
        modifiedAt = excluded.modifiedAt,
        syncedAt   = excluded.syncedAt,
        data       = excluded.data
    `);
    const tx = this.db.transaction((rows: OrndRecord[]) => {
      for (const r of rows) {
        stmt.run({
          _id: r._id,
          createdAt: r.createdAt ?? null,
          modifiedAt: r.modifiedAt ?? r.updatedAt ?? null,
          syncedAt,
          data: JSON.stringify(r),
        });
      }
    });
    tx(records);
    return records.length;
  }

  countRows(resource: string): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS n FROM "${resource}"`).get() as { n: number };
    return row.n;
  }

  /** Highest modifiedAt currently stored — the watermark for incremental sync. */
  maxModifiedAt(resource: string): string | undefined {
    const row = this.db
      .prepare(`SELECT MAX(modifiedAt) AS m FROM "${resource}" WHERE modifiedAt IS NOT NULL`)
      .get() as { m: string | null };
    return row.m ?? undefined;
  }

  getSyncState(resource: string) {
    return this.db.prepare(`SELECT * FROM _sync_state WHERE resource = ?`).get(resource) as
      | {
          resource: string;
          last_full_sync_at: string | null;
          last_modified_seen: string | null;
          last_run_at: string | null;
          last_record_count: number | null;
        }
      | undefined;
  }

  recordSyncState(resource: string, opts: { full: boolean; modifiedSeen?: string; count: number }) {
    const now = new Date().toISOString();
    const existing = this.getSyncState(resource);
    this.db
      .prepare(
        `INSERT INTO _sync_state (resource, last_full_sync_at, last_modified_seen, last_run_at, last_record_count)
         VALUES (@resource, @full, @modified, @run, @count)
         ON CONFLICT(resource) DO UPDATE SET
           last_full_sync_at  = @full,
           last_modified_seen = @modified,
           last_run_at        = @run,
           last_record_count  = @count`,
      )
      .run({
        resource,
        full: opts.full ? now : existing?.last_full_sync_at ?? null,
        modified: opts.modifiedSeen ?? existing?.last_modified_seen ?? null,
        run: now,
        count: opts.count,
      });
  }

  /** Read all rows of a resource as parsed records, ordered by _id (stable diffs). */
  allRecords(resource: string): OrndRecord[] {
    const rows = this.db
      .prepare(`SELECT data FROM "${resource}" ORDER BY _id`)
      .all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as OrndRecord);
  }

  close() {
    this.db.close();
  }
}
