import type { PollRunDto } from '@igw/shared';
import { useState } from 'react';
import { PollRunStatusBadge } from '../components/badges';
import { Card, EmptyState, ErrorBox, Loading, PageHeader, Pagination } from '../components/ui';
import { duration, formatDateTime } from '../lib/format';
import { usePollRuns } from '../lib/queries';

export function LogsPage() {
  const [page, setPage] = useState(1);
  const runs = usePollRuns(page);

  return (
    <>
      <PageHeader title="Loglar" description="Poll geçmişi ve hata detayları" />
      {runs.isPending ? (
        <Loading />
      ) : runs.error ? (
        <ErrorBox error={runs.error} />
      ) : runs.data.items.length === 0 ? (
        <Card>
          <EmptyState>Henüz poll yok.</EmptyState>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Başlangıç</th>
                  <th className="px-4 py-2.5 font-medium">Süre</th>
                  <th className="px-4 py-2.5 font-medium">Tetik</th>
                  <th className="px-4 py-2.5 font-medium">Durum</th>
                  <th className="px-4 py-2.5 font-medium">Hesap</th>
                  <th className="px-4 py-2.5 font-medium">Post (yeni)</th>
                  <th className="px-4 py-2.5 font-medium">Eşleşme</th>
                  <th className="px-4 py-2.5 font-medium">OCR job</th>
                  <th className="px-4 py-2.5 font-medium">Hata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.data.items.map((r) => (
                  <RunRow key={r.id} run={r} />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={runs.data.page}
            pageSize={runs.data.pageSize}
            total={runs.data.total}
            onChange={setPage}
          />
        </>
      )}
    </>
  );
}

function RunRow({ run: r }: { run: PollRunDto }) {
  const [open, setOpen] = useState(false);
  const expandable = r.errorCount > 0 || !!r.note;
  return (
    <>
      <tr
        className={expandable ? 'cursor-pointer hover:bg-slate-50' : ''}
        onClick={() => expandable && setOpen((v) => !v)}
      >
        <td className="px-4 py-2.5 whitespace-nowrap">
          {expandable && (
            <span className="mr-1 inline-block w-3 text-slate-400">{open ? '▾' : '▸'}</span>
          )}
          {formatDateTime(r.startedAt)}
        </td>
        <td className="px-4 py-2.5 text-slate-500">{duration(r.startedAt, r.finishedAt)}</td>
        <td className="px-4 py-2.5 text-slate-500">
          {r.trigger === 'manual' ? 'Manuel' : 'Zamanlı'}
        </td>
        <td className="px-4 py-2.5">
          <PollRunStatusBadge status={r.status} />
        </td>
        <td className="px-4 py-2.5">{r.accountsScanned}</td>
        <td className="px-4 py-2.5">
          {r.postsScanned} ({r.newPosts})
        </td>
        <td className="px-4 py-2.5">{r.matchesFound}</td>
        <td className="px-4 py-2.5">{r.ocrJobsEnqueued}</td>
        <td className={`px-4 py-2.5 ${r.errorCount ? 'font-medium text-rose-600' : ''}`}>
          {r.errorCount}
        </td>
      </tr>
      {open && (
        <tr className="bg-slate-50">
          <td colSpan={9} className="px-6 py-3">
            {r.note && (
              <p className="mb-2 text-sm text-slate-700">
                <strong>Not:</strong> {r.note}
              </p>
            )}
            {r.errors.length > 0 && (
              <ul className="space-y-1 text-xs">
                {r.errors.map((e, i) => (
                  <li key={i} className="flex flex-wrap gap-2">
                    {e.username && <span className="font-medium">@{e.username}</span>}
                    {e.postId && <span className="text-slate-500">post {e.postId}</span>}
                    <span className="rounded bg-white px-1.5 text-slate-600 ring-1 ring-slate-200">
                      {e.kind}
                      {e.code ? ` #${e.code}` : ''}
                    </span>
                    <span className="break-words text-slate-700">{e.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
