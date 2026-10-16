export interface TelegramChatInfo {
  chatId: string;
  type: string;
  title: string;
}

/** Telegram Bot API. */
export abstract class TelegramPort {
  /** false when no bot token is configured. */
  abstract isConfigured(): boolean;
  abstract getBotUsername(): Promise<string>;
  abstract sendMessage(chatId: string, html: string): Promise<void>;
  /** Chats the bot has recently seen (via getUpdates): DMs, groups, channels where it is admin. */
  abstract discoverChats(): Promise<TelegramChatInfo[]>;
}
