import { Injectable } from '@nestjs/common';
import { ClassifierPort, type ClassificationResult } from '../../application/ports';

/** Accepts every keyword match. Swap for an LLM-backed adapter later without touching use-cases. */
@Injectable()
export class PassThroughClassifier extends ClassifierPort {
  async classify(): Promise<ClassificationResult> {
    return { relevant: true };
  }
}
