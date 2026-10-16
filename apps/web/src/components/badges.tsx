import type { MatchSource, MatchStatus, PollRunStatus } from '@igw/shared';
import { Badge } from './ui';

const runTone = {
  running: 'blue',
  success: 'green',
  partial: 'amber',
  failed: 'red',
  skipped: 'gray',
} as const;
const runLabel: Record<PollRunStatus, string> = {
  running: 'Çalışıyor',
  success: 'Başarılı',
  partial: 'Kısmi hata',
  failed: 'Başarısız',
  skipped: 'Atlandı',
};
export const PollRunStatusBadge = ({ status }: { status: PollRunStatus }) => (
  <Badge tone={runTone[status]}>{runLabel[status]}</Badge>
);

export const MatchSourceBadge = ({ source }: { source: MatchSource }) =>
  source === 'text' ? <Badge tone="indigo">Metin</Badge> : <Badge tone="blue">Görsel (OCR)</Badge>;

const statusTone = { new: 'green', seen: 'gray', dismissed: 'gray' } as const;
export const matchStatusLabel: Record<MatchStatus, string> = {
  new: 'Yeni',
  seen: 'Görüldü',
  dismissed: 'Yok sayıldı',
};
export const MatchStatusBadge = ({ status }: { status: MatchStatus }) => (
  <Badge tone={statusTone[status]}>{matchStatusLabel[status]}</Badge>
);
