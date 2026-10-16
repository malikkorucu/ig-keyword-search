import { Inject, Injectable } from '@nestjs/common';
import { InstagramPort, type RefreshedToken } from '../../application/ports';
import { ENV, type Env } from '../../config/env';
import { InstagramApiError } from '../../domain/instagram-error';
import type { IgMedia, IgMediaChild } from '../../domain/models';

const REQUEST_TIMEOUT_MS = 20_000;

interface GraphErrorBody {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number };
}

interface GraphChild {
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
}

interface GraphMedia extends GraphChild {
  id: string;
  caption?: string;
  permalink?: string;
  timestamp?: string;
  children?: { data?: GraphChild[] };
}

interface BusinessDiscoveryResponse {
  business_discovery?: { media?: { data?: GraphMedia[] } };
}

@Injectable()
export class GraphInstagramAdapter extends InstagramPort {
  private readonly baseUrl: string;

  constructor(@Inject(ENV) private readonly env: Env) {
    super();
    this.baseUrl = `${env.GRAPH_API_BASE_URL.replace(/\/$/, '')}/${env.GRAPH_API_VERSION}`;
  }

  async fetchRecentMedia(username: string, limit: number, accessToken: string): Promise<IgMedia[]> {
    if (!this.env.IG_USER_ID) throw new InstagramApiError('auth', 'IG_USER_ID tanımlı değil');
    const fields =
      `business_discovery.username(${username})` +
      `{media.limit(${limit}){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,` +
      `children{media_type,media_url,thumbnail_url}}}`;
    const body = await this.get<BusinessDiscoveryResponse>(`/${this.env.IG_USER_ID}`, {
      fields,
      access_token: accessToken,
    });
    if (!body.business_discovery) {
      throw new InstagramApiError(
        'account_inaccessible',
        `@${username}: business_discovery boş döndü`,
        100,
      );
    }
    return (body.business_discovery.media?.data ?? []).map(toMedia);
  }

  async refreshLongLivedToken(accessToken: string): Promise<RefreshedToken> {
    const body = await this.get<{ access_token?: string; expires_in?: number }>(
      '/oauth/access_token',
      {
        grant_type: 'fb_exchange_token',
        client_id: this.env.FB_APP_ID,
        client_secret: this.env.FB_APP_SECRET,
        fb_exchange_token: accessToken,
      },
    );
    if (!body.access_token)
      throw new InstagramApiError('auth', 'Token exchange yanıtında access_token yok');
    const expiresAt = body.expires_in
      ? new Date(Date.now() + body.expires_in * 1000)
      : await this.inspectTokenExpiry(body.access_token).catch(() => null);
    return { accessToken: body.access_token, expiresAt };
  }

  async inspectTokenExpiry(accessToken: string): Promise<Date | null> {
    const body = await this.get<{ data?: { expires_at?: number; is_valid?: boolean } }>(
      '/debug_token',
      {
        input_token: accessToken,
        access_token: `${this.env.FB_APP_ID}|${this.env.FB_APP_SECRET}`,
      },
    );
    const expiresAt = body.data?.expires_at;
    return expiresAt ? new Date(expiresAt * 1000) : null;
  }

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = `${this.baseUrl}${path}?${new URLSearchParams(params).toString()}`;
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      // Never include the URL: it carries the access token.
      const reason = error instanceof Error ? error.message : String(error);
      throw new InstagramApiError('network', `Graph API'ye ulaşılamadı: ${reason}`);
    }
    const text = await response.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new InstagramApiError(
        'other',
        `Graph API geçersiz JSON döndü (HTTP ${response.status})`,
        undefined,
        undefined,
        response.status,
      );
    }
    const errorBody = (json as GraphErrorBody).error;
    if (!response.ok || errorBody)
      throw InstagramApiError.fromGraphError(errorBody, response.status);
    return json as T;
  }
}

function toChild(c: GraphChild): IgMediaChild {
  return {
    mediaType: c.media_type ?? 'IMAGE',
    mediaUrl: c.media_url ?? null,
    thumbnailUrl: c.thumbnail_url ?? null,
  };
}

function toMedia(m: GraphMedia): IgMedia {
  return {
    id: m.id,
    caption: m.caption ?? null,
    mediaType: m.media_type ?? 'IMAGE',
    mediaUrl: m.media_url ?? null,
    thumbnailUrl: m.thumbnail_url ?? null,
    permalink: m.permalink ?? `https://www.instagram.com/`,
    timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    children: (m.children?.data ?? []).map(toChild),
  };
}
