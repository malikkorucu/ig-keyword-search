import { createKeywordSchema } from '@igw/shared';
import { type FormEvent, useState } from 'react';
import { useToast } from '../components/toast';
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Input,
  Loading,
  PageHeader,
  Toggle,
} from '../components/ui';
import { formatDateTime } from '../lib/format';
import { useKeywordMutations, useKeywords } from '../lib/queries';

export function KeywordsPage() {
  const keywords = useKeywords();
  const m = useKeywordMutations();
  const toast = useToast();
  const [value, setValue] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const parsed = createKeywordSchema.safeParse({ value });
    if (!parsed.success) return setFormError(parsed.error.issues[0]?.message ?? 'Geçersiz');
    setFormError(null);
    m.create.mutate(parsed.data.value, {
      onSuccess: (k) => {
        setValue('');
        toast(`"${k.value}" eklendi`);
      },
      onError: (err) => setFormError(err.message),
    });
  };

  return (
    <>
      <PageHeader
        title="Anahtar kelimeler"
        description="Büyük/küçük harf ve Türkçe karakter duyarsız; ekli halleri (alanya'da, #alanya, alanyalı) de eşleşir."
      />
      <Card className="mb-4">
        <form onSubmit={add} className="flex flex-wrap items-start gap-2">
          <div className="min-w-56 flex-1">
            <Input
              placeholder="ör. alanya, kleopatra plajı"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {formError && <p className="mt-1 text-xs text-rose-600">{formError}</p>}
          </div>
          <Button
            type="submit"
            variant="primary"
            loading={m.create.isPending}
            disabled={!value.trim()}
          >
            Ekle
          </Button>
        </form>
      </Card>

      {keywords.isPending ? (
        <Loading />
      ) : keywords.error ? (
        <ErrorBox error={keywords.error} />
      ) : keywords.data.length === 0 ? (
        <Card>
          <EmptyState>Anahtar kelime yok — poll'lar eşleşme üretmez.</EmptyState>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {keywords.data.map((k) => (
              <li key={k.id} className="flex items-center gap-3 py-2.5">
                <Toggle
                  label="Aktif"
                  checked={k.active}
                  disabled={m.setActive.isPending}
                  onChange={(active) =>
                    m.setActive.mutate(
                      { id: k.id, active },
                      { onError: (e) => toast(e.message, 'error') },
                    )
                  }
                />
                <span
                  className={`font-medium ${k.active ? 'text-slate-900' : 'text-slate-400 line-through'}`}
                >
                  {k.value}
                </span>
                <span className="text-xs text-slate-400">{formatDateTime(k.createdAt)}</span>
                <Button
                  size="sm"
                  variant="danger"
                  className="ml-auto"
                  onClick={() => {
                    if (window.confirm(`"${k.value}" silinsin mi?`))
                      m.remove.mutate(k.id, { onError: (e) => toast(e.message, 'error') });
                  }}
                >
                  Sil
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
