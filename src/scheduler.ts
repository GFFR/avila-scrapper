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

  log.info("Scheduler started", {
    cron: config.schedule.cron,
    tz: config.schedule.tz,
    autoGitCommit: config.schedule.autoGitCommit,
  });

  // Run once on boot so a fresh deploy populates the store immediately.
  if (process.env.SYNC_ON_BOOT !== "false") {
    await safeRun();
  }

  cron.schedule(config.schedule.cron, safeRun, { timezone: config.schedule.tz });
}

let running = false;
async function safeRun() {
  if (running) {
    log.warn("Previous sync still running; skipping this tick");
    return;
  }
  running = true;
  try {
    await runSync({ commit: config.schedule.autoGitCommit });
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
