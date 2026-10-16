import {
  FakeClock,
  FakeInstagram,
  InMemoryAccounts,
  InMemoryTokens,
  makeAccount,
} from '../../../test/fakes';
import { InstagramApiError } from '../../domain/instagram-error';
import { VerifyAccountUseCase } from './verify-account.use-case';

function setup(account = makeAccount('target')) {
  const accounts = new InMemoryAccounts([account]);
  const tokens = new InMemoryTokens({
    accessToken: 't',
    expiresAt: null,
    lastRefreshedAt: null,
    lastRefreshAttemptAt: null,
    lastRefreshError: null,
  });
  const instagram = new FakeInstagram();
  return {
    account,
    accounts,
    instagram,
    useCase: new VerifyAccountUseCase(accounts, tokens, instagram, new FakeClock()),
  };
}

describe('VerifyAccountUseCase', () => {
  it('re-enables a previously inaccessible account that is now readable', async () => {
    const t = setup(makeAccount('target', { accessible: false, inaccessibleReason: 'old' }));
    const r = await t.useCase.execute(t.account.id);
    expect(r.accessible).toBe(true);
    expect(r.account).toMatchObject({ accessible: true, inaccessibleReason: null });
    expect(t.instagram.calls[0]?.limit).toBe(1);
  });

  it('marks the account inaccessible on #100', async () => {
    const t = setup();
    t.instagram.errors.set(
      'target',
      new InstagramApiError('account_inaccessible', 'not business', 100),
    );
    const r = await t.useCase.execute(t.account.id);
    expect(r).toMatchObject({ accessible: false, message: 'not business' });
    expect(r.account.accessible).toBe(false);
  });

  it('does not flip accessibility on rate limits', async () => {
    const t = setup();
    t.instagram.errors.set('target', new InstagramApiError('rate_limit', '(#4) limit', 4));
    const r = await t.useCase.execute(t.account.id);
    expect(r.accessible).toBe(true);
    expect(r.account.lastError).toBe('(#4) limit');
  });
});
