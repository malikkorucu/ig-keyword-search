import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { api } from '../lib/api';
import { keys } from '../lib/queries';
import { Button, Input } from '../components/ui';

export function LoginPage() {
  const qc = useQueryClient();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/login', { password });
      qc.setQueryData(keys.session, { authenticated: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div className="mb-6 flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-9 w-9" />
          <div>
            <h1 className="text-base font-semibold text-slate-900">IG Keyword Watch</h1>
            <p className="text-xs text-slate-500">Yönetim paneli</p>
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Parola</span>
          <Input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <Button
          type="submit"
          variant="primary"
          className="mt-5 w-full"
          loading={loading}
          disabled={!password}
        >
          Giriş yap
        </Button>
      </form>
    </div>
  );
}
