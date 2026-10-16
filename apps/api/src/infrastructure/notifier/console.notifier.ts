import { Injectable, Logger } from '@nestjs/common';
import { NotifierPort, type NotifierEvent } from '../../application/ports';

/** Logs notifications. New matches are also visible in the panel as status "new". */
@Injectable()
export class ConsoleNotifier extends NotifierPort {
  private readonly logger = new Logger('Notifier');

  async notify(event: NotifierEvent): Promise<void> {
    switch (event.type) {
      case 'match': {
        const m = event.match;
        this.logger.log(
          `Yeni eşleşme @${m.username} [${m.keywords.join(', ')}] (${m.source}) ${m.permalink} — ${m.snippet}`,
        );
        break;
      }
      case 'token_refresh_failed':
        this.logger.error(
          `Token yenilenemedi: ${event.error} (bitiş: ${event.expiresAt?.toISOString() ?? 'bilinmiyor'})`,
        );
        break;
      case 'poll_suspended':
        this.logger.warn(
          `Poll ${event.until.toISOString()} tarihine kadar askıya alındı: ${event.reason}`,
        );
        break;
    }
  }
}
