import { Link } from 'react-router';
import { PollRunStatusBadge } from '../components/badges';
import { useToast } from '../components/toast';
import { Button, Card, EmptyState, ErrorBox, Loading, PageHeader, Stat } from '../components/ui';
import { formatDateTime, fromNow } from '../lib/format';
import { useDashboard, useSettingsMutations } from '../lib/queries';

export function DashboardPage() {
  const { data, error, isPending } = useDashboard();
  const { runPoll } = useSettingsMutations();
  const toast = useToast();

  if (isPending) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const run = data.lastRun;
  const token = data.token;
  const queueFailed = data.queues.reduce((n, q) => n + q.failed, 0);
  const queueWaiting = data.queues.reduce((n, q) => n + q.waiting + q.active + q.delayed, 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Sistem durumu (15 sn'de bir yenilenir)"
        actions={
          <Button
            variant="primary"
            loading={runPoll.isPending}
            onClick={() =>
              runPoll.mutate(undefined, {
                onSuccess: (r) => toast(r.message, r.enqueued ? 'success' : 'info'),
                onError: (e) => toast(e.message, 'error'),
              })
            }
          >
            Şimdi poll çalıştır
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Son poll"
          value={run ? fromNow(run.startedAt) : '—'}
          hint={run ? <PollRunStatusBadge status={run.status} /> : 'Henüz çalışmadı'}
          tone={run?.status === 'failed' ? 'red' : run?.status === 'partial' ? 'amber' : undefined}
        />
        <Stat
          label="Sonraki poll"
          value={
            data.pollSuspendedUntil ? 'Askıda' : data.nextPollAt ? fromNow(data.nextPollAt) : '—'
          }
          hint={formatDateTime(data.pollSuspendedUntil ?? data.nextPollAt)}
          tone={data.pollSuspendedUntil ? 'amber' : undefined}
        />
        <Stat
          label="Token kalan gün"
          value={token.daysLeft ?? '?'}
          hint={
            token.lastRefreshError
              ? 'Son yenileme başarısız'
              : `Bitiş: ${formatDateTime(token.expiresAt)}`
          }
          tone={token.critical ? 'red' : undefined}
        />
        <Stat
          label="Aktif hesap"
          value={data.activeAccounts}
          hint={
            data.inaccessibleAccounts
              ? `${data.inaccessibleAccounts} erişilemez`
              : 'Hepsi erişilebilir'
          }
          tone={data.inaccessibleAccounts ? 'amber' : undefined}
        />
        <Stat
          label="Son 24 saat eşleşme"
          value={data.matchesLast24h}
          hint={
            <Link className="text-indigo-600 hover:underline" to="/matches?status=new">
              {data.newMatches} yeni →
            </Link>
          }
        />
        <Stat
          label="Kuyruk"
          value={`${queueWaiting} bekleyen`}
          hint={`${queueFailed} başarısız job`}
          tone={queueFailed ? 'amber' : undefined}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card
          title="Son poll"
          actions={
            <Link to="/logs" className="text-xs text-indigo-600 hover:underline">
              Tüm loglar →
            </Link>
          }
        >
          {run ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">Durum</dt>
              <dd>
                <PollRunStatusBadge status={run.status} />
              </dd>
              <dt className="text-slate-500">Başlangıç</dt>
              <dd>{formatDateTime(run.startedAt)}</dd>
              <dt className="text-slate-500">Taranan hesap / post</dt>
              <dd>
                {run.accountsScanned} / {run.postsScanned}
              </dd>
              <dt className="text-slate-500">Yeni post</dt>
              <dd>{run.newPosts}</dd>
              <dt className="text-slate-500">Eşleşme (metin) / OCR job</dt>
              <dd>
                {run.matchesFound} / {run.ocrJobsEnqueued}
              </dd>
              <dt className="text-slate-500">Hata</dt>
              <dd className={run.errorCount ? 'font-medium text-rose-600' : ''}>
                {run.errorCount}
              </dd>
              {run.note && (
                <>
                  <dt className="text-slate-500">Not</dt>
                  <dd>{run.note}</dd>
                </>
              )}
            </dl>
          ) : (
            <EmptyState>Henüz poll çalışmadı.</EmptyState>
          )}
        </Card>

        <Card title="Kuyruklar">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="pb-2 font-medium">Kuyruk</th>
                <th className="pb-2 font-medium">Bekleyen</th>
                <th className="pb-2 font-medium">Aktif</th>
                <th className="pb-2 font-medium">Gecikmeli</th>
                <th className="pb-2 font-medium">Başarısız</th>
              </tr>
            </thead>
            <tbody>
              {data.queues.map((q) => (
                <tr key={q.name} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{q.name}</td>
                  <td>{q.waiting}</td>
                  <td>{q.active}</td>
                  <td>{q.delayed}</td>
                  <td className={q.failed ? 'font-medium text-rose-600' : ''}>{q.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.queues.length === 0 && <EmptyState>Redis'e ulaşılamadı.</EmptyState>}
        </Card>

        <Card title="Son hatalar" className="lg:col-span-2">
          {data.recentErrors.length === 0 ? (
            <EmptyState>Hata yok 🎉</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {data.recentErrors.map((e, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
                  <span className="w-32 shrink-0 text-xs text-slate-500">
                    {formatDateTime(e.at)}
                  </span>
                  {e.username && <span className="font-medium">@{e.username}</span>}
                  <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-600">
                    {e.kind}
                    {e.code ? ` #${e.code}` : ''}
                  </span>
                  <span className="min-w-0 flex-1 break-words text-slate-700">{e.message}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
