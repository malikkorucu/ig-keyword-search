import { type SettingsDto, updateSettingsSchema } from '@igw/shared';
import { type ChangeEvent, type FormEvent, useState } from 'react';
import { useToast } from '../components/toast';
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Input,
  Label,
  Loading,
  PageHeader,
  Toggle,
} from '../components/ui';
import { formatDateTime, fromNow } from '../lib/format';
import { useSettings, useSettingsMutations } from '../lib/queries';

type FormState = Pick<
  SettingsDto,
  | 'pollIntervalMinutes'
  | 'mediaLimit'
  | 'ocrEnabled'
  | 'tokenRefreshThresholdDays'
  | 'rateLimitPauseMinutes'
>;

export function SettingsPage() {
  const { data, error, isPending } = useSettings();
  if (isPending) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  // Remount the form when the server copy changes so it never shows stale values.
  return <SettingsView key={data.settings.updatedAt} data={data} />;
}

function SettingsView({ data }: { data: NonNullable<ReturnType<typeof useSettings>['data']> }) {
  const m = useSettingsMutations();
  const toast = useToast();
  const s = data.settings;
  const token = data.token;
  const [form, setForm] = useState<FormState>({
    pollIntervalMinutes: s.pollIntervalMinutes,
    mediaLimit: s.mediaLimit,
    ocrEnabled: s.ocrEnabled,
    tokenRefreshThresholdDays: s.tokenRefreshThresholdDays,
    rateLimitPauseMinutes: s.rateLimitPauseMinutes,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const dirty = (Object.keys(form) as Array<keyof FormState>).some((k) => form[k] !== s[k]);

  const save = (e: FormEvent) => {
    e.preventDefault();
    const parsed = updateSettingsSchema.safeParse(form);
    if (!parsed.success)
      return setFormError(
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
      );
    setFormError(null);
    m.update.mutate(parsed.data, {
      onSuccess: () => toast("Ayarlar kaydedildi — bir sonraki poll'da geçerli"),
      onError: (err) => setFormError(err.message),
    });
  };

  const num = (k: keyof FormState) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value === '' ? NaN : Number(e.target.value) }));

  return (
    <>
      <PageHeader title="Ayarlar" description="Değişiklikler restart gerektirmez." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Poll">
          <form onSubmit={save} className="space-y-4">
            <label className="block">
              <Label hint="(dakika)">Poll aralığı</Label>
              <Input
                type="number"
                min={1}
                max={1440}
                value={Number.isNaN(form.pollIntervalMinutes) ? '' : form.pollIntervalMinutes}
                onChange={num('pollIntervalMinutes')}
              />
            </label>
            <label className="block">
              <Label hint="(hesap başına son N post)">Medya limiti</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={Number.isNaN(form.mediaLimit) ? '' : form.mediaLimit}
                onChange={num('mediaLimit')}
              />
            </label>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-700">Görsel OCR</div>
                <div className="text-xs text-slate-500">
                  Caption eşleşmezse görseldeki yazı taranır
                </div>
              </div>
              <Toggle
                label="OCR"
                checked={form.ocrEnabled}
                onChange={(v) => setForm((f) => ({ ...f, ocrEnabled: v }))}
              />
            </div>
            <label className="block">
              <Label hint="(dakika)">Rate limit (#4) sonrası bekleme</Label>
              <Input
                type="number"
                min={1}
                max={1440}
                value={Number.isNaN(form.rateLimitPauseMinutes) ? '' : form.rateLimitPauseMinutes}
                onChange={num('rateLimitPauseMinutes')}
              />
            </label>
            <label className="block">
              <Label hint="(bu kadar günden az kalınca)">Token yenileme eşiği</Label>
              <Input
                type="number"
                min={1}
                max={59}
                value={
                  Number.isNaN(form.tokenRefreshThresholdDays) ? '' : form.tokenRefreshThresholdDays
                }
                onChange={num('tokenRefreshThresholdDays')}
              />
            </label>
            {formError && <p className="text-xs text-rose-600">{formError}</p>}
            <div className="flex items-center justify-between gap-2 pt-2">
              <span className="text-xs text-slate-400">
                Son güncelleme: {formatDateTime(s.updatedAt)}
              </span>
              <Button
                type="submit"
                variant="primary"
                disabled={!dirty}
                loading={m.update.isPending}
              >
                Kaydet
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <Card title="Çalıştırma">
            <dl className="mb-4 grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-slate-500">Sonraki poll</dt>
              <dd>
                {data.nextPollAt
                  ? `${formatDateTime(data.nextPollAt)} (${fromNow(data.nextPollAt)})`
                  : '—'}
              </dd>
              <dt className="text-slate-500">Askı</dt>
              <dd>
                {s.pollSuspendedUntil && new Date(s.pollSuspendedUntil) > new Date() ? (
                  <Badge tone="amber">{formatDateTime(s.pollSuspendedUntil)} tarihine kadar</Badge>
                ) : (
                  <Badge tone="green">Yok</Badge>
                )}
              </dd>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                loading={m.runPoll.isPending}
                onClick={() =>
                  m.runPoll.mutate(undefined, {
                    onSuccess: (r) => toast(r.message, r.enqueued ? 'success' : 'info'),
                    onError: (e) => toast(e.message, 'error'),
                  })
                }
              >
                Şimdi poll çalıştır
              </Button>
              {s.pollSuspendedUntil && new Date(s.pollSuspendedUntil) > new Date() && (
                <Button
                  loading={m.resume.isPending}
                  onClick={() =>
                    m.resume.mutate(undefined, {
                      onSuccess: () => toast('Askı kaldırıldı'),
                      onError: (e) => toast(e.message, 'error'),
                    })
                  }
                >
                  Askıyı kaldır
                </Button>
              )}
            </div>
          </Card>

          <Card title="Access token" className={token.critical ? 'border-rose-300' : undefined}>
            <dl className="mb-4 grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-slate-500">Durum</dt>
              <dd>
                {token.critical ? (
                  <Badge tone="red">Dikkat gerekiyor</Badge>
                ) : (
                  <Badge tone="green">Sağlıklı</Badge>
                )}
              </dd>
              <dt className="text-slate-500">Kalan gün</dt>
              <dd className={token.critical ? 'font-semibold text-rose-600' : ''}>
                {token.daysLeft ?? 'bilinmiyor'}
              </dd>
              <dt className="text-slate-500">Bitiş</dt>
              <dd>{formatDateTime(token.expiresAt)}</dd>
              <dt className="text-slate-500">Son yenileme</dt>
              <dd>{formatDateTime(token.lastRefreshedAt)}</dd>
              <dt className="text-slate-500">Son deneme</dt>
              <dd>{formatDateTime(token.lastRefreshAttemptAt)}</dd>
            </dl>
            {token.lastRefreshError && (
              <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs break-words text-rose-700">
                {token.lastRefreshError}
              </p>
            )}
            <Button
              loading={m.refreshToken.isPending}
              onClick={() =>
                m.refreshToken.mutate(undefined, {
                  onSuccess: (r) => toast(r.message, r.refreshed ? 'success' : 'error'),
                  onError: (e) => toast(e.message, 'error'),
                })
              }
            >
              Şimdi yenile
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}
