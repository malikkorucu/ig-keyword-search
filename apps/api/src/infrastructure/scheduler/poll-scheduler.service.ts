import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Interval, SchedulerRegistry } from '@nestjs/schedule';
import { JobQueuePort, PollRunRepository, SettingsRepository } from '../../application/ports';

const JOB_NAME = 'poll';

/**
 * Enqueues poll jobs every `pollIntervalMinutes` (read from the DB). Only enqueues — the
 * worker process does the scanning. The interval is rebuilt when the setting changes.
 */
@Injectable()
export class PollSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PollSchedulerService.name);
  private currentMinutes: number | null = null;
  private nextRunAt: Date | null = null;

  constructor(
    private readonly registry: SchedulerRegistry,
    private readonly settings: SettingsRepository,
    private readonly pollRuns: PollRunRepository,
    private readonly queue: JobQueuePort,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.reschedule();
    // Catch up after a restart/deploy instead of waiting a full interval.
    const latest = await this.pollRuns.latest();
    const minutes = this.currentMinutes ?? 0;
    if (!latest || Date.now() - latest.startedAt.getTime() >= minutes * 60_000) {
      await this.enqueue('startup catch-up');
    }
  }

  getNextRunAt(): Date | null {
    return this.nextRunAt;
  }

  /** Re-reads the interval; rebuilds the job only when it changed. */
  async reschedule(): Promise<void> {
    const { pollIntervalMinutes } = await this.settings.get();
    if (pollIntervalMinutes === this.currentMinutes) return;

    if (this.registry.doesExist('interval', JOB_NAME)) this.registry.deleteInterval(JOB_NAME);
    const ms = pollIntervalMinutes * 60_000;
    const handle = setInterval(() => {
      this.nextRunAt = new Date(Date.now() + ms);
      void this.enqueue('cron');
    }, ms);
    this.registry.addInterval(JOB_NAME, handle);
    this.currentMinutes = pollIntervalMinutes;
    this.nextRunAt = new Date(Date.now() + ms);
    this.logger.log(
      `Poll aralığı: ${pollIntervalMinutes} dk (sonraki: ${this.nextRunAt.toISOString()})`,
    );
  }

  /** Safety net in case settings were changed outside the API (e.g. directly in the DB). */
  @Interval('poll-settings-reconcile', 60_000)
  async reconcile(): Promise<void> {
    await this.reschedule().catch((e: unknown) =>
      this.logger.error(`reschedule failed: ${String(e)}`),
    );
  }

  private async enqueue(reason: string): Promise<void> {
    try {
      await this.queue.enqueuePoll('cron');
      this.logger.debug(`Poll job enqueued (${reason})`);
    } catch (error) {
      this.logger.error(`Poll job enqueue failed: ${String(error)}`);
    }
  }
}
