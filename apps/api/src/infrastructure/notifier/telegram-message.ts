import type { NotifierEvent } from '../../application/ports';

const SNIPPET_MAX = 600;
const OCR_MAX = 400;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function istanbulTime(date: Date): string {
  return date.toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/** Telegram HTML message for a notifier event (parse_mode=HTML). */
export function formatTelegramMessage(event: NotifierEvent): string {
  switch (event.type) {
    case 'match': {
      const m = event.match;
      const lines = [
        `🔔 <b>Yeni eşleşme</b> — <b>@${escapeHtml(m.username)}</b>`,
        `🏷 ${m.keywords.map((k) => `<code>${escapeHtml(k)}</code>`).join(', ')} · ${m.source === 'text' ? 'Caption' : 'Görsel (OCR)'}`,
        '',
        `<i>${escapeHtml(truncate(m.snippet, SNIPPET_MAX))}</i>`,
      ];
      if (m.source === 'image' && m.ocrText) {
        lines.push('', `<b>OCR:</b> <pre>${escapeHtml(truncate(m.ocrText, OCR_MAX))}</pre>`);
      }
      lines.push(
        '',
        `🕒 Post: ${istanbulTime(m.postedAt)}`,
        `<a href="${escapeHtml(m.permalink)}">Instagram'da aç ↗</a>`,
      );
      return lines.join('\n');
    }
    case 'token_refresh_failed':
      return [
        '⚠️ <b>Instagram token yenilenemedi</b>',
        escapeHtml(truncate(event.error, 500)),
        `Bitiş: ${event.expiresAt ? istanbulTime(event.expiresAt) : 'bilinmiyor'}`,
        'Panel → Ayarlar → "Şimdi yenile" ya da yeni token girin.',
      ].join('\n');
    case 'poll_suspended':
      return [
        '⏸ <b>Poll askıya alındı</b>',
        escapeHtml(truncate(event.reason, 500)),
        `${istanbulTime(event.until)} tarihine kadar.`,
      ].join('\n');
  }
}
