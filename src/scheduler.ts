import cron from "node-cron";
import { runSync } from "./runSync.js";
import { config } from "./config.js";
import { log } from "./logger.js";

/**
 * Long-running scheduler entrypoint for the VPS (Dokploy "Application").
 * Runs an incremental sync on the configured cron schedule. Set AUTO_GIT_COMMIT
 * to also push JSON snapshots to git after each run.
 */
async function main() {
  if (!cron.validate(config.schedule.cron)) {
    throw new Error(`Invalid SYNC_CRON expression: "${config.schedule.cron}"`);
  }
  if (!cron.validate(config.schedule.fullCron)) {
    throw new Error(`Invalid SYNC_FULL_CRON expression: "${config.schedule.fullCron}"`);
  }

  log.info("Scheduler started", {
    cron: config.schedule.cron,
    fullCron: config.schedule.fullCron,
    tz: config.schedule.tz,
    autoGitCommit: config.schedule.autoGitCommit,
  });

  // Run once on boot so a fresh deploy populates the store immediately.
  if (process.env.SYNC_ON_BOOT !== "false") {
    await safeRun(false);
  }

  cron.schedule(config.schedule.cron, () => safeRun(false), { timezone: config.schedule.tz });
  cron.schedule(config.schedule.fullCron, () => safeRun(true), { timezone: config.schedule.tz });
}

let running = false;
async function safeRun(full: boolean) {
  if (running) {
    log.warn("Previous sync still running; skipping this tick");
    return;
  }
  running = true;
  try {
    await runSync({ full, commit: config.schedule.autoGitCommit });
  } catch (err) {
    log.error("Scheduled sync threw", { error: err instanceof Error ? err.message : String(err) });
  } finally {
    running = false;
  }
}

main().catch((err) => {
  log.error("Scheduler failed to start", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
