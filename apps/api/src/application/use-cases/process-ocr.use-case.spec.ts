import {
  FakeClassifier,
  FakeClock,
  FakeOcr,
  InMemoryKeywords,
  InMemoryMatches,
  InMemoryProcessedPosts,
  RecordingNotifier,
} from '../../../test/fakes';
import type { OcrJobPayload } from '../../domain/models';
import { OcrFailedError, ProcessOcrUseCase } from './process-ocr.use-case';
import { RecordMatchService } from './record-match.service';

function setup(keywords: string[] = ['alanya']) {
  const ocr = new FakeOcr();
  const kw = new InMemoryKeywords(keywords);
  const processed = new InMemoryProcessedPosts();
  const matches = new InMemoryMatches();
  const notifier = new RecordingNotifier();
  const recordMatch = new RecordMatchService(
    new FakeClassifier(),
    matches,
    notifier,
    new FakeClock(),
  );
  return {
    ocr,
    kw,
    processed,
    matches,
    notifier,
    useCase: new ProcessOcrUseCase(ocr, kw, processed, recordMatch),
  };
}

const job = (imageUrls: string[]): OcrJobPayload => ({
  postId: 'p1',
  accountId: 'acc-1',
  username: 'hotel',
  permalink: 'https://www.instagram.com/p/p1/',
  postedAt: '2026-10-15T09:00:00.000Z',
  caption: 'Yeni sezon',
  imageUrls,
});

describe('ProcessOcrUseCase', () => {
  it('OCRs every carousel child and matches text found in a later child', async () => {
    const t = setup();
    await t.processed.save({
      postId: 'p1',
      accountId: 'acc-1',
      postedAt: new Date(),
      matched: false,
      ocrStatus: 'pending',
    });
    t.ocr.results.set('https://cdn/1.jpg', 'Erken rezervasyon');
    t.ocr.results.set('https://cdn/2.jpg', '%20 İNDİRİM');
    t.ocr.results.set('https://cdn/3.jpg', "ALANYA'DA 3 GECE");

    const result = await t.useCase.execute(
      job(['https://cdn/1.jpg', 'https://cdn/2.jpg', 'https://cdn/3.jpg']),
    );

    expect(t.ocr.calls).toEqual(['https://cdn/1.jpg', 'https://cdn/2.jpg', 'https://cdn/3.jpg']);
    expect(result.matched).toBe(true);
    expect(t.matches.items[0]).toMatchObject({
      source: 'image',
      keywords: ['alanya'],
      postId: 'p1',
    });
    expect(t.matches.items[0]?.ocrText).toContain('[3] ALANYA');
    expect(t.matches.items[0]?.ocrText).toContain('[1] Erken rezervasyon');
    expect(t.matches.items[0]?.snippet).toContain("ALANYA'DA");
    expect(t.notifier.events).toHaveLength(1);
    expect(t.processed.records.get('p1')).toMatchObject({ ocrStatus: 'done', matched: true });
  });

  it('marks the post done without a match when no keyword is in the image', async () => {
    const t = setup();
    await t.processed.save({
      postId: 'p1',
      accountId: 'acc-1',
      postedAt: new Date(),
      matched: false,
      ocrStatus: 'pending',
    });
    t.ocr.results.set('https://cdn/1.jpg', 'Antalya Kaleiçi');
    const result = await t.useCase.execute(job(['https://cdn/1.jpg']));
    expect(result.matched).toBe(false);
    expect(t.matches.items).toHaveLength(0);
    expect(t.processed.records.get('p1')).toMatchObject({ ocrStatus: 'done', matched: false });
  });

  it('tolerates a partially failing carousel', async () => {
    const t = setup();
    t.ocr.results.set('https://cdn/1.jpg', new Error('HTTP 403'));
    t.ocr.results.set('https://cdn/2.jpg', 'alanya');
    const result = await t.useCase.execute(job(['https://cdn/1.jpg', 'https://cdn/2.jpg']));
    expect(result).toMatchObject({ matched: true, failedImages: 1 });
  });

  it('throws when every image fails so the queue retries with backoff', async () => {
    const t = setup();
    t.ocr.results.set('https://cdn/1.jpg', new Error('HTTP 403'));
    await expect(t.useCase.execute(job(['https://cdn/1.jpg']))).rejects.toBeInstanceOf(
      OcrFailedError,
    );
    expect(t.matches.items).toHaveLength(0);
  });

  it('marks the post failed once retries are exhausted', async () => {
    const t = setup();
    await t.processed.save({
      postId: 'p1',
      accountId: 'acc-1',
      postedAt: new Date(),
      matched: false,
      ocrStatus: 'pending',
    });
    await t.useCase.markFailed('p1');
    expect(t.processed.records.get('p1')?.ocrStatus).toBe('failed');
  });

  it('does not create a duplicate match when the job is retried', async () => {
    const t = setup();
    t.ocr.results.set('https://cdn/1.jpg', 'alanya');
    await t.useCase.execute(job(['https://cdn/1.jpg']));
    await t.useCase.execute(job(['https://cdn/1.jpg']));
    expect(t.matches.items).toHaveLength(1);
    expect(t.notifier.events).toHaveLength(1);
  });
});
