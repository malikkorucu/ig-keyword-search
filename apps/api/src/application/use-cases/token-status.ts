import type { TokenStatusDto } from '@igw/shared';
import type { TokenState } from '../../domain/models';
import { daysUntil } from '../../domain/token';

/** Below this many days the token is shown as critical even if refreshes have not failed. */
const CRITICAL_DAYS = 3;

export function toTokenStatus(token: TokenState | null, now: Date): TokenStatusDto {
  if (!token) {
    return {
      configured: false,
      expiresAt: null,
      daysLeft: null,
      lastRefreshedAt: null,
      lastRefreshAttemptAt: null,
      lastRefreshError: null,
      critical: true,
    };
  }
  const days = daysUntil(token.expiresAt, now);
  const lastAttemptFailed = token.lastRefreshError !== null;
  return {
    configured: true,
    expiresAt: token.expiresAt?.toISOString() ?? null,
    daysLeft: days === null ? null : Math.floor(days),
    lastRefreshedAt: token.lastRefreshedAt?.toISOString() ?? null,
    lastRefreshAttemptAt: token.lastRefreshAttemptAt?.toISOString() ?? null,
    lastRefreshError: token.lastRefreshError,
    critical: lastAttemptFailed || (days !== null && days < CRITICAL_DAYS),
  };
}
