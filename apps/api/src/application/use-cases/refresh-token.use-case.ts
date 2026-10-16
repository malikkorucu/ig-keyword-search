import { describeError } from '../../domain/instagram-error';
import { daysUntil } from '../../domain/token';
import type {
  ClockPort,
  InstagramPort,
  NotifierPort,
  SettingsRepository,
  TokenRepository,
} from '../ports';

export interface RefreshTokenResult {
  refreshed: boolean;
  message: string;
}

export class RefreshTokenUseCase {
  constructor(
    private readonly tokens: TokenRepository,
    private readonly settings: SettingsRepository,
    private readonly instagram: InstagramPort,
    private readonly notifier: NotifierPort,
    private readonly clock: ClockPort,
  ) {}

  /** Daily check: refresh when fewer than `tokenRefreshThresholdDays` remain (or always, when forced). */
  async execute(options: { force?: boolean } = {}): Promise<RefreshTokenResult> {
    const token = await this.tokens.get();
    if (!token) return { refreshed: false, message: 'Token tanımlı değil' };

    const now = this.clock.now();
    const { tokenRefreshThresholdDays } = await this.settings.get();
    const daysLeft = daysUntil(token.expiresAt, now);
    if (!options.force && daysLeft !== null && daysLeft >= tokenRefreshThresholdDays) {
      return {
        refreshed: false,
        message: `Yenileme gerekmiyor (${Math.floor(daysLeft)} gün kaldı)`,
      };
    }

    try {
      const refreshed = await this.instagram.refreshLongLivedToken(token.accessToken);
      await this.tokens.saveRefreshed(refreshed.accessToken, refreshed.expiresAt, now);
      return { refreshed: true, message: 'Token yenilendi' };
    } catch (error) {
      const { message } = describeError(error);
      await this.tokens.recordRefreshFailure(message, now);
      await this.notifier.notify({
        type: 'token_refresh_failed',
        error: message,
        expiresAt: token.expiresAt,
      });
      return { refreshed: false, message: `Token yenilenemedi: ${message}` };
    }
  }
}
