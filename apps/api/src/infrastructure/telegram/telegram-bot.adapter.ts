import { Inject, Injectable } from '@nestjs/common';
import { TelegramPort, type TelegramChatInfo } from '../../application/ports';
import { ENV, type Env } from '../../config/env';

const REQUEST_TIMEOUT_MS = 15_000;

interface TgResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
}

interface TgChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

type TgUpdate = Partial<
  Record<'message' | 'channel_post' | 'edited_channel_post' | 'my_chat_member', { chat: TgChat }>
>;

export class TelegramApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = 'TelegramApiError';
  }
}

@Injectable()
export class TelegramBotAdapter extends TelegramPort {
  private botUsername: string | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {
    super();
  }

  isConfigured(): boolean {
    return !!this.env.TELEGRAM_BOT_TOKEN;
  }

  async getBotUsername(): Promise<string> {
    if (!this.botUsername) {
      const me = await this.call<{ username: string }>('getMe', {});
      this.botUsername = me.username;
    }
    return this.botUsername;
  }

  async sendMessage(chatId: string, html: string): Promise<void> {
    const body = {
      chat_id: chatId,
      text: html,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    };
    try {
      await this.call('sendMessage', body);
    } catch (error) {
      // Respect Telegram flood control once.
      const retryAfter = (error as { retryAfter?: number }).retryAfter;
      if (!retryAfter || retryAfter > 30) throw error;
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      await this.call('sendMessage', body);
    }
  }

  async discoverChats(): Promise<TelegramChatInfo[]> {
    const updates = await this.call<TgUpdate[]>('getUpdates', {
      allowed_updates: ['message', 'channel_post', 'my_chat_member'],
    });
    const chats = new Map<string, TelegramChatInfo>();
    for (const u of updates) {
      const chat = (u.channel_post ?? u.message ?? u.edited_channel_post ?? u.my_chat_member)?.chat;
      if (!chat) continue;
      const name =
        chat.title ??
        ([chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || '');
      chats.set(String(chat.id), {
        chatId: String(chat.id),
        type: chat.type,
        title: chat.username ? `${name} (@${chat.username})` : name,
      });
    }
    return [...chats.values()];
  }

  private async call<T>(method: string, body: object): Promise<T> {
    const token = this.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new TelegramApiError('TELEGRAM_BOT_TOKEN tanımlı değil');
    let response: Response;
    try {
      response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      // Never include the URL: it carries the bot token.
      throw new TelegramApiError(
        `Telegram'a ulaşılamadı: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const json = (await response.json().catch(() => ({ ok: false }))) as TgResponse<T>;
    if (!json.ok) {
      const err = new TelegramApiError(
        json.description ?? `Telegram HTTP ${response.status}`,
        json.error_code,
      );
      Object.assign(err, { retryAfter: json.parameters?.retry_after });
      throw err;
    }
    return json.result as T;
  }
}
