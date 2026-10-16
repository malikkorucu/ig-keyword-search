import { Controller, Get } from '@nestjs/common';
import type { DashboardDto } from '@igw/shared';
import {
  AccountRepository,
  ClockPort,
  JobQueuePort,
  MatchRepository,
  PollRunRepository,
  SettingsRepository,
  TokenRepository,
} from '../../application/ports';
import { toTokenStatus } from '../../application/use-cases/token-status';
import { PollSchedulerService } from '../../infrastructure/scheduler/poll-scheduler.service';
import { presentPollRun } from '../common/presenters';

const DAY_MS = 24 * 60 * 60 * 1000;

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly tokens: TokenRepository,
    private readonly accounts: AccountRepository,
    private readonly matches: MatchRepository,
    private readonly pollRuns: PollRunRepository,
    private readonly queue: JobQueuePort,
    private readonly scheduler: PollSchedulerService,
    private readonly clock: ClockPort,
  ) {}

  @Get()
  async get(): Promise<DashboardDto> {
    const now = this.clock.now();
    const [
      settings,
      token,
      accountCounts,
      matchesLast24h,
      newMatches,
      lastRun,
      recentErrors,
      queues,
    ] = await Promise.all([
      this.settings.get(),
      this.tokens.get(),
      this.accounts.countByState(),
      this.matches.countDetectedSince(new Date(now.getTime() - DAY_MS)),
      this.matches.countByStatus('new'),
      this.pollRuns.latest(),
      this.pollRuns.recentErrors(10),
      this.queue.stats().catch(() => []),
    ]);
    const suspended = settings.pollSuspendedUntil && settings.pollSuspendedUntil > now;
    return {
      lastRun: lastRun ? presentPollRun(lastRun) : null,
      nextPollAt: this.scheduler.getNextRunAt()?.toISOString() ?? null,
      pollSuspendedUntil: suspended ? settings.pollSuspendedUntil!.toISOString() : null,
      pollSuspendReason: suspended ? settings.pollSuspendReason : null,
      token: toTokenStatus(token, now),
      activeAccounts: accountCounts.active,
      inaccessibleAccounts: accountCounts.inaccessible,
      matchesLast24h,
      newMatches,
      queues,
      recentErrors: recentErrors.map((e) => ({ ...e, at: e.at.toISOString() })),
    };
  }
}
