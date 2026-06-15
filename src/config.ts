import { config as loadEnv } from "dotenv";
import { z } from "zod";
import path from "node:path";

loadEnv();

const schema = z.object({
  OFFICERND_CLIENT_ID: z.string().min(1, "OFFICERND_CLIENT_ID is required"),
  OFFICERND_CLIENT_SECRET: z.string().min(1, "OFFICERND_CLIENT_SECRET is required"),
  OFFICERND_ORG_SLUG: z.string().min(1, "OFFICERND_ORG_SLUG is required"),
  OFFICERND_SCOPES: z.string().optional().default(""),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (Postgres connection string)"),
  DB_SSL: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v.toLowerCase() === "true"),
  DATA_DIR: z.string().optional().default("./data"),
  SYNC_CRON: z.string().optional().default("15 3 * * *"),
  SYNC_TZ: z.string().optional().default("Europe/Lisbon"),
  AUTO_GIT_COMMIT: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v.toLowerCase() === "true"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid configuration. Check your .env file:\n${issues}`);
}

const env = parsed.data;
const dataDir = path.resolve(env.DATA_DIR);

export const config = {
  officernd: {
    clientId: env.OFFICERND_CLIENT_ID,
    clientSecret: env.OFFICERND_CLIENT_SECRET,
    orgSlug: env.OFFICERND_ORG_SLUG,
    scopes: env.OFFICERND_SCOPES.trim(),
    tokenUrl: "https://identity.officernd.com/oauth/token",
    baseUrl: `https://app.officernd.com/api/v2/organizations/${env.OFFICERND_ORG_SLUG}`,
  },
  db: {
    url: env.DATABASE_URL,
    ssl: env.DB_SSL,
  },
  paths: {
    dataDir,
    jsonDir: path.join(dataDir, "json"),
  },
  schedule: {
    cron: env.SYNC_CRON,
    tz: env.SYNC_TZ,
    autoGitCommit: env.AUTO_GIT_COMMIT,
  },
} as const;

export type AppConfig = typeof config;
