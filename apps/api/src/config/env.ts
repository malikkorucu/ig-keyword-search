import { z } from 'zod';

/** Compose/Coolify pass unset variables as "" (e.g. `${VAR:-}`); treat that as not set. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const booleanish = optional(z.enum(['true', 'false', '1', '0'])).transform(
  (v) => v === 'true' || v === '1',
);

/**
 * Infrastructure configuration only. Business rules (keywords, accounts, poll interval,
 * media limit, OCR toggle…) live in the database and are edited from the panel.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  /** Optional so the panel can start before Meta credentials exist; polls then fail with an auth error. */
  IG_USER_ID: optional(z.string().regex(/^\d+$/, 'IG_USER_ID must be numeric')),
  /** Initial long-lived token; only used while the DB has no token yet. */
  IG_ACCESS_TOKEN: optional(z.string().min(10)),
  FB_APP_ID: z.string().min(1),
  FB_APP_SECRET: z.string().min(1),
  GRAPH_API_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/)
    .default('v21.0'),
  /** Override only for tests / local fakes. */
  GRAPH_API_BASE_URL: z.url().default('https://graph.facebook.com'),
  PANEL_PASSWORD: z.string().min(6, 'PANEL_PASSWORD must be at least 6 characters'),
  /** Signs the session cookie. Falls back to a value derived from PANEL_PASSWORD. */
  SESSION_SECRET: optional(z.string().min(16)),
  /** Set to true only when the panel is served over HTTPS. */
  COOKIE_SECURE: booleanish,
  DATABASE_SSL: booleanish,
  /** Where tesseract.js caches downloaded traineddata files. */
  TESSERACT_CACHE_DIR: z.string().default('./.tesseract-cache'),
  /** Telegram bot token from @BotFather. Unset = Telegram notifications disabled. */
  TELEGRAM_BOT_TOKEN: optional(z.string().regex(/^\d+:[\w-]{30,}$/, 'Invalid TELEGRAM_BOT_TOKEN')),
  OCR_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(1),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}

/** Nest DI token for the validated env object. */
export const ENV = Symbol('ENV');
