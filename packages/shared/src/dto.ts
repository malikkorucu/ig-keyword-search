import type { MatchSource, MatchStatus, PollRunStatus, PollTrigger } from './enums';

/** All timestamps are ISO-8601 strings in UTC. */
export type IsoDate = string;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface KeywordDto {
  id: string;
  value: string;
  active: boolean;
  createdAt: IsoDate;
}

export interface AccountDto {
  id: string;
  username: string;
  active: boolean;
  accessible: boolean;
  inaccessibleReason: string | null;
  lastError: string | null;
  lastCheckedAt: IsoDate | null;
  lastPolledAt: IsoDate | null;
  createdAt: IsoDate;
}

export interface MatchDto {
  id: string;
  postId: string;
  accountId: string | null;
  username: string;
  keywords: string[];
  source: MatchSource;
  snippet: string;
  ocrText: string | null;
  permalink: string;
  postedAt: IsoDate;
  detectedAt: IsoDate;
  status: MatchStatus;
}

export interface PollRunErrorDto {
  username?: string;
  postId?: string;
  code?: number;
  kind: string;
  message: string;
}

export interface PollRunDto {
  id: string;
  trigger: PollTrigger;
  status: PollRunStatus;
  startedAt: IsoDate;
  finishedAt: IsoDate | null;
  accountsScanned: number;
  postsScanned: number;
  newPosts: number;
  matchesFound: number;
  ocrJobsEnqueued: number;
  errorCount: number;
  errors: PollRunErrorDto[];
  note: string | null;
}

export interface SettingsDto {
  pollIntervalMinutes: number;
  mediaLimit: number;
  ocrEnabled: boolean;
  tokenRefreshThresholdDays: number;
  rateLimitPauseMinutes: number;
  pollSuspendedUntil: IsoDate | null;
  pollSuspendReason: string | null;
  updatedAt: IsoDate;
}

export interface TokenStatusDto {
  configured: boolean;
  expiresAt: IsoDate | null;
  daysLeft: number | null;
  lastRefreshedAt: IsoDate | null;
  lastRefreshAttemptAt: IsoDate | null;
  lastRefreshError: string | null;
  /** true when the last refresh failed or the token is about to expire / expired */
  critical: boolean;
}

export interface QueueStatsDto {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}

export interface DashboardDto {
  lastRun: PollRunDto | null;
  nextPollAt: IsoDate | null;
  pollSuspendedUntil: IsoDate | null;
  pollSuspendReason: string | null;
  token: TokenStatusDto;
  activeAccounts: number;
  inaccessibleAccounts: number;
  matchesLast24h: number;
  newMatches: number;
  queues: QueueStatsDto[];
  recentErrors: Array<PollRunErrorDto & { at: IsoDate }>;
}

export interface VerifyAccountResultDto {
  account: AccountDto;
  accessible: boolean;
  message: string | null;
}

export interface TokenRefreshResultDto {
  refreshed: boolean;
  message: string;
  token: TokenStatusDto;
}

export interface SessionDto {
  authenticated: boolean;
}

export interface TelegramChatDto {
  id: string;
  chatId: string;
  label: string;
  active: boolean;
  lastError: string | null;
  lastSentAt: IsoDate | null;
  createdAt: IsoDate;
}

export interface TelegramStatusDto {
  /** TELEGRAM_BOT_TOKEN is set */
  configured: boolean;
  botUsername: string | null;
  botError: string | null;
  chats: TelegramChatDto[];
}

export interface DiscoveredTelegramChatDto {
  chatId: string;
  type: string;
  title: string;
  alreadyAdded: boolean;
}
