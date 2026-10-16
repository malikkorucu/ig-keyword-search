import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { keys, useSession } from './lib/queries';
import { AccountsPage } from './pages/AccountsPage';
import { DashboardPage } from './pages/DashboardPage';
import { KeywordsPage } from './pages/KeywordsPage';
import { LoginPage } from './pages/LoginPage';
import { LogsPage } from './pages/LogsPage';
import { MatchesPage } from './pages/MatchesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'matches', element: <MatchesPage /> },
      { path: 'accounts', element: <AccountsPage /> },
      { path: 'keywords', element: <KeywordsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'logs', element: <LogsPage /> },
      { path: '*', element: <DashboardPage /> },
    ],
  },
]);

export function App() {
  const qc = useQueryClient();
  const session = useSession();

  useEffect(() => {
    const onUnauthorized = () => qc.setQueryData(keys.session, { authenticated: false });
    window.addEventListener('igw:unauthorized', onUnauthorized);
    return () => window.removeEventListener('igw:unauthorized', onUnauthorized);
  }, [qc]);

  if (session.isPending) return <Loading />;
  if (!session.data?.authenticated) return <LoginPage />;
  return <RouterProvider router={router} />;
}
