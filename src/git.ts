import { execFileSync } from "node:child_process";
import { config } from "./config.js";
import { log } from "./logger.js";

/**
 * Commit & push the JSON snapshots as a versioned backup. Used by the scheduler
 * when AUTO_GIT_COMMIT=true. Requires a configured git identity and a
 * write-enabled remote (deploy key) in the runtime environment.
 */
export function commitBackup(): void {
  const cwd = process.cwd();
  const run = (args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" });

  try {
    run(["add", config.paths.jsonDir]);
    const status = run(["status", "--porcelain", config.paths.jsonDir]).trim();
    if (!status) {
      log.info("No backup changes to commit");
      return;
    }
    const stamp = new Date().toISOString();
    run(["commit", "-m", `chore(backup): OfficeRnD snapshot ${stamp}`]);
    run(["push"]);
    log.info("Pushed backup snapshot", { stamp });
  } catch (err) {
    log.error("Auto git commit failed", { error: err instanceof Error ? err.message : String(err) });
  }
}
