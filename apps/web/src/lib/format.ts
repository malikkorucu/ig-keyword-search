import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('tr');

/** API dates are UTC ISO strings; shown in the browser's local time. */
export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dayjs(iso).format('DD.MM.YYYY HH:mm') : '—';
}

export function fromNow(iso: string | null | undefined): string {
  return iso ? dayjs(iso).fromNow() : '—';
}

export function duration(startIso: string, endIso: string | null): string {
  if (!endIso) return '…';
  const ms = dayjs(endIso).diff(dayjs(startIso));
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} sn`;
}
