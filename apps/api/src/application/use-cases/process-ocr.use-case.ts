import { matchKeywords } from '../../domain/keyword-matcher';
import type { OcrJobPayload } from '../../domain/models';
import type { KeywordRepository, OcrPort, ProcessedPostRepository } from '../ports';
import type { RecordMatchService } from './record-match.service';

export interface OcrOutcome {
  matched: boolean;
  keywords: string[];
  ocrText: string;
  failedImages: number;
}

export class OcrFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OcrFailedError';
  }
}

export class ProcessOcrUseCase {
  constructor(
    private readonly ocr: OcrPort,
    private readonly keywords: KeywordRepository,
    private readonly processedPosts: ProcessedPostRepository,
    private readonly recordMatch: RecordMatchService,
  ) {}

  /**
   * OCRs every image of the post and applies the same keyword check as captions.
   * Throws when every image failed so the queue retries the job (with backoff).
   */
  async execute(job: OcrJobPayload): Promise<OcrOutcome> {
    const texts: string[] = [];
    const errors: string[] = [];
    for (const [i, url] of job.imageUrls.entries()) {
      try {
        const text = (await this.ocr.recognizeFromUrl(url)).trim();
        if (text) texts.push(job.imageUrls.length > 1 ? `[${i + 1}] ${text}` : text);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (errors.length > 0 && errors.length === job.imageUrls.length) {
      throw new OcrFailedError(`OCR failed for all ${errors.length} image(s): ${errors[0]}`);
    }

    const ocrText = texts.join('\n\n');
    const keywords = await this.keywords.findActiveValues();
    const result = matchKeywords(ocrText, keywords);

    let matched = false;
    if (result) {
      const match = await this.recordMatch.record({
        postId: job.postId,
        accountId: job.accountId,
        username: job.username,
        keywords: result.keywords,
        source: 'image',
        snippet: result.snippet,
        caption: job.caption,
        ocrText,
        permalink: job.permalink,
        postedAt: new Date(job.postedAt),
      });
      matched = match !== null;
    }
    await this.processedPosts.updateOcrStatus(job.postId, 'done', matched);
    return { matched, keywords: result?.keywords ?? [], ocrText, failedImages: errors.length };
  }

  /** Called by the queue adapter once retries are exhausted. */
  async markFailed(postId: string): Promise<void> {
    await this.processedPosts.updateOcrStatus(postId, 'failed', false);
  }
}
