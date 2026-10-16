import { FakeClock, RecordingNotifier } from '../../../test/fakes';
import {
  NotifierPort,
  TelegramChatRepository,
  TelegramPort,
  type TelegramChatInfo,
} from '../../application/ports';
import type { Match, TelegramChat } from '../../domain/models';
import { CompositeNotifier } from './composite.notifier';
import { formatTelegramMessage } from './telegram-message';
import { TelegramNotifier } from './telegram.notifier';

const match: Match = {
  id: 'm1',
  postId: 'p1',
  accountId: 'a1',
  username: 'otel_<x>',
  keywords: ['alanya', 'side'],
  source: 'image',
  snippet: 'Alanya & Side <3',
  ocrText: "ALANYA'DA 3 GECE",
  permalink: 'https://www.instagram.com/p/p1/',
  postedAt: new Date('2026-10-15T09:00:00Z'),
  detectedAt: new Date('2026-10-15T09:05:00Z'),
  status: 'new',
};

class FakeTelegram extends TelegramPort {
  sent: Array<{ chatId: string; html: string }> = [];
  failFor = new Set<string>();
  constructor(private readonly configured = true) {
    super();
  }
  isConfigured() {
    return this.configured;
  }
  async getBotUsername() {
    return 'TestBot';
  }
  async sendMessage(chatId: string, html: string) {
    if (this.failFor.has(chatId))
      throw new Error('Forbidden: bot is not a member of the channel chat');
    this.sent.push({ chatId, html });
  }
  async discoverChats(): Promise<TelegramChatInfo[]> {
    return [];
  }
}

class InMemoryChats extends TelegramChatRepository {
  results: Record<string, string | null> = {};
  constructor(public items: TelegramChat[]) {
    super();
  }
  async list() {
    return this.items;
  }
  async findActive() {
    return this.items.filter((c) => c.active);
  }
  async findById(id: string) {
    return this.items.find((c) => c.id === id) ?? null;
  }
  async create(): Promise<TelegramChat> {
    throw new Error('unused');
  }
  async setActive() {
    return null;
  }
  async delete() {
    return false;
  }
  async recordResult(id: string, error: string | null) {
    this.results[id] = error;
  }
}

const chat = (id: string, chatId: string, active = true): TelegramChat => ({
  id,
  chatId,
  label: '',
  active,
  lastError: null,
  lastSentAt: null,
  createdAt: new Date(),
});

describe('formatTelegramMessage', () => {
  it('formats a match with escaped HTML, keywords, OCR text and link', () => {
    const html = formatTelegramMessage({ type: 'match', match });
    expect(html).toContain('@otel_&lt;x&gt;');
    expect(html).toContain('<code>alanya</code>, <code>side</code>');
    expect(html).toContain('Görsel (OCR)');
    expect(html).toContain('Alanya &amp; Side &lt;3');
    expect(html).toContain("ALANYA'DA 3 GECE");
    expect(html).toContain('<a href="https://www.instagram.com/p/p1/">');
    expect(html).toContain('15.10.2026 12:00'); // Europe/Istanbul
  });

  it('formats token and suspension warnings', () => {
    expect(
      formatTelegramMessage({
        type: 'token_refresh_failed',
        error: 'Error <190>',
        expiresAt: null,
      }),
    ).toContain('Error &lt;190&gt;');
    expect(
      formatTelegramMessage({
        type: 'poll_suspended',
        until: new Date('2026-10-15T13:00:00Z'),
        reason: '(#4) limit',
      }),
    ).toContain('Poll askıya alındı');
  });
});

describe('TelegramNotifier', () => {
  it('sends to every active chat and isolates a failing one', async () => {
    const tg = new FakeTelegram();
    tg.failFor.add('-100bad');
    const chats = new InMemoryChats([
      chat('1', '-100ok'),
      chat('2', '-100bad'),
      chat('3', '-100off', false),
    ]);
    await new TelegramNotifier(tg, chats, new FakeClock()).notify({ type: 'match', match });

    expect(tg.sent.map((s) => s.chatId)).toEqual(['-100ok']);
    expect(chats.results).toEqual({
      '1': null,
      '2': 'Forbidden: bot is not a member of the channel chat',
    });
  });

  it('does nothing without a bot token', async () => {
    const tg = new FakeTelegram(false);
    await new TelegramNotifier(
      tg,
      new InMemoryChats([chat('1', '-100ok')]),
      new FakeClock(),
    ).notify({
      type: 'match',
      match,
    });
    expect(tg.sent).toHaveLength(0);
  });
});

describe('CompositeNotifier', () => {
  it('never throws and still reaches the other notifiers', async () => {
    class Broken extends NotifierPort {
      async notify(): Promise<void> {
        throw new Error('boom');
      }
    }
    const recorder = new RecordingNotifier();
    await expect(
      new CompositeNotifier([new Broken(), recorder]).notify({ type: 'match', match }),
    ).resolves.toBeUndefined();
    expect(recorder.events).toHaveLength(1);
  });
});
