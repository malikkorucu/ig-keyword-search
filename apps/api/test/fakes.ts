import type {
  CreateAccountInput,
  MatchesQuery,
  MatchStatus,
  Paginated,
  PollRunsQuery,
  PollTrigger,
  UpdateSettingsInput,
} from '@igw/shared';
import {
  AccountRepository,
  ClassifierPort,
  type ClassificationInput,
  type ClassificationResult,
  ClockPort,
  InstagramPort,
  JobQueuePort,
  KeywordRepository,
  MatchRepository,
  type NotifierEvent,
  NotifierPort,
  OcrPort,
  PollRunRepository,
  ProcessedPostRepository,
  type QueueStats,
  type RefreshedToken,
  SettingsRepository,
  TokenRepository,
} from '../src/application/ports';
import type {
  Account,
  IgMedia,
  Keyword,
  Match,
  NewMatch,
  OcrJobPayload,
  OcrStatus,
  PollRun,
  PollRunError,
  PollRunResult,
  ProcessedPostRecord,
  Settings,
  TokenState,
} from '../src/domain/models';

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

export class FakeClock extends ClockPort {
  constructor(public current = new Date('2026-10-15T12:00:00.000Z')) {
    super();
  }
  now(): Date {
    return new Date(this.current);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export const defaultSettings = (): Settings => ({
  pollIntervalMinutes: 15,
  mediaLimit: 5,
  ocrEnabled: true,
  tokenRefreshThresholdDays: 10,
  rateLimitPauseMinutes: 60,
  pollSuspendedUntil: null,
  pollSuspendReason: null,
  updatedAt: new Date('2026-10-01T00:00:00Z'),
});

export class InMemorySettings extends SettingsRepository {
  constructor(public value: Settings = defaultSettings()) {
    super();
  }
  async get() {
    return { ...this.value };
  }
  async update(patch: UpdateSettingsInput) {
    this.value = { ...this.value, ...patch };
    return this.get();
  }
  async suspendPolling(until: Date, reason: string) {
    this.value = { ...this.value, pollSuspendedUntil: until, pollSuspendReason: reason };
  }
  async clearSuspension() {
    this.value = { ...this.value, pollSuspendedUntil: null, pollSuspendReason: null };
  }
}

export class InMemoryTokens extends TokenRepository {
  constructor(public value: TokenState | null = null) {
    super();
  }
  async get() {
    return this.value ? { ...this.value } : null;
  }
  async initialize(accessToken: string, expiresAt: Date | null) {
    this.value ??= {
      accessToken,
      expiresAt,
      lastRefreshedAt: null,
      lastRefreshAttemptAt: null,
      lastRefreshError: null,
    };
  }
  async saveRefreshed(accessToken: string, expiresAt: Date | null, at: Date) {
    this.value = {
      accessToken,
      expiresAt,
      lastRefreshedAt: at,
      lastRefreshAttemptAt: at,
      lastRefreshError: null,
    };
  }
  async recordRefreshFailure(error: string, at: Date) {
    if (this.value)
      this.value = { ...this.value, lastRefreshAttemptAt: at, lastRefreshError: error };
  }
  async setExpiry(expiresAt: Date | null) {
    if (this.value) this.value = { ...this.value, expiresAt };
  }
}

export class InMemoryKeywords extends KeywordRepository {
  items: Keyword[] = [];
  constructor(values: Array<string | [string, boolean]> = []) {
    super();
    for (const v of values) {
      const [value, active] = Array.isArray(v) ? v : [v, true];
      this.items.push({ id: nextId('kw'), value, active, createdAt: new Date() });
    }
  }
  async findActiveValues() {
    return this.items.filter((k) => k.active).map((k) => k.value);
  }
  async list() {
    return [...this.items];
  }
  async create(value: string) {
    const k = { id: nextId('kw'), value, active: true, createdAt: new Date() };
    this.items.push(k);
    return k;
  }
  async setActive(id: string, active: boolean) {
    const k = this.items.find((i) => i.id === id);
    if (!k) return null;
    k.active = active;
    return k;
  }
  async delete(id: string) {
    const before = this.items.length;
    this.items = this.items.filter((i) => i.id !== id);
    return this.items.length < before;
  }
}

export function makeAccount(username: string, overrides: Partial<Account> = {}): Account {
  return {
    id: nextId('acc'),
    username,
    active: true,
    accessible: true,
    inaccessibleReason: null,
    lastError: null,
    lastCheckedAt: null,
    lastPolledAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export class InMemoryAccounts extends AccountRepository {
  constructor(public items: Account[] = []) {
    super();
  }
  byName(username: string): Account {
    const a = this.items.find((i) => i.username === username);
    if (!a) throw new Error(`no account ${username}`);
    return a;
  }
  async findPollable() {
    return this.items.filter((a) => a.active && a.accessible).map((a) => ({ ...a }));
  }
  async findById(id: string) {
    const a = this.items.find((i) => i.id === id);
    return a ? { ...a } : null;
  }
  async list() {
    return [...this.items];
  }
  async create(input: CreateAccountInput) {
    const a = makeAccount(input.username);
    this.items.push(a);
    return a;
  }
  async setActive(id: string, active: boolean) {
    const a = this.items.find((i) => i.id === id);
    if (!a) return null;
    a.active = active;
    return { ...a };
  }
  async delete(id: string) {
    const before = this.items.length;
    this.items = this.items.filter((i) => i.id !== id);
    return this.items.length < before;
  }
  private patch(id: string, p: Partial<Account>) {
    const a = this.items.find((i) => i.id === id);
    if (a) Object.assign(a, p);
  }
  async markPolled(id: string, at: Date) {
    this.patch(id, { lastPolledAt: at, lastError: null });
  }
  async markAccessible(id: string, at: Date) {
    this.patch(id, {
      accessible: true,
      inaccessibleReason: null,
      lastError: null,
      lastCheckedAt: at,
    });
  }
  async markInaccessible(id: string, reason: string, at: Date) {
    this.patch(id, {
      accessible: false,
      inaccessibleReason: reason,
      lastError: reason,
      lastCheckedAt: at,
    });
  }
  async recordError(id: string, error: string, at: Date) {
    this.patch(id, { lastError: error, lastCheckedAt: at });
  }
  async countByState() {
    return {
      active: this.items.filter((a) => a.active && a.accessible).length,
      inaccessible: this.items.filter((a) => !a.accessible).length,
    };
  }
}

export class InMemoryProcessedPosts extends ProcessedPostRepository {
  records = new Map<string, ProcessedPostRecord>();
  async findExistingIds(postIds: string[]) {
    return new Set(postIds.filter((id) => this.records.has(id)));
  }
  async save(record: ProcessedPostRecord) {
    if (!this.records.has(record.postId)) this.records.set(record.postId, { ...record });
  }
  async updateOcrStatus(postId: string, status: OcrStatus, matched: boolean) {
    const r = this.records.get(postId);
    if (r) this.records.set(postId, { ...r, ocrStatus: status, matched });
  }
}

export class InMemoryMatches extends MatchRepository {
  items: Match[] = [];
  async create(match: NewMatch) {
    if (this.items.some((m) => m.postId === match.postId)) return null;
    const m: Match = { ...match, id: nextId('match'), status: 'new' };
    this.items.push(m);
    return m;
  }
  async list(query: MatchesQuery): Promise<Paginated<Match>> {
    return {
      items: this.items,
      total: this.items.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async updateStatus(id: string, status: MatchStatus) {
    const m = this.items.find((i) => i.id === id);
    if (!m) return null;
    m.status = status;
    return m;
  }
  async countDetectedSince(since: Date) {
    return this.items.filter((m) => m.detectedAt >= since).length;
  }
  async countByStatus(status: MatchStatus) {
    return this.items.filter((m) => m.status === status).length;
  }
}

export class InMemoryPollRuns extends PollRunRepository {
  runs: PollRun[] = [];
  async start(trigger: PollTrigger, startedAt: Date) {
    const run: PollRun = {
      id: nextId('run'),
      trigger,
      status: 'running',
      startedAt,
      finishedAt: null,
      accountsScanned: 0,
      postsScanned: 0,
      newPosts: 0,
      matchesFound: 0,
      ocrJobsEnqueued: 0,
      errorCount: 0,
      errors: [],
      note: null,
    };
    this.runs.push(run);
    return run.id;
  }
  async finish(id: string, result: PollRunResult) {
    const run = this.runs.find((r) => r.id === id)!;
    Object.assign(run, result, { errorCount: result.errors.length });
  }
  async latest() {
    return this.runs.at(-1) ?? null;
  }
  async list(query: PollRunsQuery): Promise<Paginated<PollRun>> {
    return {
      items: this.runs,
      total: this.runs.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async recentErrors(limit: number): Promise<Array<PollRunError & { at: Date }>> {
    return this.runs
      .flatMap((r) => r.errors.map((e) => ({ ...e, at: r.startedAt })))
      .slice(0, limit);
  }
  async failStale() {
    return 0;
  }
}

/** Instagram fake: per-username media lists or errors. */
export class FakeInstagram extends InstagramPort {
  media = new Map<string, IgMedia[]>();
  errors = new Map<string, Error>();
  calls: Array<{ username: string; limit: number; token: string }> = [];
  refreshResult: RefreshedToken | Error = { accessToken: 'new-token', expiresAt: null };
  tokenExpiry: Date | null = null;

  async fetchRecentMedia(username: string, limit: number, accessToken: string) {
    this.calls.push({ username, limit, token: accessToken });
    const error = this.errors.get(username);
    if (error) throw error;
    return (this.media.get(username) ?? []).slice(0, limit);
  }
  async refreshLongLivedToken() {
    if (this.refreshResult instanceof Error) throw this.refreshResult;
    return this.refreshResult;
  }
  async inspectTokenExpiry() {
    return this.tokenExpiry;
  }
}

export class FakeQueue extends JobQueuePort {
  ocrJobs: OcrJobPayload[] = [];
  polls: PollTrigger[] = [];
  failOcrFor = new Set<string>();
  async enqueuePoll(trigger: PollTrigger) {
    this.polls.push(trigger);
    return true;
  }
  async enqueueOcr(payload: OcrJobPayload) {
    if (this.failOcrFor.has(payload.postId)) throw new Error('redis down');
    this.ocrJobs.push(payload);
  }
  async stats(): Promise<QueueStats[]> {
    return [];
  }
}

export class RecordingNotifier extends NotifierPort {
  events: NotifierEvent[] = [];
  async notify(event: NotifierEvent) {
    this.events.push(event);
  }
}

export class FakeClassifier extends ClassifierPort {
  inputs: ClassificationInput[] = [];
  constructor(private readonly verdict: ClassificationResult = { relevant: true }) {
    super();
  }
  async classify(input: ClassificationInput) {
    this.inputs.push(input);
    return this.verdict;
  }
}

/** OCR fake: url → text, or url → Error. */
export class FakeOcr extends OcrPort {
  results = new Map<string, string | Error>();
  calls: string[] = [];
  async recognizeFromUrl(imageUrl: string) {
    this.calls.push(imageUrl);
    const r = this.results.get(imageUrl) ?? '';
    if (r instanceof Error) throw r;
    return r;
  }
}

export function makeMedia(id: string, overrides: Partial<IgMedia> = {}): IgMedia {
  return {
    id,
    caption: null,
    mediaType: 'IMAGE',
    mediaUrl: `https://cdn.example/${id}.jpg`,
    thumbnailUrl: null,
    permalink: `https://www.instagram.com/p/${id}/`,
    timestamp: new Date('2026-10-15T10:00:00Z'),
    children: [],
    ...overrides,
  };
}
