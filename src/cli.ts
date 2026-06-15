#!/usr/bin/env node
import { Command } from "commander";
import { runSync } from "./runSync.js";
import { BackupDB } from "./db/database.js";
import { exportJson, restoreFromJson } from "./export/json.js";
import { RESOURCES } from "./officernd/resources.js";
import { log } from "./logger.js";

const program = new Command();
program.name("avila").description("OfficeRnD Flex data backup/sync tool");

program
  .command("sync")
  .description("Sync data from OfficeRnD into the local store (incremental by default)")
  .option("--full", "Ignore watermarks and pull every record", false)
  .option("--only <resources>", "Comma-separated resource names to sync")
  .option("--no-export", "Skip writing JSON snapshots after syncing")
  .option("--commit", "Git-commit & push the JSON snapshots after export", false)
  .action(async (o: { full: boolean; only?: string; export: boolean; commit: boolean }) => {
    const only = o.only?.split(",").map((s) => s.trim()).filter(Boolean);
    const results = await runSync({ full: o.full, only, exportAfter: o.export, commit: o.commit });
    printSummary(results);
    if (results.some((r) => !r.ok)) process.exitCode = 1;
  });

program
  .command("export")
  .description("Re-export the SQLite store to JSON snapshots")
  .action(() => {
    const db = new BackupDB();
    try {
      exportJson(db);
    } finally {
      db.close();
    }
  });

program
  .command("restore")
  .description("Rebuild the SQLite store from committed JSON snapshots")
  .action(() => {
    const db = new BackupDB();
    try {
      restoreFromJson(db);
    } finally {
      db.close();
    }
  });

program
  .command("backup")
  .description("Full run: sync everything, export JSON, and git-commit the snapshots")
  .action(async () => {
    const results = await runSync({ exportAfter: true, commit: true });
    printSummary(results);
    if (results.some((r) => !r.ok)) process.exitCode = 1;
  });

program
  .command("resources")
  .description("List the OfficeRnD collections this tool backs up")
  .action(() => {
    for (const r of RESOURCES) {
      log.info(`${r.name.padEnd(22)} ${r.path.padEnd(24)} ${r.incremental ? "incremental" : "full"}`);
    }
  });

program.parseAsync().catch((err) => {
  log.error("Fatal error", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});

function printSummary(results: { resource: string; mode: string; records: number; ok: boolean; error?: string }[]) {
  for (const r of results) {
    const status = r.ok ? "ok" : "FAIL";
    log.info(`  ${status.padEnd(4)} ${r.resource.padEnd(22)} ${r.mode.padEnd(11)} ${r.records} rec${r.error ? " — " + r.error : ""}`);
  }
}
