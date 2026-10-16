import type { PollTrigger } from '@igw/shared';
import { describeError, InstagramApiError } from '../../domain/instagram-error';
import { matchKeywords } from '../../domain/keyword-matcher';
import { extractImageUrls } from '../../domain/media';
import type { Account, IgMedia, PollRunError, PollRunResult, Settings } from '../../domain/models';
import type {
  AccountRepository,
  ClockPort,
  InstagramPort,
  JobQueuePort,
  KeywordRepository,
  NotifierPort,
  PollRunRepository,
  ProcessedPostRepository,
  SettingsRepository,
  TokenRepository,
} from '../ports';
import type { RecordMatchService } from './record-match.service';

export interface RunPollDeps {
  settings: SettingsRepository;
  tokens: TokenRepository;
  keywords: KeywordRepository;
  accounts: AccountRepository;
  processedPosts: ProcessedPostRepository;
  pollRuns: PollRunRepository;
  instagram: InstagramPort;
  queue: JobQueuePort;
  notifier: NotifierPort;
  recordMatch: RecordMatchService;
  clock: ClockPort;
}

interface Counters {
  accountsScanned: number;
  postsScanned: number;
  newPosts: number;
  matchesFound: number;
  ocrJobsEnqueued: number;
  errors: PollRunError[];
}

export class RunPollUseCase {
  constructor(private readonly d: RunPollDeps) {}

  async execute(trigger: PollTrigger): Promise<PollRunResult & { runId: string }> {
    const startedAt = this.d.clock.now();
    const runId = await this.d.pollRuns.start(trigger, startedAt);
    const result = await this.run(startedAt).catch((error: unknown) =>
      this.finalize({ ...emptyCounters(), errors: [describeError(error)] }, 'unexpected failure'),
    );
    await this.d.pollRuns.finish(runId, result);
    return { ...result, runId };
  }

  private async run(startedAt: Date): Promise<PollRunResult> {
    const settings = await this.d.settings.get();

    if (settings.pollSuspendedUntil && settings.pollSuspendedUntil > startedAt) {
      return {
        ...this.finalize(emptyCounters(), null),
        status: 'skipped',
        note: `Poll askıda (${settings.pollSuspendReason ?? 'rate limit'}) — ${settings.pollSuspendedUntil.toISOString()} sonrasına kadar`,
      };
    }

    const token = await this.d.tokens.get();
    if (!token) {
      return {
        ...this.finalize(
          { ...emptyCounters(), errors: [{ kind: 'auth', message: 'Access token yok' }] },
          null,
        ),
        status: 'failed',
      };
    }

    const [keywords, accounts] = await Promise.all([
      this.d.keywords.findActiveValues(),
      this.d.accounts.findPollable(),
    ]);
    const c = emptyCounters();
    let note: string | null = keywords.length === 0 ? 'Aktif anahtar kelime yok' : null;

    for (const account of accounts) {
      let media: IgMedia[];
      try {
        media = await this.d.instagram.fetchRecentMedia(
          account.username,
          settings.mediaLimit,
          token.accessToken,
        );
        await this.d.accounts.markPolled(account.id, this.d.clock.now());
      } catch (error) {
        const stop = await this.handleAccountError(account, error, settings, c);
        if (stop) {
          note = stop;
          break;
        }
        continue;
      }

      c.accountsScanned++;
      c.postsScanned += media.length;
      const existing = await this.d.processedPosts.findExistingIds(media.map((m) => m.id));

      for (const post of media) {
        if (existing.has(post.id)) continue;
        try {
          await this.processPost(account, post, keywords, settings, c);
          c.newPosts++;
        } catch (error) {
          // Not marked as processed → retried on the next poll.
          c.errors.push({ username: account.username, postId: post.id, ...describeError(error) });
        }
      }
    }

    return this.finalize(c, note);
  }

  private async processPost(
    account: Account,
    post: IgMedia,
    keywords: string[],
    settings: Settings,
    c: Counters,
  ): Promise<void> {
    const textMatch = matchKeywords(post.caption, keywords);
    if (textMatch) {
      const match = await this.d.recordMatch.record({
        postId: post.id,
        accountId: account.id,
        username: account.username,
        keywords: textMatch.keywords,
        source: 'text',
        snippet: textMatch.snippet,
        caption: post.caption,
        ocrText: null,
        permalink: post.permalink,
        postedAt: post.timestamp,
      });
      if (match) c.matchesFound++;
      await this.saveProcessed(account, post, match !== null, 'skipped');
      return;
    }

    const imageUrls = settings.ocrEnabled && keywords.length > 0 ? extractImageUrls(post) : [];
    if (imageUrls.length > 0) {
      await this.d.queue.enqueueOcr({
        postId: post.id,
        accountId: account.id,
        username: account.username,
        permalink: post.permalink,
        postedAt: post.timestamp.toISOString(),
        caption: post.caption,
        imageUrls,
      });
      c.ocrJobsEnqueued++;
      await this.saveProcessed(account, post, false, 'pending');
      return;
    }

    await this.saveProcessed(account, post, false, 'skipped');
  }

  private saveProcessed(
    account: Account,
    post: IgMedia,
    matched: boolean,
    ocrStatus: 'skipped' | 'pending',
  ) {
    return this.d.processedPosts.save({
      postId: post.id,
      accountId: account.id,
      postedAt: post.timestamp,
      matched,
      ocrStatus,
    });
  }

  /** Returns a note when the whole poll must stop, otherwise null. */
  private async handleAccountError(
    account: Account,
    error: unknown,
    settings: Settings,
    c: Counters,
  ): Promise<string | null> {
    const now = this.d.clock.now();
    const info = describeError(error);
    c.errors.push({ username: account.username, ...info });

    if (error instanceof InstagramApiError) {
      if (error.kind === 'rate_limit') {
        const until = new Date(now.getTime() + settings.rateLimitPauseMinutes * 60_000);
        const reason = `Graph rate limit (#${error.code ?? '?'}): ${error.message}`;
        await this.d.settings.suspendPolling(until, reason);
        await this.d.notifier.notify({ type: 'poll_suspended', until, reason });
        return `Rate limit — poll ${until.toISOString()} tarihine kadar askıya alındı`;
      }
      if (error.kind === 'account_inaccessible') {
        await this.d.accounts.markInaccessible(account.id, error.message, now);
        return null;
      }
    }
    await this.d.accounts.recordError(account.id, info.message, now);
    return null;
  }

  private finalize(c: Counters, note: string | null): PollRunResult {
    const status =
      c.errors.length === 0
        ? 'success'
        : c.accountsScanned === 0 && c.errors.length > 0
          ? 'failed'
          : 'partial';
    return { ...c, status, note, finishedAt: this.d.clock.now() };
  }
}

function emptyCounters(): Counters {
  return {
    accountsScanned: 0,
    postsScanned: 0,
    newPosts: 0,
    matchesFound: 0,
    ocrJobsEnqueued: 0,
    errors: [],
  };
}
