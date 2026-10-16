import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router';
import { api } from '../lib/api';
import { keys, useDashboard } from '../lib/queries';
import { cx } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/matches', label: 'Eşleşmeler' },
  { to: '/accounts', label: 'Hesaplar' },
  { to: '/keywords', label: 'Anahtar kelimeler' },
  { to: '/notifications', label: 'Bildirimler' },
  { to: '/settings', label: 'Ayarlar' },
  { to: '/logs', label: 'Loglar' },
];

export function Layout() {
  const qc = useQueryClient();
  const { data } = useDashboard();
  const logout = async () => {
    await api.post('/auth/logout');
    qc.setQueryData(keys.session, { authenticated: false });
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
  };

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span className="text-sm font-semibold text-slate-900">IG Keyword Watch</span>
          </div>
          <button
            onClick={logout}
            className="text-xs text-slate-500 hover:text-slate-800 md:hidden"
          >
            Çıkış
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'flex items-center justify-between rounded-lg px-3 py-2 text-sm whitespace-nowrap',
                  isActive
                    ? 'bg-indigo-50 font-medium text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100',
                )
              }
            >
              {item.label}
              {item.to === '/matches' && !!data?.newMatches && (
                <span className="ml-2 rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold text-white">
                  {data.newMatches}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-4 hidden px-4 md:block">
          <button onClick={logout} className="text-xs text-slate-500 hover:text-slate-800">
            Çıkış yap
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
        {data?.token.critical && (
          <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <strong>Token sorunu:</strong>{' '}
            {data.token.lastRefreshError ??
              `Token ${data.token.daysLeft ?? '?'} gün içinde sona eriyor.`}{' '}
            Ayarlar sayfasından yenileyin.
          </div>
        )}
        {data?.pollSuspendedUntil && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>Poll askıda</strong> —{' '}
            {new Date(data.pollSuspendedUntil).toLocaleString('tr-TR')} tarihine kadar.{' '}
            {data.pollSuspendReason}
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
