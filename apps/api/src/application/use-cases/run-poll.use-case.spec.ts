import {
  FakeClassifier,
  FakeClock,
  FakeInstagram,
  FakeQueue,
  InMemoryAccounts,
  InMemoryKeywords,
  InMemoryMatches,
  InMemoryPollRuns,
  InMemoryProcessedPosts,
  InMemorySettings,
  InMemoryTokens,
  makeAccount,
  makeMedia,
  RecordingNotifier,
} from '../../../test/fakes';
import { InstagramApiError } from '../../domain/instagram-error';
import { RecordMatchService } from './record-match.service';
import { RunPollUseCase } from './run-poll.use-case';

function setup(
  opts: { keywords?: string[]; accounts?: string[]; classifierRelevant?: boolean } = {},
) {
  const clock = new FakeClock();
  const settings = new InMemorySettings();
  const tokens = new InMemoryTokens({
    accessToken: 'tok',
    expiresAt: new Date('2026-12-01T00:00:00Z'),
    lastRefreshedAt: null,
    lastRefreshAttemptAt: null,
    lastRefreshError: null,
  });
  const keywords = new InMemoryKeywords(opts.keywords ?? ['alanya']);
  const accounts = new InMemoryAccounts((opts.accounts ?? ['acc_one']).map((u) => makeAccount(u)));
  const processedPosts = new InMemoryProcessedPosts();
  const pollRuns = new InMemoryPollRuns();
  const instagram = new FakeInstagram();
  const queue = new FakeQueue();
  const notifier = new RecordingNotifier();
  const matches = new InMemoryMatches();
  const classifier = new FakeClassifier({ relevant: opts.classifierRelevant ?? true });
  const recordMatch = new RecordMatchService(classifier, matches, notifier, clock);
  const useCase = new RunPollUseCase({
    settings,
    tokens,
    keywords,
    accounts,
    processedPosts,
    pollRuns,
    instagram,
    queue,
    notifier,
    recordMatch,
    clock,
  });
  return {
    clock,
    settings,
    tokens,
    keywords,
    accounts,
    processedPosts,
    pollRuns,
    instagram,
    queue,
    notifier,
    matches,
    classifier,
    useCase,
  };
}

