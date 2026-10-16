import type { InstagramPort, TokenRepository } from '../ports';

/** First start: seed the token store from env and look up its expiry. Later starts are no-ops. */
export class BootstrapTokenUseCase {
  constructor(
    private readonly tokens: TokenRepository,
    private readonly instagram: InstagramPort,
  ) {}

  async execute(envToken: string | undefined): Promise<'initialized' | 'existing' | 'missing'> {
    const current = await this.tokens.get();
    if (current) {
      if (!current.expiresAt) await this.tryResolveExpiry(current.accessToken);
      return 'existing';
    }
    if (!envToken) return 'missing';
    await this.tokens.initialize(envToken, null);
    await this.tryResolveExpiry(envToken);
    return 'initialized';
  }

  private async tryResolveExpiry(token: string): Promise<void> {
    try {
      await this.tokens.setExpiry(await this.instagram.inspectTokenExpiry(token));
    } catch {
      // Unknown expiry is tolerated: the daily check will then refresh the token.
    }
  }
}
