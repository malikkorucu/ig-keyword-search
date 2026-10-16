import type { IgMedia } from '../../domain/models';

export interface RefreshedToken {
  accessToken: string;
  expiresAt: Date | null;
}

/**
 * Instagram Graph API. Implementations throw `InstagramApiError` (domain) so use-cases can
 * react to rate limits, inaccessible accounts and auth failures.
 */
export abstract class InstagramPort {
  abstract fetchRecentMedia(
    username: string,
    limit: number,
    accessToken: string,
  ): Promise<IgMedia[]>;
  abstract refreshLongLivedToken(accessToken: string): Promise<RefreshedToken>;
  /** Expiry of a token as reported by Graph `debug_token` (null = never / unknown). */
  abstract inspectTokenExpiry(accessToken: string): Promise<Date | null>;
}
