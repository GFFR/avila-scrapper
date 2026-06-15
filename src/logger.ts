/** Minimal structured logger — timestamps + levels, no dependency. */
type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, msg: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const suffix = meta && Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
  const line = `${ts} ${level.toUpperCase().padEnd(5)} ${msg}${suffix}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, meta?: Record<string, unknown>) => {
    if (process.env.DEBUG) emit("debug", msg, meta);
  },
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};
