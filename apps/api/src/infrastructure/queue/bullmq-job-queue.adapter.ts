import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { PollTrigger } from '@igw/shared';
import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { JobQueuePort, type QueueStats } from '../../application/ports';
import type { OcrJobPayload } from '../../domain/models';
import { OCR_JOB_OPTIONS, OCR_QUEUE, POLL_QUEUE, REDIS_CONNECTION } from './queue.constants';

export interface PollJobData {
  trigger: PollTrigger;
}

@Injectable()
export class BullMqJobQueue extends JobQueuePort implements OnModuleDestroy {
  private readonly pollQueue: Queue<PollJobData>;
  private readonly ocrQueue: Queue<OcrJobPayload>;

  constructor(@Inject(REDIS_CONNECTION) connection: Redis) {
    super();
    this.pollQueue = new Queue<PollJobData>(POLL_QUEUE, { connection });
    this.ocrQueue = new Queue<OcrJobPayload>(OCR_QUEUE, { connection });
  }

  async enqueuePoll(trigger: PollTrigger): Promise<boolean> {
    // A poll that is still waiting covers this one; avoid piling up behind a slow run.
    const counts = await this.pollQueue.getJobCounts('waiting', 'delayed');
    if ((counts.waiting ?? 0) + (counts.delayed ?? 0) > 0) return false;
    await this.pollQueue.add(
      'poll',
      { trigger },
      { removeOnComplete: { count: 200 }, removeOnFail: { count: 200 } },
    );
    return true;
  }

  async enqueueOcr(payload: OcrJobPayload): Promise<void> {
    await this.ocrQueue.add('ocr', payload, { ...OCR_JOB_OPTIONS, jobId: `ocr-${payload.postId}` });
  }

  async stats(): Promise<QueueStats[]> {
    return Promise.all(
      [this.pollQueue, this.ocrQueue].map(async (q) => {
        const c = await q.getJobCounts('waiting', 'active', 'delayed', 'failed');
        return {
          name: q.name,
          waiting: c.waiting ?? 0,
          active: c.active ?? 0,
          delayed: c.delayed ?? 0,
          failed: c.failed ?? 0,
        };
      }),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.pollQueue.close(), this.ocrQueue.close()]);
  }
}
