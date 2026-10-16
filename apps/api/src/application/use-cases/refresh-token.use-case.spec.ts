import {
  FakeClock,
  FakeInstagram,
  InMemorySettings,
  InMemoryTokens,
  RecordingNotifier,
} from '../../../test/fakes';
import { InstagramApiError } from '../../domain/instagram-error';
import { BootstrapTokenUseCase } from './bootstrap-token.use-case';
import { RefreshTokenUseCase } from './refresh-token.use-case';
import { toTokenStatus } from './token-status';

const DAY = 24 * 60 * 60 * 1000;

function setup(daysLeft: number | null) {
  const clock = new FakeClock();
  const tokens = new InMemoryTokens({
    accessToken: 'old',
    expiresAt: daysLeft === null ? null : new Date(clock.now().getTime() + daysLeft * DAY),
    lastRefreshedAt: null,
    lastRefreshAttemptAt: null,
    lastRefreshError: null,
  });
  const instagram = new FakeInstagram();
  const notifier = new RecordingNotifier();
  const settings = new InMemorySettings();
  return {
    clock,
    tokens,
    instagram,
    notifier,
    settings,
    useCase: new RefreshTokenUseCase(tokens, settings, instagram, notifier, clock),
  };
}

describe('RefreshTokenUseCase', () => {
  it('does nothing while more than the threshold remains', async () => {
    const t = setup(30);
    const r = await t.useCase.execute();
    expect(r.refreshed).toBe(false);
    expect(t.tokens.value?.accessToken).toBe('old');
  });

  it('refreshes when fewer than 10 days remain', async () => {
    const t = setup(9);
    const newExpiry = new Date('2026-12-14T12:00:00Z');
    t.instagram.refreshResult = { accessToken: 'fresh', expiresAt: newExpiry };
    const r = await t.useCase.execute();
    expect(r.refreshed).toBe(true);
    expect(t.tokens.value).toMatchObject({
      accessToken: 'fresh',
      expiresAt: newExpiry,
      lastRefreshError: null,
    });
  });

  it('uses the threshold from settings', async () => {
    const t = setup(15);
    await t.settings.update({ tokenRefreshThresholdDays: 20 });
    expect((await t.useCase.execute()).refreshed).toBe(true);
  });

  it('refreshes when the expiry is unknown, and always when forced', async () => {
    expect((await setup(null).useCase.execute()).refreshed).toBe(true);
    expect((await setup(50).useCase.execute({ force: true })).refreshed).toBe(true);
  });

  it('records the failure, notifies, and the status turns critical', async () => {
    const t = setup(5);
    t.instagram.refreshResult = new InstagramApiError('auth', 'Error validating access token', 190);
    const r = await t.useCase.execute();
    expect(r.refreshed).toBe(false);
    expect(t.tokens.value).toMatchObject({
      accessToken: 'old',
      lastRefreshError: 'Error validating access token',
    });
    expect(t.notifier.events[0]).toMatchObject({ type: 'token_refresh_failed' });
    expect(toTokenStatus(t.tokens.value, t.clock.now()).critical).toBe(true);
  });
});

describe('BootstrapTokenUseCase', () => {
  it('seeds the token from env once and resolves its expiry', async () => {
    const tokens = new InMemoryTokens(null);
    const instagram = new FakeInstagram();
    instagram.tokenExpiry = new Date('2026-12-01T00:00:00Z');
    const useCase = new BootstrapTokenUseCase(tokens, instagram);

    expect(await useCase.execute('env-token')).toBe('initialized');
    expect(tokens.value).toMatchObject({
      accessToken: 'env-token',
      expiresAt: instagram.tokenExpiry,
    });

    await tokens.saveRefreshed('refreshed', new Date('2027-01-01T00:00:00Z'), new Date());
    expect(await useCase.execute('env-token')).toBe('existing');
    expect(tokens.value?.accessToken).toBe('refreshed');
  });
});

describe('BootstrapTokenUseCase without env token', () => {
  it('reports missing and stores nothing', async () => {
    const tokens = new InMemoryTokens(null);
    expect(await new BootstrapTokenUseCase(tokens, new FakeInstagram()).execute(undefined)).toBe(
      'missing',
    );
    expect(tokens.value).toBeNull();
  });
});
