import { z } from 'zod';
import { MATCH_SOURCES, MATCH_STATUSES } from './enums';

/** Instagram usernames: letters, digits, dot, underscore; max 30 chars. A leading "@" is tolerated. */
export const createAccountSchema = z.object({
  username: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@/, '').toLowerCase())
    .pipe(z.string().regex(/^[a-z0-9._]{1,30}$/, 'Geçersiz Instagram kullanıcı adı')),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z.object({
  active: z.boolean(),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const createKeywordSchema = z.object({
  value: z.string().trim().min(2, 'En az 2 karakter').max(100),
});
export type CreateKeywordInput = z.infer<typeof createKeywordSchema>;

export const updateKeywordSchema = z.object({
  active: z.boolean(),
});
export type UpdateKeywordInput = z.infer<typeof updateKeywordSchema>;

export const updateSettingsSchema = z
  .object({
    pollIntervalMinutes: z.number().int().min(1).max(1440),
    mediaLimit: z.number().int().min(1).max(50),
    ocrEnabled: z.boolean(),
    tokenRefreshThresholdDays: z.number().int().min(1).max(59),
    rateLimitPauseMinutes: z.number().int().min(1).max(1440),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'En az bir alan gönderilmeli');
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

export const matchesQuerySchema = z.object({
  accountId: optionalString,
  keyword: optionalString,
  source: z.enum(MATCH_SOURCES).optional(),
  status: z.enum(MATCH_STATUSES).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type MatchesQuery = z.infer<typeof matchesQuerySchema>;

export const updateMatchStatusSchema = z.object({
  status: z.enum(MATCH_STATUSES),
});
export type UpdateMatchStatusInput = z.infer<typeof updateMatchStatusSchema>;

export const pollRunsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type PollRunsQuery = z.infer<typeof pollRunsQuerySchema>;

export const loginSchema = z.object({
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Numeric chat id (users > 0, groups/channels < 0) or a public "@channelname". */
export const createTelegramChatSchema = z.object({
  chatId: z
    .string()
    .trim()
    .regex(
      /^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/,
      'Geçersiz chat ID (ör. -1001234567890 veya @kanaladi)',
    ),
  label: z.string().trim().max(100).optional().default(''),
});
export type CreateTelegramChatInput = z.infer<typeof createTelegramChatSchema>;

export const updateTelegramChatSchema = z.object({
  active: z.boolean(),
});
export type UpdateTelegramChatInput = z.infer<typeof updateTelegramChatSchema>;
