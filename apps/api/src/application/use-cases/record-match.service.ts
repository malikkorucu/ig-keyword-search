import type { MatchSource } from '@igw/shared';
import type { Match } from '../../domain/models';
import type { ClassifierPort, ClockPort, MatchRepository, NotifierPort } from '../ports';

export interface MatchCandidate {
  postId: string;
  accountId: string;
  username: string;
  keywords: string[];
  source: MatchSource;
  snippet: string;
  caption: string | null;
  ocrText: string | null;
  permalink: string;
  postedAt: Date;
}

/** classifier → persist → notify. Shared by the text (poll) and image (OCR) paths. */
export class RecordMatchService {
  constructor(
    private readonly classifier: ClassifierPort,
    private readonly matches: MatchRepository,
    private readonly notifier: NotifierPort,
    private readonly clock: ClockPort,
  ) {}

  /** Returns the stored match, or null when the classifier rejected it or it already existed. */
  async record(candidate: MatchCandidate): Promise<Match | null> {
    const verdict = await this.classifier.classify({
      postId: candidate.postId,
      username: candidate.username,
      keywords: candidate.keywords,
      source: candidate.source,
      caption: candidate.caption,
      ocrText: candidate.ocrText,
    });
    if (!verdict.relevant) return null;

    const match = await this.matches.create({
      postId: candidate.postId,
      accountId: candidate.accountId,
      username: candidate.username,
      keywords: candidate.keywords,
      source: candidate.source,
      snippet: candidate.snippet,
      ocrText: candidate.ocrText,
      permalink: candidate.permalink,
      postedAt: candidate.postedAt,
      detectedAt: this.clock.now(),
    });
    if (!match) return null;

    await this.notifier.notify({ type: 'match', match });
    return match;
  }
}
