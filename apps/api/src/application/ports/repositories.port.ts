import type {
  CreateAccountInput,
  MatchesQuery,
  MatchStatus,
  Paginated,
  PollRunsQuery,
  PollTrigger,
  UpdateSettingsInput,
} from '@igw/shared';
import type {
  Account,
  Keyword,
  Match,
  NewMatch,
  OcrStatus,
  PollRun,
  PollRunError,
  PollRunResult,
  ProcessedPostRecord,
  Settings,
  TelegramChat,
  TokenState,
} from '../../domain/models';

export abstract class SettingsRepository {
  abstract get(): Promise<Settings>;
  abstract update(patch: UpdateSettingsInput): Promise<Settings>;
  abstract suspendPolling(until: Date, reason: string): Promise<void>;
  abstract clearSuspension(): Promise<void>;
}

export abstract class TokenRepository {
  abstract get(): Promise<TokenState | null>;
  abstract initialize(accessToken: string, expiresAt: Date | null): Promise<void>;
  abstract saveRefreshed(accessToken: string, expiresAt: Date | null, at: Date): Promise<void>;
  abstract recordRefreshFailure(error: string, at: Date): Promise<void>;
  abstract setExpiry(expiresAt: Date | null): Promise<void>;
}

export abstract class KeywordRepository {
  abstract findActiveValues(): Promise<string[]>;
  abstract list(): Promise<Keyword[]>;
  abstract create(value: string): Promise<Keyword>;
  abstract setActive(id: string, active: boolean): Promise<Keyword | null>;
  abstract delete(id: string): Promise<boolean>;
}

export abstract class AccountRepository {
  /** Active and accessible accounts. */
  abstract findPollable(): Promise<Account[]>;
  abstract findById(id: string): Promise<Account | null>;
  abstract list(): Promise<Account[]>;
  abstract create(input: CreateAccountInput): Promise<Account>;
  abstract setActive(id: string, active: boolean): Promise<Account | null>;
  abstract delete(id: string): Promise<boolean>;
  abstract markPolled(id: string, at: Date): Promise<void>;
  abstract markAccessible(id: string, at: Date): Promise<void>;
  abstract markInaccessible(id: string, reason: string, at: Date): Promise<void>;
  abstract recordError(id: string, error: string, at: Date): Promise<void>;
  abstract countByState(): Promise<{ active: number; inaccessible: number }>;
}

export abstract class ProcessedPostRepository {
  abstract findExistingIds(postIds: string[]): Promise<Set<string>>;
  abstract save(record: ProcessedPostRecord): Promise<void>;
  abstract updateOcrStatus(postId: string, status: OcrStatus, matched: boolean): Promise<void>;
}

export abstract class MatchRepository {
  /** Returns null when a match for the same post already exists. */
  abstract create(match: NewMatch): Promise<Match | null>;
  abstract list(query: MatchesQuery): Promise<Paginated<Match>>;
  abstract updateStatus(id: string, status: MatchStatus): Promise<Match | null>;
  abstract countDetectedSince(since: Date): Promise<number>;
  abstract countByStatus(status: MatchStatus): Promise<number>;
}

export abstract class PollRunRepository {
  abstract start(trigger: PollTrigger, startedAt: Date): Promise<string>;
  abstract finish(id: string, result: PollRunResult): Promise<void>;
  abstract latest(): Promise<PollRun | null>;
  abstract list(query: PollRunsQuery): Promise<Paginated<PollRun>>;
  abstract recentErrors(limit: number): Promise<Array<PollRunError & { at: Date }>>;
  /** Runs left in "running" by a crashed worker. */
  abstract failStale(olderThan: Date, at: Date): Promise<number>;
}

export abstract class TelegramChatRepository {
  abstract list(): Promise<TelegramChat[]>;
  abstract findActive(): Promise<TelegramChat[]>;
  abstract findById(id: string): Promise<TelegramChat | null>;
  abstract create(chatId: string, label: string): Promise<TelegramChat>;
  abstract setActive(id: string, active: boolean): Promise<TelegramChat | null>;
  abstract delete(id: string): Promise<boolean>;
  abstract recordResult(id: string, error: string | null, at: Date): Promise<void>;
}
