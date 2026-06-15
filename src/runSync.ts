import { OfficeRndClient } from "./officernd/client.js";
import { BackupDB } from "./db/database.js";
import { SyncEngine, type SyncOptions, type ResourceResult } from "./sync/engine.js";
import { exportJson } from "./export/json.js";
import { commitBackup } from "./git.js";
import { config } from "./config.js";
import { log } from "./logger.js";

export interface RunOptions extends SyncOptions {
  /** Also write JSON snapshots after syncing (default true). */
  exportAfter?: boolean;
  /** Git-commit & push the JSON snapshots after export. */
  commit?: boolean;
}

/** One end-to-end run: sync -> export JSON -> (optionally) commit. */
export async function runSync(opts: RunOptions = {}): Promise<ResourceResult[]> {
  const db = new BackupDB();
  try {
    const engine = new SyncEngine(new OfficeRndClient(), db);
    const results = await engine.run({ full: opts.full, only: opts.only });

    if (opts.exportAfter !== false) exportJson(db);
    if (opts.commit ?? config.schedule.autoGitCommit) commitBackup();

    const failed = results.filter((r) => !r.ok);
    if (failed.length) log.warn("Some resources failed", { failed: failed.map((f) => f.resource) });
    return results;
  } finally {
    db.close();
  }
}
