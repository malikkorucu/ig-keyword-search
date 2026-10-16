import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  type OnModuleDestroy,
  type Provider,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import {
  AccountRepository,
  ClassifierPort,
  ClockPort,
  InstagramPort,
  JobQueuePort,
  KeywordRepository,
  MatchRepository,
  NotifierPort,
  PollRunRepository,
  ProcessedPostRepository,
  SettingsRepository,
  SystemClock,
  TelegramChatRepository,
  TelegramPort,
  TokenRepository,
} from './application/ports';
import { BootstrapTokenUseCase } from './application/use-cases/bootstrap-token.use-case';
import { RecordMatchService } from './application/use-cases/record-match.service';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { RunPollUseCase } from './application/use-cases/run-poll.use-case';
import { VerifyAccountUseCase } from './application/use-cases/verify-account.use-case';
import { ENV, type Env, loadEnv } from './config/env';
import { PassThroughClassifier } from './infrastructure/classifier/pass-through.classifier';
import { GraphInstagramAdapter } from './infrastructure/instagram/graph-instagram.adapter';
import { CompositeNotifier } from './infrastructure/notifier/composite.notifier';
import { ConsoleNotifier } from './infrastructure/notifier/console.notifier';
import { TelegramNotifier } from './infrastructure/notifier/telegram.notifier';
import { buildDataSourceOptions } from './infrastructure/persistence/data-source-options';
import { ENTITIES } from './infrastructure/persistence/entities';
import {
  TypeOrmAccountRepository,
  TypeOrmKeywordRepository,
  TypeOrmMatchRepository,
  TypeOrmPollRunRepository,
  TypeOrmProcessedPostRepository,
  TypeOrmSettingsRepository,
  TypeOrmTelegramChatRepository,
  TypeOrmTokenRepository,
} from './infrastructure/persistence/repositories';
import { BullMqJobQueue } from './infrastructure/queue/bullmq-job-queue.adapter';
import { REDIS_CONNECTION } from './infrastructure/queue/queue.constants';
import { TelegramBotAdapter } from './infrastructure/telegram/telegram-bot.adapter';

export interface CoreModuleOptions {
  /** Only the API process runs migrations, so api and worker never race. */
  runMigrations: boolean;
}

const useCaseProviders: Provider[] = [
  {
    provide: RecordMatchService,
    useFactory: (c: ClassifierPort, m: MatchRepository, n: NotifierPort, clock: ClockPort) =>
      new RecordMatchService(c, m, n, clock),
    inject: [ClassifierPort, MatchRepository, NotifierPort, ClockPort],
  },
  {
    provide: RunPollUseCase,
    useFactory: (
      settings: SettingsRepository,
      tokens: TokenRepository,
      keywords: KeywordRepository,
      accounts: AccountRepository,
      processedPosts: ProcessedPostRepository,
      pollRuns: PollRunRepository,
      instagram: InstagramPort,
      queue: JobQueuePort,
      notifier: NotifierPort,
      recordMatch: RecordMatchService,
      clock: ClockPort,
    ) =>
      new RunPollUseCase({
        settings,
        tokens,
        keywords,
        accounts,
        processedPosts,
        pollRuns,
        instagram,
        queue,
        notifier,
        recordMatch,
        clock,
      }),
    inject: [
      SettingsRepository,
      TokenRepository,
      KeywordRepository,
      AccountRepository,
      ProcessedPostRepository,
      PollRunRepository,
      InstagramPort,
      JobQueuePort,
      NotifierPort,
      RecordMatchService,
      ClockPort,
    ],
  },
  {
    provide: RefreshTokenUseCase,
    useFactory: (
      t: TokenRepository,
      s: SettingsRepository,
      i: InstagramPort,
      n: NotifierPort,
      c: ClockPort,
    ) => new RefreshTokenUseCase(t, s, i, n, c),
    inject: [TokenRepository, SettingsRepository, InstagramPort, NotifierPort, ClockPort],
  },
  {
    provide: BootstrapTokenUseCase,
    useFactory: (t: TokenRepository, i: InstagramPort) => new BootstrapTokenUseCase(t, i),
    inject: [TokenRepository, InstagramPort],
  },
  {
    provide: VerifyAccountUseCase,
    useFactory: (a: AccountRepository, t: TokenRepository, i: InstagramPort, c: ClockPort) =>
      new VerifyAccountUseCase(a, t, i, c),
    inject: [AccountRepository, TokenRepository, InstagramPort, ClockPort],
  },
];

const adapterProviders: Provider[] = [
  { provide: SettingsRepository, useClass: TypeOrmSettingsRepository },
  { provide: TokenRepository, useClass: TypeOrmTokenRepository },
  { provide: KeywordRepository, useClass: TypeOrmKeywordRepository },
  { provide: AccountRepository, useClass: TypeOrmAccountRepository },
  { provide: ProcessedPostRepository, useClass: TypeOrmProcessedPostRepository },
  { provide: MatchRepository, useClass: TypeOrmMatchRepository },
  { provide: PollRunRepository, useClass: TypeOrmPollRunRepository },
  { provide: InstagramPort, useClass: GraphInstagramAdapter },
  { provide: ClassifierPort, useClass: PassThroughClassifier },
  { provide: TelegramChatRepository, useClass: TypeOrmTelegramChatRepository },
  { provide: TelegramPort, useClass: TelegramBotAdapter },
  ConsoleNotifier,
  TelegramNotifier,
  {
    provide: NotifierPort,
    useFactory: (console: ConsoleNotifier, telegram: TelegramNotifier) =>
      new CompositeNotifier([console, telegram]),
    inject: [ConsoleNotifier, TelegramNotifier],
  },
  { provide: JobQueuePort, useClass: BullMqJobQueue },
  { provide: ClockPort, useClass: SystemClock },
];

class RedisCloser implements OnModuleDestroy {
  constructor(@Inject(REDIS_CONNECTION) private readonly redis: Redis) {}
  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}

/** Ports → adapters and use-case wiring shared by the API and worker processes. */
@Global()
@Module({})
export class CoreModule {
  static forRoot(options: CoreModuleOptions): DynamicModule {
    const env = loadEnv();
    const exported = [ENV, REDIS_CONNECTION, ...adapterProviders, ...useCaseProviders].map((p) =>
      typeof p === 'object' && 'provide' in p ? p.provide : p,
    );
    return {
      module: CoreModule,
      imports: [
        TypeOrmModule.forRoot({
          ...buildDataSourceOptions(env.DATABASE_URL, env.DATABASE_SSL),
          migrationsRun: options.runMigrations,
        }),
        TypeOrmModule.forFeature(ENTITIES),
      ],
      providers: [
        { provide: ENV, useValue: env },
        {
          provide: REDIS_CONNECTION,
          useFactory: (e: Env) => new Redis(e.REDIS_URL, { maxRetriesPerRequest: null }),
          inject: [ENV],
        },
        RedisCloser,
        ...adapterProviders,
        ...useCaseProviders,
      ],
      exports: exported,
    };
  }
}
