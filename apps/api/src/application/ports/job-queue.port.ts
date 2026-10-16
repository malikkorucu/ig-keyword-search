import type { PollTrigger } from '@igw/shared';
import type { OcrJobPayload } from '../../domain/models';

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}

export abstract class JobQueuePort {
  /** Returns false when a poll is already waiting in the queue (nothing enqueued). */
  abstract enqueuePoll(trigger: PollTrigger): Promise<boolean>;
  /** Idempotent per post id. */
  abstract enqueueOcr(payload: OcrJobPayload): Promise<void>;
  abstract stats(): Promise<QueueStats[]>;
}
