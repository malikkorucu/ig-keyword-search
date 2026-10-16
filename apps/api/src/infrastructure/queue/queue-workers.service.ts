import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { type Job, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { ClockPort, PollRunRepository } from '../../application/ports';
import { ProcessOcrUseCase } from '../../application/use-cases/process-ocr.use-case';
import { RunPollUseCase } from '../../application/use-cases/run-poll.use-case';
import { ENV, type Env } from '../../config/env';
import type { OcrJobPayload } from '../../domain/models';
import type { PollJobData } from './bullmq-job-queue.adapter';
import { OCR_QUEUE, POLL_QUEUE, REDIS_CONNECTION } from './queue.constants';

const STALE_RUN_MS = 60 * 60 * 1000;

/** Worker process: one BullMQ worker per queue so OCR never blocks polling. */
@Injectable()
export class QueueWorkersService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(QueueWorkersService.name);
  private workers: Worker[] = [];

  constructor(
    @Inject(REDIS_CONNECTION) private readonly connection: Redis,
    @Inject(ENV) private readonly env: Env,
    private readonly runPoll: RunPollUseCase,
    private readonly processOcr: ProcessOcrUseCase,
    private readonly pollRuns: PollRunRepository,
    private readonly clock: ClockPort,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const now = this.clock.now();
    const stale = await this.pollRuns.failStale(new Date(now.getTime() - STALE_RUN_MS), now);
    if (stale) this.logger.warn(`${stale} yarım kalmış poll run "failed" olarak işaretlendi`);

    const pollWorker = new Worker<PollJobData>(
      POLL_QUEUE,
      async (job: Job<PollJobData>) => {
        const r = await this.runPoll.execute(job.data.trigger);
        this.logger.log(
          `Poll ${r.status}: ${r.accountsScanned} hesap, ${r.newPosts} yeni post, ${r.matchesFound} eşleşme, ` +
            `${r.ocrJobsEnqueued} OCR job, ${r.errors.length} hata${r.note ? ` — ${r.note}` : ''}`,
        );
        return { runId: r.runId, status: r.status };
      },
      { connection: this.connection, concurrency: 1, lockDuration: 5 * 60_000 },
    );

    const ocrWorker = new Worker<OcrJobPayload>(
      OCR_QUEUE,
      async (job: Job<OcrJobPayload>) => {
        const r = await this.processOcr.execute(job.data);
        return { matched: r.matched, keywords: r.keywords, failedImages: r.failedImages };
      },
      {
        connection: this.connection,
        concurrency: this.env.OCR_CONCURRENCY,
        lockDuration: 2 * 60_000,
      },
    );
    ocrWorker.on('failed', (job, error) => {
      if (!job) return;
      const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
      this.logger.warn(
        `OCR ${job.data.postId} başarısız (deneme ${job.attemptsMade}/${job.opts.attempts ?? 1}): ${error.message}`,
      );
      if (exhausted) {
        this.processOcr.markFailed(job.data.postId).catch((e: unknown) => this.logger.error(e));
      }
    });

    for (const w of [pollWorker, ocrWorker]) {
      w.on('error', (error) => this.logger.error(`${w.name} worker error: ${error.message}`));
    }
    this.workers = [pollWorker, ocrWorker];
    this.logger.log(
      `Workers listening: ${POLL_QUEUE} (1), ${OCR_QUEUE} (${this.env.OCR_CONCURRENCY})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
  }
}
