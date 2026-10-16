import { createAccountSchema } from '@igw/shared';
import { type FormEvent, useState } from 'react';
import { useToast } from '../components/toast';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Input,
  Loading,
  PageHeader,
  Toggle,
} from '../components/ui';
import { formatDateTime, fromNow } from '../lib/format';
import { useAccountMutations, useAccounts } from '../lib/queries';

export function AccountsPage() {
  const accounts = useAccounts();
  const m = useAccountMutations();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const parsed = createAccountSchema.safeParse({ username });
    if (!parsed.success) return setFormError(parsed.error.issues[0]?.message ?? 'Geçersiz');
    setFormError(null);
    m.create.mutate(parsed.data, {
      onSuccess: (a) => {
        setUsername('');
        toast(`@${a.username} eklendi`);
      },
      onError: (err) => setFormError(err.message),
    });
  };

  return (
    <>
      <PageHeader title="Hesaplar" description="Taranacak Instagram business/creator hesapları" />
      <Card className="mb-4">
        <form onSubmit={add} className="flex flex-wrap items-start gap-2">
          <div className="min-w-56 flex-1">
            <Input
              placeholder="kullanici_adi veya @kullanici_adi"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            {formError && <p className="mt-1 text-xs text-rose-600">{formError}</p>}
          </div>
          <Button
            type="submit"
            variant="primary"
            loading={m.create.isPending}
            disabled={!username.trim()}
          >
            Hesap ekle
          </Button>
        </form>
      </Card>

      {accounts.isPending ? (
        <Loading />
      ) : accounts.error ? (
        <ErrorBox error={accounts.error} />
      ) : accounts.data.length === 0 ? (
        <Card>
          <EmptyState>Henüz hesap yok.</EmptyState>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Hesap</th>
                <th className="px-4 py-2.5 font-medium">Aktif</th>
                <th className="px-4 py-2.5 font-medium">Erişim</th>
                <th className="px-4 py-2.5 font-medium">Son poll</th>
                <th className="px-4 py-2.5 font-medium">Son hata</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.data.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="px-4 py-3">
                    <a
                      href={`https://www.instagram.com/${a.username}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      @{a.username}
                    </a>
                    <div className="text-xs text-slate-400">
                      Eklendi {formatDateTime(a.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Toggle
                      label="Aktif"
                      checked={a.active}
                      disabled={m.setActive.isPending}
                      onChange={(active) =>
                        m.setActive.mutate(
                          { id: a.id, active },
                          { onError: (e) => toast(e.message, 'error') },
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    {a.accessible ? (
                      <Badge tone="green">Erişilebilir</Badge>
                    ) : (
                      <Badge tone="red">Erişilemez</Badge>
                    )}
                    {a.lastCheckedAt && (
                      <div className="mt-1 text-xs text-slate-400">
                        Kontrol: {fromNow(a.lastCheckedAt)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{fromNow(a.lastPolledAt)}</td>
                  <td className="max-w-xs px-4 py-3 text-xs break-words text-rose-600">
                    {a.inaccessibleReason ?? a.lastError ?? (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        loading={m.verify.isPending && m.verify.variables === a.id}
                        onClick={() =>
                          m.verify.mutate(a.id, {
                            onSuccess: (r) =>
                              toast(
                                r.accessible
                                  ? `@${a.username} erişilebilir`
                                  : `@${a.username}: ${r.message}`,
                                r.accessible ? 'success' : 'error',
                              ),
                            onError: (e) => toast(e.message, 'error'),
                          })
                        }
                      >
                        Şimdi doğrula
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          if (
                            window.confirm(`@${a.username} silinsin mi? Geçmiş eşleşmeler korunur.`)
                          ) {
                            m.remove.mutate(a.id, { onError: (e) => toast(e.message, 'error') });
                          }
                        }}
                      >
                        Sil
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
