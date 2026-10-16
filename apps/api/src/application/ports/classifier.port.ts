import type { MatchSource } from '@igw/shared';

export interface ClassificationInput {
  postId: string;
  username: string;
  keywords: string[];
  source: MatchSource;
  caption: string | null;
  ocrText: string | null;
}

export interface ClassificationResult {
  relevant: boolean;
  reason?: string;
}

/** Second-stage filter after keyword matching (pass-through today, LLM later). */
export abstract class ClassifierPort {
  abstract classify(input: ClassificationInput): Promise<ClassificationResult>;
}
