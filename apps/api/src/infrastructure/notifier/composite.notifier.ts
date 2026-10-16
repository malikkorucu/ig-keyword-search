import { Logger } from '@nestjs/common';
import { NotifierPort, type NotifierEvent } from '../../application/ports';

/**
 * Fans an event out to several notifiers. Failures are logged, never thrown: a broken channel
 * must not fail the poll/OCR job that produced the event (the match is already stored).
 */
export class CompositeNotifier extends NotifierPort {
  private readonly logger = new Logger('Notifier');

  constructor(private readonly notifiers: NotifierPort[]) {
    super();
  }

  async notify(event: NotifierEvent): Promise<void> {
    const results = await Promise.allSettled(this.notifiers.map((n) => n.notify(event)));
    for (const r of results) {
      if (r.status === 'rejected') this.logger.error(`Bildirim hatası: ${String(r.reason)}`);
    }
  }
}
