import fs from "node:fs";
import path from "node:path";
import { BackupDB } from "../db/database.js";
import { RESOURCES } from "../officernd/resources.js";
import { config } from "../config.js";
import { log } from "../logger.js";

/**
 * Export each resource table to a pretty-printed, stably-ordered JSON file under
 * data/json/. This is the canonical, git-committed, vendor-portable backup.
 * Stable ordering (by _id) keeps git diffs minimal day-to-day.
 */
export async function exportJson(db: BackupDB, dir: string = config.paths.jsonDir): Promise<number> {
  fs.mkdirSync(dir, { recursive: true });
  let files = 0;
  const manifest: Record<string, number> = {};

  for (const def of RESOURCES) {
    await db.ensureTable(def.name);
    const records = await db.allRecords(def.name);
    const file = path.join(dir, `${def.name}.json`);
    fs.writeFileSync(file, JSON.stringify(records, null, 2) + "\n");
    manifest[def.name] = records.length;
    files++;
    log.debug(`Exported ${def.name}`, { records: records.length });
  }

  fs.writeFileSync(
    path.join(dir, "_manifest.json"),
    JSON.stringify({ exportedAt: new Date().toISOString(), counts: manifest }, null, 2) + "\n",
  );
  log.info("JSON export complete", { files, dir });
  return files;
}

/**
 * Rebuild the Postgres store from committed JSON snapshots. Lets anyone restore a
 * queryable DB from the repo alone (e.g. into a fresh Dokploy Postgres instance).
 */
export async function restoreFromJson(db: BackupDB, dir: string = config.paths.jsonDir): Promise<number> {
  let total = 0;
  for (const def of RESOURCES) {
    const file = path.join(dir, `${def.name}.json`);
    if (!fs.existsSync(file)) continue;
    await db.ensureTable(def.name);
    const records = JSON.parse(fs.readFileSync(file, "utf8"));
    const written = await db.upsertBatch(def.name, records);
    total += written;
    log.debug(`Restored ${def.name}`, { records: written });
  }
  log.info("Restore from JSON complete", { records: total });
  return total;
}
