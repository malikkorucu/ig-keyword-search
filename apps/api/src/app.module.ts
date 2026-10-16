import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { CoreModule } from './core.module';
import { AccountsController } from './http/accounts/accounts.controller';
import { AuthController } from './http/auth/auth.controller';
import { SessionAuthGuard } from './http/auth/session-auth.guard';
import { DomainExceptionFilter } from './http/common/domain-exception.filter';
import { DashboardController } from './http/dashboard/dashboard.controller';
import { HealthController } from './http/health.controller';
import { KeywordsController } from './http/keywords/keywords.controller';
import { PollRunsController } from './http/logs/poll-runs.controller';
import { MatchesController } from './http/matches/matches.controller';
import { SettingsController } from './http/settings/settings.controller';
import { TelegramController } from './http/telegram/telegram.controller';
import { PollSchedulerService } from './infrastructure/scheduler/poll-scheduler.service';
import { TokenCheckService } from './infrastructure/scheduler/token-check.service';

/** API process: HTTP panel API + schedulers (which only enqueue jobs). */
@Module({
  imports: [CoreModule.forRoot({ runMigrations: true }), ScheduleModule.forRoot()],
  controllers: [
    HealthController,
    AuthController,
    DashboardController,
    MatchesController,
    AccountsController,
    KeywordsController,
    SettingsController,
    PollRunsController,
    TelegramController,
  ],
  providers: [
    PollSchedulerService,
    TokenCheckService,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule {}
