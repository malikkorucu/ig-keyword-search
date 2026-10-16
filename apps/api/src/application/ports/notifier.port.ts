import type { Match } from '../../domain/models';

export type NotifierEvent =
  | { type: 'match'; match: Match }
  | { type: 'token_refresh_failed'; error: string; expiresAt: Date | null }
  | { type: 'poll_suspended'; until: Date; reason: string };

export abstract class NotifierPort {
  abstract notify(event: NotifierEvent): Promise<void>;
}
