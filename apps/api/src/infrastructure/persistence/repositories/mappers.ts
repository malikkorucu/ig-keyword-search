import type { MatchSource, MatchStatus, PollRunStatus, PollTrigger } from '@igw/shared';
import type {
  Account,
  Keyword,
  Match,
  PollRun,
  Settings,
  TokenState,
} from '../../../domain/models';
import type {
  AccountEntity,
  ApiTokenEntity,
  AppSettingsEntity,
  KeywordEntity,
  MatchEntity,
  PollRunEntity,
} from '../entities';

export const toSettings = (e: AppSettingsEntity): Settings => ({
  pollIntervalMinutes: e.pollIntervalMinutes,
  mediaLimit: e.mediaLimit,
  ocrEnabled: e.ocrEnabled,
  tokenRefreshThresholdDays: e.tokenRefreshThresholdDays,
  rateLimitPauseMinutes: e.rateLimitPauseMinutes,
  pollSuspendedUntil: e.pollSuspendedUntil,
  pollSuspendReason: e.pollSuspendReason,
  updatedAt: e.updatedAt,
});

export const toToken = (e: ApiTokenEntity): TokenState => ({
  accessToken: e.accessToken,
  expiresAt: e.expiresAt,
  lastRefreshedAt: e.lastRefreshedAt,
  lastRefreshAttemptAt: e.lastRefreshAttemptAt,
  lastRefreshError: e.lastRefreshError,
});

export const toKeyword = (e: KeywordEntity): Keyword => ({
  id: e.id,
  value: e.value,
  active: e.active,
  createdAt: e.createdAt,
});

export const toAccount = (e: AccountEntity): Account => ({
  id: e.id,
  username: e.username,
  active: e.active,
  accessible: e.accessible,
  inaccessibleReason: e.inaccessibleReason,
  lastError: e.lastError,
  lastCheckedAt: e.lastCheckedAt,
  lastPolledAt: e.lastPolledAt,
  createdAt: e.createdAt,
});

export const toMatch = (e: MatchEntity): Match => ({
  id: e.id,
  postId: e.postId,
  accountId: e.accountId,
  username: e.username,
  keywords: e.keywords,
  source: e.source as MatchSource,
  snippet: e.snippet,
  ocrText: e.ocrText,
  permalink: e.permalink,
  postedAt: e.postedAt,
  detectedAt: e.detectedAt,
  status: e.status as MatchStatus,
});

export const toPollRun = (e: PollRunEntity): PollRun => ({
  id: e.id,
  trigger: e.trigger as PollTrigger,
  status: e.status as PollRunStatus,
  startedAt: e.startedAt,
  finishedAt: e.finishedAt,
  accountsScanned: e.accountsScanned,
  postsScanned: e.postsScanned,
  newPosts: e.newPosts,
  matchesFound: e.matchesFound,
  ocrJobsEnqueued: e.ocrJobsEnqueued,
  errorCount: e.errorCount,
  errors: e.errors ?? [],
  note: e.note,
});

/** Postgres unique_violation */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
  );
}
