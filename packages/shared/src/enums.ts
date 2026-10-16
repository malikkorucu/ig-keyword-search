export const MATCH_SOURCES = ['text', 'image'] as const;
export type MatchSource = (typeof MATCH_SOURCES)[number];

export const MATCH_STATUSES = ['new', 'seen', 'dismissed'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const POLL_RUN_STATUSES = ['running', 'success', 'partial', 'failed', 'skipped'] as const;
export type PollRunStatus = (typeof POLL_RUN_STATUSES)[number];

export const POLL_TRIGGERS = ['cron', 'manual'] as const;
export type PollTrigger = (typeof POLL_TRIGGERS)[number];
