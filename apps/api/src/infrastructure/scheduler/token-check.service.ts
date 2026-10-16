import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BootstrapTokenUseCase } from '../../application/use-cases/bootstrap-token.use-case';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case';
import { ENV, type Env } from '../../config/env';

@Injectable()
export class TokenCheckService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TokenCheckService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly bootstrapToken: BootstrapTokenUseCase,
    private readonly refreshToken: RefreshTokenUseCase,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const state = await this.bootstrapToken.execute(this.env.IG_ACCESS_TOKEN);
    if (state === 'initialized')
      this.logger.log('Access token IG_ACCESS_TOKEN değerinden yüklendi');
    if (state === 'missing') {
      this.logger.warn('IG_ACCESS_TOKEN tanımlı değil — token girilene kadar poll yapılamaz');
      return;
    }
    await this.dailyCheck();
  }

  @Cron('0 3 * * *', { name: 'token-daily-check', timeZone: 'UTC' })
  async dailyCheck(): Promise<void> {
    try {
      const result = await this.refreshToken.execute();
      this.logger.log(`Token kontrolü: ${result.message}`);
    } catch (error) {
      this.logger.error(`Token kontrolü başarısız: ${String(error)}`);
    }
  }
}