describe('RunPollUseCase', () => {
  it('records a text match, notifies, marks the post processed and logs the run', async () => {
    const t = setup();
    t.instagram.media.set('acc_one', [
      makeMedia('p1', { caption: "Bugün Alanya'da deniz harika #alanya" }),
    ]);

    const result = await t.useCase.execute('cron');

    expect(result.status).toBe('success');
    expect(t.matches.items).toHaveLength(1);
    expect(t.matches.items[0]).toMatchObject({
      postId: 'p1',
      source: 'text',
      keywords: ['alanya'],
      username: 'acc_one',
    });
    expect(t.notifier.events.map((e) => e.type)).toEqual(['match']);
    expect(t.processedPosts.records.get('p1')).toMatchObject({
      matched: true,
      ocrStatus: 'skipped',
    });
    expect(t.queue.ocrJobs).toHaveLength(0);
    expect(t.pollRuns.runs[0]).toMatchObject({
      status: 'success',
      accountsScanned: 1,
      postsScanned: 1,
      newPosts: 1,
      matchesFound: 1,
      errorCount: 0,
    });
    expect(t.instagram.calls[0]).toEqual({ username: 'acc_one', limit: 5, token: 'tok' });
  });

  it('uses the media limit from settings (no restart needed)', async () => {
    const t = setup();
    await t.settings.update({ mediaLimit: 12 });
    await t.useCase.execute('cron');
    expect(t.instagram.calls[0]?.limit).toBe(12);
  });

  it('skips posts already in processed_posts (dedupe)', async () => {
    const t = setup();
    t.instagram.media.set('acc_one', [
      makeMedia('p1', { caption: 'alanya' }),
      makeMedia('p2', { caption: 'alanya' }),
    ]);
    await t.processedPosts.save({
      postId: 'p1',
      accountId: 'x',
      postedAt: new Date(),
      matched: true,
      ocrStatus: 'skipped',
    });

    const result = await t.useCase.execute('cron');

    expect(result.newPosts).toBe(1);
    expect(t.matches.items.map((m) => m.postId)).toEqual(['p2']);

    // Second poll sees nothing new.
    const again = await t.useCase.execute('cron');
    expect(again.newPosts).toBe(0);
    expect(t.matches.items).toHaveLength(1);
  });

  it('records all matching keywords when several are active', async () => {
    const t = setup({ keywords: ['alanya', 'side', 'kemer'] });
    t.instagram.media.set('acc_one', [makeMedia('p1', { caption: 'SİDE ve ALANYA turu' })]);
    await t.useCase.execute('cron');
    expect(t.matches.items[0]?.keywords).toEqual(['alanya', 'side']);
  });

  it('ignores inactive keywords', async () => {
    const t = setup({ keywords: [] });
    t.keywords.items.push({ id: 'k', value: 'alanya', active: false, createdAt: new Date() });
    t.instagram.media.set('acc_one', [makeMedia('p1', { caption: 'alanya' })]);
    const result = await t.useCase.execute('cron');
    expect(t.matches.items).toHaveLength(0);
    expect(result.note).toBe('Aktif anahtar kelime yok');
  });

  it('enqueues an OCR job when the caption does not match and OCR is on', async () => {
    const t = setup();
    t.instagram.media.set('acc_one', [
      makeMedia('p1', {
        caption: 'Yaz tatili',
        mediaType: 'CAROUSEL_ALBUM',
        children: [
          { mediaType: 'IMAGE', mediaUrl: 'https://cdn/c1.jpg', thumbnailUrl: null },
          {
            mediaType: 'VIDEO',
            mediaUrl: 'https://cdn/c2.mp4',
            thumbnailUrl: 'https://cdn/c2.jpg',
          },
        ],
      }),
    ]);

    const result = await t.useCase.execute('cron');

    expect(result.ocrJobsEnqueued).toBe(1);
    expect(t.queue.ocrJobs[0]).toMatchObject({
      postId: 'p1',
      imageUrls: ['https://cdn/c1.jpg', 'https://cdn/c2.jpg'],
    });
    expect(t.processedPosts.records.get('p1')).toMatchObject({
      matched: false,
      ocrStatus: 'pending',
    });
    expect(t.matches.items).toHaveLength(0);
  });

  it('does not enqueue OCR when OCR is disabled in settings', async () => {
    const t = setup();
    await t.settings.update({ ocrEnabled: false });
    t.instagram.media.set('acc_one', [makeMedia('p1', { caption: 'nothing here' })]);
    await t.useCase.execute('cron');
    expect(t.queue.ocrJobs).toHaveLength(0);
    expect(t.processedPosts.records.get('p1')).toMatchObject({ ocrStatus: 'skipped' });
  });

  it('suspends polling for the configured time on a (#4) rate limit and stops the run', async () => {
    const t = setup({ accounts: ['a1', 'a2', 'a3'] });
    t.instagram.media.set('a1', [makeMedia('p1', { caption: 'alanya' })]);
    t.instagram.errors.set(
      'a2',
      new InstagramApiError('rate_limit', '(#4) Application request limit reached', 4),
    );

    const result = await t.useCase.execute('cron');

    expect(result.status).toBe('partial');
    expect(t.instagram.calls.map((c) => c.username)).toEqual(['a1', 'a2']); // a3 never called
    const suspendedUntil = (await t.settings.get()).pollSuspendedUntil;
    expect(suspendedUntil?.toISOString()).toBe('2026-10-15T13:00:00.000Z');
    expect(t.notifier.events.map((e) => e.type)).toContain('poll_suspended');
    expect(result.note).toMatch(/Rate limit/);
    expect(result.errors[0]).toMatchObject({ username: 'a2', kind: 'rate_limit', code: 4 });
  });

  it('skips polls while suspended and resumes after the pause', async () => {
    const t = setup();
    await t.settings.suspendPolling(new Date('2026-10-15T13:00:00Z'), 'rate limit');
    t.instagram.media.set('acc_one', [makeMedia('p1', { caption: 'alanya' })]);

    const skipped = await t.useCase.execute('cron');
    expect(skipped.status).toBe('skipped');
    expect(t.instagram.calls).toHaveLength(0);

    t.clock.advance(61 * 60_000);
    const resumed = await t.useCase.execute('cron');
    expect(resumed.status).toBe('success');
    expect(t.matches.items).toHaveLength(1);
  });

  it('honours a custom rate-limit pause from settings', async () => {
    const t = setup();
    await t.settings.update({ rateLimitPauseMinutes: 30 });
    t.instagram.errors.set('acc_one', new InstagramApiError('rate_limit', '(#4) limit', 4));
    await t.useCase.execute('cron');
    expect((await t.settings.get()).pollSuspendedUntil?.toISOString()).toBe(
      '2026-10-15T12:30:00.000Z',
    );
  });

  it('marks non-business / private accounts (#100) inaccessible and keeps polling others', async () => {
    const t = setup({ accounts: ['private_one', 'ok_one'] });
    t.instagram.errors.set(
      'private_one',
      new InstagramApiError('account_inaccessible', '(#100) not a business account', 100),
    );
    t.instagram.media.set('ok_one', [makeMedia('p9', { caption: 'alanya' })]);

    const result = await t.useCase.execute('cron');

    expect(result.status).toBe('partial');
    expect(t.accounts.byName('private_one')).toMatchObject({
      accessible: false,
      inaccessibleReason: '(#100) not a business account',
    });
    expect(t.matches.items.map((m) => m.postId)).toEqual(['p9']);

    // Next poll skips the inaccessible account entirely.
    t.instagram.calls = [];
    await t.useCase.execute('cron');
    expect(t.instagram.calls.map((c) => c.username)).toEqual(['ok_one']);
  });

  it('isolates generic account errors', async () => {
    const t = setup({ accounts: ['broken', 'fine'] });
    t.instagram.errors.set('broken', new InstagramApiError('network', 'ECONNRESET'));
    t.instagram.media.set('fine', [makeMedia('p1', { caption: 'alanya' })]);

    const result = await t.useCase.execute('cron');

    expect(result.accountsScanned).toBe(1);
    expect(t.accounts.byName('broken')).toMatchObject({
      accessible: true,
      lastError: 'ECONNRESET',
    });
    expect(t.matches.items).toHaveLength(1);
  });

  it('isolates a failing post and retries it on the next poll', async () => {
    const t = setup();
    t.instagram.media.set('acc_one', [
      makeMedia('bad', { caption: 'no match' }),
      makeMedia('good', { caption: 'alanya' }),
    ]);
    t.queue.failOcrFor.add('bad');

    const result = await t.useCase.execute('cron');

    expect(result.status).toBe('partial');
    expect(result.errors[0]).toMatchObject({ postId: 'bad', message: 'redis down' });
    expect(t.processedPosts.records.has('bad')).toBe(false);
    expect(t.processedPosts.records.has('good')).toBe(true);

    t.queue.failOcrFor.clear();
    await t.useCase.execute('cron');
    expect(t.queue.ocrJobs.map((j) => j.postId)).toEqual(['bad']);
  });

  it('marks the post processed but stores no match when the classifier rejects it', async () => {
    const t = setup({ classifierRelevant: false });
    t.instagram.media.set('acc_one', [makeMedia('p1', { caption: 'alanya' })]);
    await t.useCase.execute('cron');
    expect(t.classifier.inputs).toHaveLength(1);
    expect(t.matches.items).toHaveLength(0);
    expect(t.notifier.events).toHaveLength(0);
    expect(t.processedPosts.records.get('p1')).toMatchObject({ matched: false });
  });

  it('fails the run when no token exists', async () => {
    const t = setup();
    t.tokens.value = null;
    const result = await t.useCase.execute('manual');
    expect(result.status).toBe('failed');
    expect(t.pollRuns.runs[0]).toMatchObject({
      trigger: 'manual',
      status: 'failed',
      errorCount: 1,
    });
  });
});
