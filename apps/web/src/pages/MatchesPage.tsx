import {
  MATCH_SOURCES,
  MATCH_STATUSES,
  type MatchDto,
  type MatchesQuery,
  type MatchSource,
  type MatchStatus,
} from '@igw/shared';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { MatchSourceBadge, MatchStatusBadge, matchStatusLabel } from '../components/badges';
import { useToast } from '../components/toast';
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Input,
  Label,
  Loading,
  PageHeader,
  Pagination,
  Select,
} from '../components/ui';
import { formatDateTime } from '../lib/format';
import { useAccounts, useKeywords, useMatches, useUpdateMatchStatus } from '../lib/queries';

const sourceLabel: Record<MatchSource, string> = { text: 'Metin', image: 'Görsel (OCR)' };

/** `<input type="date">` value (local day) → UTC ISO bound. */
function dayBound(value: string, end: boolean): string | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00'}`);
  return d.toISOString();
}

export function MatchesPage() {
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) ?? '';
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const query: Partial<MatchesQuery> = {
    accountId: get('accountId') || undefined,
    keyword: get('keyword') || undefined,
    source: (get('source') || undefined) as MatchSource | undefined,
    status: (get('status') || undefined) as MatchStatus | undefined,
    from: dayBound(get('from'), false),
    to: dayBound(get('to'), true),
    page: Number(get('page') || 1),
    pageSize: 25,
  };

  const matches = useMatches(query);
  const accounts = useAccounts();
  const keywords = useKeywords();

  return (
    <>
      <PageHeader
        title="Eşleşmeler"
        description="Caption veya görselde anahtar kelime geçen postlar"
      />

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label>
            <Label>Hesap</Label>
            <Select value={get('accountId')} onChange={(e) => set('accountId', e.target.value)}>
              <option value="">Tümü</option>
              {accounts.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  @{a.username}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <Label>Anahtar kelime</Label>
            <Select value={get('keyword')} onChange={(e) => set('keyword', e.target.value)}>
              <option value="">Tümü</option>
              {keywords.data?.map((k) => (
                <option key={k.id} value={k.value}>
                  {k.value}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <Label>Kaynak</Label>
            <Select value={get('source')} onChange={(e) => set('source', e.target.value)}>
              <option value="">Tümü</option>
              {MATCH_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {sourceLabel[s]}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <Label>Durum</Label>
            <Select value={get('status')} onChange={(e) => set('status', e.target.value)}>
              <option value="">Tümü</option>
              {MATCH_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {matchStatusLabel[s]}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <Label>Başlangıç</Label>
            <Input type="date" value={get('from')} onChange={(e) => set('from', e.target.value)} />
          </label>
          <label>
            <Label>Bitiş</Label>
            <Input type="date" value={get('to')} onChange={(e) => set('to', e.target.value)} />
          </label>
        </div>
      </Card>

      {matches.isPending ? (
        <Loading />
      ) : matches.error ? (
        <ErrorBox error={matches.error} />
      ) : matches.data.items.length === 0 ? (
        <Card>
          <EmptyState>Filtreye uyan eşleşme yok.</EmptyState>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {matches.data.items.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </div>
          <Pagination
            page={matches.data.page}
            pageSize={matches.data.pageSize}
            total={matches.data.total}
            onChange={(p) => set('page', String(p))}
          />
        </>
      )}
    </>
  );
}

function MatchRow({ match: m }: { match: MatchDto }) {
  const update = useUpdateMatchStatus();
  const toast = useToast();
  const [showOcr, setShowOcr] = useState(false);
  const setStatus = (status: MatchStatus) =>
    update.mutate({ id: m.id, status }, { onError: (e) => toast(e.message, 'error') });

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm ${m.status === 'new' ? 'border-indigo-200' : 'border-slate-200 opacity-80'}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-900">@{m.username}</span>
        <MatchSourceBadge source={m.source} />
        <MatchStatusBadge status={m.status} />
        {m.keywords.map((k) => (
          <span
            key={k}
            className="rounded bg-yellow-100 px-1.5 text-xs font-medium text-yellow-900"
          >
            {k}
          </span>
        ))}
        <span className="ml-auto text-xs text-slate-500" title="Tespit zamanı">
          Post: {formatDateTime(m.postedAt)} · Tespit: {formatDateTime(m.detectedAt)}
        </span>
      </div>
      <p className="mt-2 text-sm whitespace-pre-line text-slate-700">{m.snippet}</p>
      {m.ocrText && (
        <div className="mt-2">
          <button
            className="text-xs text-indigo-600 hover:underline"
            onClick={() => setShowOcr((v) => !v)}
          >
            {showOcr ? 'OCR metnini gizle' : 'OCR metnini göster'}
          </button>
          {showOcr && (
            <pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-slate-50 p-3 font-mono text-xs whitespace-pre-wrap text-slate-700">
              {m.ocrText}
            </pre>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={m.permalink}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          Instagram'da aç ↗
        </a>
        <div className="ml-auto flex gap-2">
          {m.status !== 'seen' && (
            <Button size="sm" onClick={() => setStatus('seen')} disabled={update.isPending}>
              Görüldü
            </Button>
          )}
          {m.status !== 'dismissed' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setStatus('dismissed')}
              disabled={update.isPending}
            >
              Yok say
            </Button>
          )}
          {m.status !== 'new' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setStatus('new')}
              disabled={update.isPending}
            >
              Yeni yap
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
