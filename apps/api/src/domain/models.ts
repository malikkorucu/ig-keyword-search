import type { MatchSource, MatchStatus, PollRunStatus, PollTrigger } from '@igw/shared';

export interface Keyword {
  id: string;
  value: string;
  active: boolean;
  createdAt: Date;
}

export interface Account {
  id: string;
  username: string;
  active: boolean;
  accessible: boolean;
  inaccessibleReason: string | null;
  lastError: string | null;
  lastCheckedAt: Date | null;
  lastPolledAt: Date | null;
  createdAt: Date;
}

export interface Settings {
  pollIntervalMinutes: number;
  mediaLimit: number;
  ocrEnabled: boolean;
  tokenRefreshThresholdDays: number;
  rateLimitPauseMinutes: number;
  pollSuspendedUntil: Date | null;
  pollSuspendReason: string | null;
  updatedAt: Date;
}

export interface TokenState {
  accessToken: string;
  expiresAt: Date | null;
  lastRefreshedAt: Date | null;
  lastRefreshAttemptAt: Date | null;
  lastRefreshError: string | null;
}

export type IgMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | string;

export interface IgMediaChild {
  mediaType: IgMediaType;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
}

export interface IgMedia {
  id: string;
  caption: string | null;
  mediaType: IgMediaType;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string;
  timestamp: Date;
  children: IgMediaChild[];
}

export type OcrStatus = 'skipped' | 'pending' | 'done' | 'failed';

export interface ProcessedPostRecord {
  postId: string;
  accountId: string;
  postedAt: Date;
  matched: boolean;
  ocrStatus: OcrStatus;
}

export interface NewMatch {
  postId: string;
  accountId: string;
  username: string;
  keywords: string[];
  source: MatchSource;
  snippet: string;
  ocrText: string | null;
  permalink: string;
  postedAt: Date;
  detectedAt: Date;
}

export interface Match extends Omit<NewMatch, 'accountId'> {
  id: string;
  /** null once the account has been deleted. */
  accountId: string | null;
  status: MatchStatus;
}

export interface PollRunError {
  username?: string;
  postId?: string;
  code?: number;
  kind: string;
  message: string;
}

export interface PollRunResult {
  status: Exclude<PollRunStatus, 'running'>;
  finishedAt: Date;
  accountsScanned: number;
  postsScanned: number;
  newPosts: number;
  matchesFound: number;
  ocrJobsEnqueued: number;
  errors: PollRunError[];
  note: string | null;
}

export interface PollRun extends Omit<PollRunResult, 'status' | 'finishedAt'> {
  id: string;
  trigger: PollTrigger;
  status: PollRunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  errorCount: number;
}

/** Payload of an OCR job. Media URLs are short-lived CDN links: process right away, never store the images. */
export interface OcrJobPayload {
  postId: string;
  accountId: string;
  username: string;
  permalink: string;
  postedAt: string;
  caption: string | null;
  imageUrls: string[];
}

export interface TelegramChat {
  id: string;
  chatId: string;
  label: string;
  active: boolean;
  lastError: string | null;
  lastSentAt: Date | null;
  createdAt: Date;
}
