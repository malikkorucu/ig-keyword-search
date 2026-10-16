import type {
  AccountDto,
  KeywordDto,
  MatchDto,
  PollRunDto,
  SettingsDto,
  TelegramChatDto,
} from '@igw/shared';
import type { Account, Keyword, Match, PollRun, Settings, TelegramChat } from '../../domain/models';

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export const presentKeyword = (k: Keyword): KeywordDto => ({
  ...k,
  createdAt: k.createdAt.toISOString(),
});

export const presentAccount = (a: Account): AccountDto => ({
  ...a,
  lastCheckedAt: iso(a.lastCheckedAt),
  lastPolledAt: iso(a.lastPolledAt),
  createdAt: a.createdAt.toISOString(),
});

export const presentMatch = (m: Match): MatchDto => ({
  ...m,
  postedAt: m.postedAt.toISOString(),
  detectedAt: m.detectedAt.toISOString(),
});

export const presentPollRun = (r: PollRun): PollRunDto => ({
  ...r,
  startedAt: r.startedAt.toISOString(),
  finishedAt: iso(r.finishedAt),
});

export const presentSettings = (s: Settings): SettingsDto => ({
  ...s,
  pollSuspendedUntil: iso(s.pollSuspendedUntil),
  updatedAt: s.updatedAt.toISOString(),
});

export const presentTelegramChat = (c: TelegramChat): TelegramChatDto => ({
  ...c,
  lastSentAt: iso(c.lastSentAt),
  createdAt: c.createdAt.toISOString(),
});
