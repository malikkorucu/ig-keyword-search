import { describeError, InstagramApiError } from '../../domain/instagram-error';
import type { Account } from '../../domain/models';
import type { AccountRepository, ClockPort, InstagramPort, TokenRepository } from '../ports';

export interface VerifyAccountResult {
  account: Account;
  accessible: boolean;
  message: string | null;
}

export class AccountNotFoundError extends Error {}

/** "Şimdi doğrula": checks whether business_discovery can read the account. */
export class VerifyAccountUseCase {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly tokens: TokenRepository,
    private readonly instagram: InstagramPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(accountId: string): Promise<VerifyAccountResult> {
    const account = await this.accounts.findById(accountId);
    if (!account) throw new AccountNotFoundError(accountId);
    const token = await this.tokens.get();
    if (!token) throw new Error('Access token yok');

    const now = this.clock.now();
    let accessible = true;
    let message: string | null = null;
    try {
      await this.instagram.fetchRecentMedia(account.username, 1, token.accessToken);
      await this.accounts.markAccessible(account.id, now);
    } catch (error) {
      message = describeError(error).message;
      if (error instanceof InstagramApiError && error.kind === 'account_inaccessible') {
        accessible = false;
        await this.accounts.markInaccessible(account.id, message, now);
      } else {
        // Rate limit / auth / network: says nothing about the account itself.
        accessible = account.accessible;
        await this.accounts.recordError(account.id, message, now);
      }
    }
    const updated = (await this.accounts.findById(account.id)) ?? account;
    return { account: updated, accessible, message };
  }
}
