import { OfficeRndClient } from "../officernd/client.js";
import { BackupDB } from "../db/database.js";
import { RESOURCES, type ResourceDef } from "../officernd/resources.js";
import { log } from "../logger.js";

// On incremental fan-out, include parents modified within this window before the
// last run, to absorb clock skew and long-running syncs.
const FANOUT_OVERLAP_MS = 48 * 60 * 60 * 1000;

export interface SyncOptions {
  /** Ignore watermarks and pull every record for every resource. */
  full?: boolean;
  /** Restrict the run to these resource names (defaults to all). */
  only?: string[];
}

export interface ResourceResult {
  resource: string;
  mode: "full" | "incremental" | "skipped";
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

    // Fan-out resources depend on their parent being synced first, so run them last.
    const ordered = [...targets].sort((a, b) => Number(!!a.fanOut) - Number(!!b.fanOut));

    const results: ResourceResult[] = [];
    for (const resource of ordered) {
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
    if (def.available === false) {
      log.warn(`Skipping ${def.name}: scope "${def.scope}" not granted to the API app`);
      return { resource: def.name, mode: "skipped", records: 0, ok: true };
    }
    await this.db.ensureTable(def.name);

    if (def.fanOut) return this.syncFanOut(def, forceFull);

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

  /** Pull a collection that requires a parent filter, once per parent id. */
  private async syncFanOut(def: ResourceDef, forceFull: boolean): Promise<ResourceResult> {
    const { parent, param } = def.fanOut!;

    // Incremental fan-out: only iterate parents changed since the last run. This
    // cuts daily request count dramatically. Caveat: child changes that don't
    // bump the parent's modifiedAt are missed until the next full reconciliation,
    // so run `sync --full` periodically (e.g. weekly).
    const prior = await this.db.getSyncState(def.name);
    const incremental = def.incremental && !forceFull && !!prior?.last_run_at;
    let parentIds: string[];
    let mode: "full" | "incremental";
    if (incremental) {
      const since = new Date(prior!.last_run_at!.getTime() - FANOUT_OVERLAP_MS).toISOString();
      parentIds = await this.db.idsModifiedSince(parent, since);
      mode = "incremental";
      log.info(`Syncing ${def.name} (fan-out)`, { parent, mode, since, parents: parentIds.length });
    } else {
      parentIds = await this.db.allIds(parent);
      mode = "full";
      log.info(`Syncing ${def.name} (fan-out)`, { parent, mode, parents: parentIds.length });
    }

    let written = 0;
    let errors = 0;
    let lastError: unknown;
    for (const id of parentIds) {
      try {
        for await (const page of this.client.listAll(def.path, { extraParams: { [param]: id } })) {
          written += await this.db.upsertBatch(def.name, page);
        }
      } catch (err) {
        // A single parent failing (e.g. transient 429 after retries) shouldn't
        // abort the whole collection — log and keep going.
        errors++;
        lastError = err;
        log.warn(`Fan-out ${def.name} failed for ${param}=${id}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const total = await this.db.countRows(def.name);
    await this.db.recordSyncState(def.name, { full: mode === "full", count: total });
    log.info(`Synced ${def.name}`, { mode: `fan-out/${mode}`, written, total, parentErrors: errors });

    if (errors > 0) {
      const error = `${errors}/${parentIds.length} ${param} queries failed (last: ${lastError instanceof Error ? lastError.message : String(lastError)})`;
      return { resource: def.name, mode, records: written, ok: false, error };
    }
    return { resource: def.name, mode, records: written, ok: true };
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
