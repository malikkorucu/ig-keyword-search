import { Injectable, Logger } from '@nestjs/common';
import {
  ClockPort,
  NotifierPort,
  TelegramChatRepository,
  TelegramPort,
  type NotifierEvent,
} from '../../application/ports';
import { formatTelegramMessage } from './telegram-message';

/** Sends every event to all active Telegram chats; one failing chat does not affect the others. */
@Injectable()
export class TelegramNotifier extends NotifierPort {
  private readonly logger = new Logger('TelegramNotifier');

  constructor(
    private readonly telegram: TelegramPort,
    private readonly chats: TelegramChatRepository,
    private readonly clock: ClockPort,
  ) {
    super();
  }

  async notify(event: NotifierEvent): Promise<void> {
    if (!this.telegram.isConfigured()) return;
    const chats = await this.chats.findActive();
    if (chats.length === 0) return;

    const text = formatTelegramMessage(event);
    await Promise.all(
      chats.map(async (chat) => {
        try {
          await this.telegram.sendMessage(chat.chatId, text);
          await this.chats.recordResult(chat.id, null, this.clock.now());
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`${chat.chatId} gönderilemedi: ${message}`);
          await this.chats.recordResult(chat.id, message, this.clock.now());
        }
      }),
    );
  }
}
