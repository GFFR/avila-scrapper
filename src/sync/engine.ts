import { OfficeRndClient } from "../officernd/client.js";
import { BackupDB } from "../db/database.js";
import { RESOURCES, type ResourceDef } from "../officernd/resources.js";
import { log } from "../logger.js";

export interface SyncOptions {
  /** Ignore watermarks and pull every record for every resource. */
  full?: boolean;
  /** Restrict the run to these resource names (defaults to all). */
  only?: string[];
}

export interface ResourceResult {
  resource: string;
  mode: "full" | "incremental";
  records: number;
  ok: boolean;
  error?: string;
}

export class SyncEngine {
  constructor(
    private readonly client: OfficeRndClient,
    private readonly db: BackupDB,
  ) {}

  async run(opts: SyncOptions = {}): Promise<ResourceResult[]> {
    const targets = opts.only
      ? RESOURCES.filter((r) => opts.only!.includes(r.name))
      : RESOURCES;

    const results: ResourceResult[] = [];
    for (const resource of targets) {
      results.push(await this.syncResource(resource, opts.full ?? false));
    }

    const totals = results.reduce(
      (acc, r) => ({ records: acc.records + r.records, failed: acc.failed + (r.ok ? 0 : 1) }),
      { records: 0, failed: 0 },
    );
    log.info("Sync complete", { resources: results.length, records: totals.records, failed: totals.failed });
    return results;
  }

  private async syncResource(def: ResourceDef, forceFull: boolean): Promise<ResourceResult> {
    await this.db.ensureTable(def.name);
    const useIncremental = def.incremental && !forceFull;
    const watermark = useIncremental ? await this.db.maxModifiedAt(def.name) : undefined;
    const mode: "full" | "incremental" = watermark ? "incremental" : "full";

    log.info(`Syncing ${def.name}`, { mode, since: watermark });

    try {
      const count = await this.pull(def, watermark);
      const total = await this.db.countRows(def.name);
      await this.db.recordSyncState(def.name, {
        full: mode === "full",
        modifiedSeen: await this.db.maxModifiedAt(def.name),
        count: total,
      });
      log.info(`Synced ${def.name}`, { mode, written: count, total });
      return { resource: def.name, mode, records: count, ok: true };
    } catch (err) {
      // If an incremental filter was rejected, retry once with a full pull.
      if (mode === "incremental" && isFilterError(err)) {
        log.warn(`Incremental filter rejected for ${def.name}; falling back to full pull`);
        try {
          const count = await this.pull(def, undefined);
          await this.db.recordSyncState(def.name, {
            full: true,
            modifiedSeen: await this.db.maxModifiedAt(def.name),
            count: await this.db.countRows(def.name),
          });
          return { resource: def.name, mode: "full", records: count, ok: true };
        } catch (err2) {
          return fail(def.name, "full", err2);
        }
      }
      return fail(def.name, mode, err);
    }
  }

  private async pull(def: ResourceDef, modifiedSince?: string): Promise<number> {
    let written = 0;
    for await (const page of this.client.listAll(def.path, {
      modifiedSince,
      incrementalField: def.incrementalField,
    })) {
      written += await this.db.upsertBatch(def.name, page);
    }
    return written;
  }
}

function isFilterError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b400\b|\b422\b|filter|index|query/i.test(msg);
}

function fail(resource: string, mode: "full" | "incremental", err: unknown): ResourceResult {
  const error = err instanceof Error ? err.message : String(err);
  log.error(`Failed to sync ${resource}`, { mode, error });
  return { resource, mode, records: 0, ok: false, error };
}
