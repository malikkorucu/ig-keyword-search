import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import {
  type SettingsDto,
  type TokenRefreshResultDto,
  type TokenStatusDto,
  type UpdateSettingsInput,
  updateSettingsSchema,
} from '@igw/shared';
import {
  ClockPort,
  JobQueuePort,
  SettingsRepository,
  TokenRepository,
} from '../../application/ports';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case';
import { toTokenStatus } from '../../application/use-cases/token-status';
import { PollSchedulerService } from '../../infrastructure/scheduler/poll-scheduler.service';
import { presentSettings } from '../common/presenters';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly tokens: TokenRepository,
    private readonly refreshToken: RefreshTokenUseCase,
    private readonly queue: JobQueuePort,
    private readonly scheduler: PollSchedulerService,
    private readonly clock: ClockPort,
  ) {}

  @Get()
  async get(): Promise<{
    settings: SettingsDto;
    token: TokenStatusDto;
    nextPollAt: string | null;
  }> {
    const [settings, token] = await Promise.all([this.settings.get(), this.tokens.get()]);
    return {
      settings: presentSettings(settings),
      token: toTokenStatus(token, this.clock.now()),
      nextPollAt: this.scheduler.getNextRunAt()?.toISOString() ?? null,
    };
  }

  @Patch()
  async update(
    @Body(new ZodValidationPipe(updateSettingsSchema)) body: UpdateSettingsInput,
  ): Promise<SettingsDto> {
    const updated = await this.settings.update(body);
    if (body.pollIntervalMinutes !== undefined) await this.scheduler.reschedule();
    return presentSettings(updated);
  }

  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(): Promise<TokenRefreshResultDto> {
    const result = await this.refreshToken.execute({ force: true });
    return { ...result, token: toTokenStatus(await this.tokens.get(), this.clock.now()) };
  }

  @Post('poll/run')
  @HttpCode(HttpStatus.ACCEPTED)
  async runPoll(): Promise<{ enqueued: boolean; message: string }> {
    const enqueued = await this.queue.enqueuePoll('manual');
    return {
      enqueued,
      message: enqueued ? 'Poll kuyruğa alındı' : 'Kuyrukta zaten bekleyen bir poll var',
    };
  }

  @Post('poll/resume')
  @HttpCode(HttpStatus.OK)
  async resume(): Promise<SettingsDto> {
    await this.settings.clearSuspension();
    return presentSettings(await this.settings.get());
  }
}
