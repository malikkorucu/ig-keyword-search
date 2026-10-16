import { createTelegramChatSchema, type DiscoveredTelegramChatDto } from '@igw/shared';
import { type FormEvent, useState } from 'react';
import { useToast } from '../components/toast';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Input,
  Label,
  Loading,
  PageHeader,
  Toggle,
} from '../components/ui';
import { formatDateTime, fromNow } from '../lib/format';
import { useTelegram, useTelegramMutations } from '../lib/queries';

const typeLabel: Record<string, string> = {
  channel: 'Kanal',
  group: 'Grup',
  supergroup: 'Grup',
  private: 'Kişi',
};

export function NotificationsPage() {
  const tg = useTelegram();
  const m = useTelegramMutations();
  const toast = useToast();
  const [chatId, setChatId] = useState('');
  const [label, setLabel] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredTelegramChatDto[] | null>(null);

  const add = (input: { chatId: string; label: string }, onDone?: () => void) => {
    const parsed = createTelegramChatSchema.safeParse(input);
    if (!parsed.success) return setFormError(parsed.error.issues[0]?.message ?? 'Geçersiz');
    setFormError(null);
    m.create.mutate(parsed.data, {
      onSuccess: (c) => {
        toast(`${c.label || c.chatId} eklendi`);
        setDiscovered(
          (d) => d?.map((x) => (x.chatId === c.chatId ? { ...x, alreadyAdded: true } : x)) ?? null,
        );
        onDone?.();
      },
      onError: (e) => setFormError(e.message),
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    add({ chatId, label }, () => {
      setChatId('');
      setLabel('');
    });
  };

  if (tg.isPending) return <Loading />;
  if (tg.error) return <ErrorBox error={tg.error} />;
  const status = tg.data;

  return (
    <>
      <PageHeader
        title="Bildirimler"
        description="Yeni eşleşmeler, token ve rate-limit uyarıları aktif Telegram sohbetlerine gönderilir."
      />

      <Card title="Telegram bot" className="mb-4">
        {!status.configured ? (
          <p className="text-sm text-slate-600">
            <Badge tone="amber">Kapalı</Badge> <code className="ml-1">TELEGRAM_BOT_TOKEN</code>{' '}
            tanımlı değil. @BotFather'dan aldığın token'ı <code>apps/api/.env</code>'e ekleyip API
            ve worker'ı yeniden başlat.
          </p>
        ) : status.botError ? (
          <p className="text-sm text-rose-700">
            <Badge tone="red">Hata</Badge> {status.botError}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge tone="green">Bağlı</Badge>
            <a
              className="font-medium text-indigo-600 hover:underline"
              href={`https://t.me/${status.botUsername}`}
              target="_blank"
              rel="noreferrer"
            >
              @{status.botUsername}
            </a>
            <span className="text-slate-500">
              Kanala eklemek için bot'u kanalda <b>yönetici</b> yap (mesaj gönderme izniyle), sonra
              kanala bir mesaj atıp "Chat bul"a bas.
            </span>
          </div>
        )}
      </Card>

      {status.configured && !status.botError && (
        <Card
          title="Chat bul"
          className="mb-4"
          actions={
            <Button
              size="sm"
              loading={m.discover.isPending}
              onClick={() =>
                m.discover.mutate(undefined, {
                  onSuccess: (list) => {
                    setDiscovered(list);
                    if (list.length === 0)
                      toast('Bot henüz hiçbir sohbetten mesaj almamış', 'info');
                  },
                  onError: (e) => toast(e.message, 'error'),
                })
              }
            >
              Chat bul
            </Button>
          }
        >
          {discovered === null ? (
            <p className="text-sm text-slate-500">
              Bot'a özelden <code>/start</code> yaz ya da bot'un yönetici olduğu kanala/gruba bir
              mesaj at, ardından "Chat bul"a bas. Telegram son 24 saatin mesajlarını tutar.
            </p>
          ) : discovered.length === 0 ? (
            <EmptyState>
              Sohbet bulunamadı. Bot'un ekli olduğu kanala yeni bir mesaj atıp tekrar dene.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {discovered.map((c) => (
                <li key={c.chatId} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <Badge tone="blue">{typeLabel[c.type] ?? c.type}</Badge>
                  <span className="font-medium">{c.title || '(isimsiz)'}</span>
                  <code className="text-xs text-slate-500">{c.chatId}</code>
                  <span className="ml-auto">
                    {c.alreadyAdded ? (
                      <Badge tone="green">Ekli</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={m.create.isPending}
                        onClick={() => add({ chatId: c.chatId, label: c.title })}
                      >
                        Ekle
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card title="Alıcı sohbetler" className="mb-4">
        <form
          onSubmit={submit}
          className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <label>
            <Label>Chat ID</Label>
            <Input
              placeholder="-1001234567890 veya @kanaladi"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
            />
          </label>
          <label>
            <Label hint="(opsiyonel)">Etiket</Label>
            <Input
              placeholder="ör. Ekip kanalı"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <Button
            type="submit"
            variant="primary"
            loading={m.create.isPending}
            disabled={!chatId.trim()}
          >
            Ekle
          </Button>
        </form>
        {formError && <p className="-mt-2 mb-3 text-xs text-rose-600">{formError}</p>}

        {status.chats.length === 0 ? (
          <EmptyState>Henüz alıcı yok — bildirimler sadece panelde ve logda görünür.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {status.chats.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <Toggle
                  label="Aktif"
                  checked={c.active}
                  disabled={m.setActive.isPending}
                  onChange={(active) =>
                    m.setActive.mutate(
                      { id: c.id, active },
                      { onError: (e) => toast(e.message, 'error') },
                    )
                  }
                />
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{c.label || c.chatId}</div>
                  <div className="text-xs text-slate-500">
                    <code>{c.chatId}</code> · eklendi {formatDateTime(c.createdAt)}
                    {c.lastSentAt && <> · son gönderim {fromNow(c.lastSentAt)}</>}
                  </div>
                  {c.lastError && (
                    <div className="mt-0.5 text-xs break-words text-rose-600">
                      Son hata: {c.lastError}
                    </div>
                  )}
                </div>
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    disabled={!status.configured}
                    loading={m.test.isPending && m.test.variables === c.id}
                    onClick={() =>
                      m.test.mutate(c.id, {
                        onSuccess: (r) => toast(r.message, r.ok ? 'success' : 'error'),
                        onError: (e) => toast(e.message, 'error'),
                      })
                    }
                  >
                    Test mesajı
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`${c.label || c.chatId} silinsin mi?`)) {
                        m.remove.mutate(c.id, { onError: (e) => toast(e.message, 'error') });
                      }
                    }}
                  >
                    Sil
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
