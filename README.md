# IG Keyword Watch

Belirli Instagram hesaplarını periyodik tarayıp yeni postların **caption**'ında ya da **görsellerinde** (OCR) anahtar kelime geçip geçmediğini tespit eden, eşleşmeleri bildirim katmanına ileten NestJS servisi + React yönetim paneli.

Tüm iş kuralları (anahtar kelimeler, hesaplar, poll aralığı, medya limiti, OCR, token yenileme eşiği, rate-limit bekleme süresi) DB'de tutulur ve panelden değiştirilir; değişiklikler restart gerektirmeden bir sonraki poll'da geçerli olur.

İlk kurulum seed'i (migration içinde): keyword `alanya`, poll aralığı 15 dk, medya limiti 5, OCR açık, token eşiği 10 gün, rate-limit beklemesi 60 dk.

## Mimari

```
apps/api        NestJS — iki entrypoint: main.ts (HTTP + scheduler), worker.ts (BullMQ worker'ları)
apps/web        React 19 + Vite + Tailwind 4 panel
packages/shared Panel ve API'nin ortak tipleri + zod şemaları
```

```
            ┌──────────── api process ─────────────┐        ┌──────────── worker process ────────────┐
 cron ────► │ PollSchedulerService (DB'den aralık) │──poll──► RunPollUseCase                          │
 panel ───► │ REST /api/*  (session cookie)        │  queue │   business_discovery → dedupe → metin   │
            │ TokenCheckService (günlük 03:00 UTC) │        │   eşleşmezse ──ocr job──►  ProcessOcr   │
            └──────────────────────────────────────┘        │                 (ayrı worker, 3 retry)  │
                          │                                 └──────────────────────────────────────────┘
                     PostgreSQL ◄──────────────────────────────────────── Redis (BullMQ)
```

`src/` katmanları (port-adapter):

- `domain/` — saf mantık: Türkçe normalize + keyword eşleştirici, medya→görsel URL çıkarımı, Graph hata sınıflandırma
- `application/ports` — `InstagramPort`, `OcrPort`, `ClassifierPort`, `NotifierPort`, `JobQueuePort`, `ClockPort`, repository port'ları
- `application/use-cases` — `RunPoll`, `ProcessOcr`, `RecordMatch` (classifier → kaydet → bildir), `RefreshToken`, `BootstrapToken`, `VerifyAccount`. Use-case'ler sadece port görür, Nest'e bağımlı değildir.
- `infrastructure/` — adapter'lar: Graph API (`fetch`), tesseract.js + sharp, pass-through classifier, console notifier, TypeORM repository'leri, BullMQ, scheduler
- `http/` — controller'lar (zod validation `packages/shared` şemalarıyla)

### Akış

1. Cron (api) sadece `poll` job'ı enqueue eder. Aynı anda kuyrukta bekleyen poll varsa yenisi eklenmez.
2. Poll worker aktif + erişilebilir her hesap için son N medyayı `business_discovery` ile çeker.
3. `processed_posts`'ta olan postlar atlanır.
4. Caption `toLocaleLowerCase('tr')` ile normalize edilip aktif keyword'lerle karşılaştırılır. Keyword kelime başında başlamalı, sonrası serbest: `#alanya`, `alanya'da`, `Alanya’dan`, `alanyalı`, `#AlanyaBeach` eşleşir; `kalanya` eşleşmez. Çok kelimeli keyword'ler desteklenir.
5. Eşleşmezse ve OCR açıksa post başına bir OCR job (`jobId = ocr-<postId>`) kuyruğa girer. Görseller: carousel → her child (video child → thumbnail), video → `thumbnail_url`, foto → `media_url`. Görseller bellekte indirilir, sharp ile ön işlenir (grayscale, büyütme, normalize) ve Tesseract (`tur+eng`) ile okunur; hiçbiri saklanmaz.
6. Eşleşme varsa classifier (şimdilik pass-through) → `matches` (status `new`) → `NotifierPort.notify()` (console).
7. Her post `processed_posts`'a yazılır (OCR için `pending` → `done` / `failed`); her poll `poll_runs`'a loglanır.

### Hata yönetimi

| Durum                                                 | Davranış                                                                                                                                                                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Graph `#4` (ve `#17/#32/#613`) rate limit             | Poll durur, ayarlardaki süre kadar (varsayılan 60 dk) askıya alınır, notifier uyarır, dashboard'da sarı banner. Askıdayken gelen poll'lar `skipped` loglanır. Panelden "Askıyı kaldır" ile erken bitirilebilir.               |
| `#100` / `#110` (business değil, private, bulunamadı) | Hesap `accessible=false`, sebep kaydedilir, sonraki poll'larda atlanır. "Şimdi doğrula" ile tekrar kontrol edilir.                                                                                                            |
| Diğer hesap hataları (ağ, token…)                     | Hesabın `last_error`'ına yazılır, diğer hesaplar devam eder.                                                                                                                                                                  |
| Tek post hatası                                       | O post `processed`'a yazılmaz (bir sonraki poll'da tekrar denenir), diğerleri devam eder.                                                                                                                                     |
| OCR                                                   | 3 deneme, exponential backoff (30 sn, 60 sn…). Görsellerin bir kısmı başarısızsa kalanlarla devam edilir; hepsi başarısızsa retry. Denemeler biterse post `ocr_status=failed`.                                                |
| Token                                                 | Günlük kontrol: kalan süre eşikten (10 gün) azsa `fb_exchange_token` ile yenilenip DB'ye yazılır. Başarısızsa notifier uyarır, dashboard kırmızı. İlk değer `IG_ACCESS_TOKEN`'dan alınır, süresi `debug_token` ile öğrenilir. |

Tüm tarihler DB'de `timestamptz`, bağlantı `timezone=UTC`, API'de ISO-8601 UTC. Panel tarayıcının yerel saatinde gösterir.

## Meta / Instagram kurulumu

1. **Business hesap:** Tarama yapacak kendi Instagram hesabını _Professional → Business_ (veya Creator) yap ve bir **Facebook Sayfası**'na bağla (Instagram → Ayarlar → Hesap merkezi / Sayfa bağlantısı).
2. **Meta app:** <https://developers.facebook.com/apps> → _Create app_ → tür **Business**. _App settings → Basic_'ten **App ID** (`FB_APP_ID`) ve **App Secret** (`FB_APP_SECRET`) al.
3. App'e **Instagram Graph API** (Facebook Login ile Instagram API) ürününü ekle.
4. **Kısa ömürlü user token:** [Graph API Explorer](https://developers.facebook.com/tools/explorer/)'da app'ini seç, şu izinlerle _Generate Access Token_: `instagram_basic`, `pages_show_list`, `pages_read_engagement`, `business_management`.
   App _Development_ modundaysa token'ı alan kişinin app'te admin/developer/tester rolü olmalı. Kendi hesabın için bu yeterli; App Review gerekmez.
5. **Long-lived token'a çevir (60 gün):**
   ```bash
   curl "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=$FB_APP_ID&client_secret=$FB_APP_SECRET&fb_exchange_token=$SHORT_TOKEN"
   ```
   Dönen `access_token` → `IG_ACCESS_TOKEN`.
6. **IG_USER_ID:**
   ```bash
   curl "https://graph.facebook.com/v21.0/me/accounts?fields=name,instagram_business_account&access_token=$IG_ACCESS_TOKEN"
   ```
   Sayfanın `instagram_business_account.id` değeri → `IG_USER_ID`.
7. Test:
   ```bash
   curl "https://graph.facebook.com/v21.0/$IG_USER_ID?fields=business_discovery.username(instagram){media.limit(1){id,caption}}&access_token=$IG_ACCESS_TOKEN"
   ```

> `business_discovery` sadece **public business/creator** hesapları okuyabilir. Kişisel ya da private hesaplar `#100` döner ve panelde "Erişilemez" görünür.
>
> Not: Meta, long-lived user token'ları `fb_exchange_token` ile her zaman uzatmayabilir. Yenileme başarısız olursa dashboard kırmızıya döner. O zaman 4–5. adımlarla yeni bir token alıp `IG_ACCESS_TOKEN`'ı güncelle ve DB'deki kopyayı sıfırla (`DELETE FROM api_token;`, sonra api'yi restart et) ya da "Şimdi yenile"yi dene. Daha kalıcı bir çözüm için bir System User token'ı (Business Manager) kullanılabilir.

## Lokal çalıştırma

Gereksinimler: Node 20+, pnpm 9 (`corepack enable`), PostgreSQL 17, Redis 7.

```bash
pnpm install
cp .env.example apps/api/.env      # değerleri doldur
# Postgres 17 + Redis 7'yi Docker'da aç (5433 / 6380; şifreler .env.infra'da, gitignored):
docker compose -f docker-compose.dev.yml --env-file .env.infra up -d
pnpm build:shared                  # api ve web @igw/shared'in derlenmiş halini kullanır

pnpm dev:api      # :3000 — açılışta migration'ları çalıştırır (seed dahil)
pnpm dev:worker   # poll + OCR worker'ları
pnpm dev:web      # :5173 — /api'yi localhost:3000'e proxy'ler (VITE_API_PROXY ile değiştirilebilir)
```

Panel: <http://localhost:5173>, parola `PANEL_PASSWORD`.

İlk OCR job'ında tesseract.js `tur` + `eng` traineddata dosyalarını indirir ve `TESSERACT_CACHE_DIR`'e kaydeder (Docker imajında build sırasında hazır gelir).

### Komutlar

```bash
pnpm test          # Jest unit testleri (apps/api)
pnpm lint          # eslint (tüm repo)
pnpm format        # prettier
pnpm typecheck
pnpm --filter @igw/api migration:run                                         # migration'ları elle çalıştır
pnpm --filter @igw/api migration:generate src/infrastructure/persistence/migrations/<Name>   # entity değişikliğinden migration
```

Yeni migration: dosyayı `src/infrastructure/persistence/migrations/index.ts`'teki `MIGRATIONS` listesine ekle (glob kullanılmıyor).

## Docker Compose / Coolify

Tek `Dockerfile`, iki target: `api` (worker aynı imajı `node dist/worker.js` ile kullanır) ve `web` (nginx: statik panel + `/api` reverse proxy). Postgres ve Redis compose'a dahil değil; `DATABASE_URL` / `REDIS_URL` ile dışarıdan verilir. Tesseract `tur+eng` dil dosyaları build sırasında imaja gömülür (runtime'da internet gerekmez).

| Servis   | Görev                                    | Erişim                                 |
| -------- | ---------------------------------------- | -------------------------------------- |
| `api`    | HTTP API + scheduler, açılışta migration | Sadece compose ağı içinde (`api:3000`) |
| `worker` | Poll + OCR worker'ları                   | Dışarı açık değil                      |
| `web`    | nginx: panel + `/api` proxy              | `${WEB_BIND}:${WEB_PORT}` → 80         |

### Coolify'a deploy (imajlar GitHub Actions'ta build edilir)

Sunucuda build yapılmaz. `main`'e her push'ta `.github/workflows/release.yml`: test + lint → `linux/amd64` imajları build → `ghcr.io/malikkorucu/ig-keyword-watch-{api,web}` (`latest` + kısa SHA tag'i) → (opsiyonel) Coolify deploy webhook'u. Coolify `docker-compose.prod.yml` ile sadece hazır imajları çeker.

1. **İmajlar public:** repo ve GHCR paketleri public olduğu için sunucuda `docker login` gerekmez. (Paketleri private'a çevirirsen sunucuda `read:packages` yetkili bir token ile `docker login ghcr.io -u malikkorucu` yap.)
2. **Veritabanları** (sunucuda zaten varsa atla): Coolify → **+ New → Database → PostgreSQL** ve **Redis**; internal URL'leri kopyala.
3. **Uygulama:** **+ New → Public Repository** → `https://github.com/malikkorucu/ig-keyword-search` → **Build Pack: Docker Compose**, **Docker Compose Location: `/docker-compose.prod.yml`**, Base Directory `/`.
4. **Settings:** **Connect To Predefined Network**'ü aç. **Auto Deploy**'u kapat (push anında imajlar henüz hazır değildir; deploy'u workflow tetikler).
5. **Environment Variables:**

   | Değişken                        | Değer                                                                                                  |
   | ------------------------------- | ------------------------------------------------------------------------------------------------------ |
   | `DATABASE_URL`                  | Postgres internal URL                                                                                  |
   | `REDIS_URL`                     | Redis internal URL                                                                                     |
   | `IG_USER_ID`, `IG_ACCESS_TOKEN` | Meta bilgileri (token sadece ilk açılışta DB'ye yazılır, sonra otomatik yenilenir)                     |
   | `FB_APP_ID`, `FB_APP_SECRET`    | Meta app                                                                                               |
   | `TELEGRAM_BOT_TOKEN`            | @BotFather token'ı (opsiyonel)                                                                         |
   | `PANEL_PASSWORD`                | Panel parolası (min 6 karakter)                                                                        |
   | `WEB_BIND`                      | Sunucunun Tailscale IP'si (`tailscale ip -4`)                                                          |
   | `WEB_PORT`                      | Panel portu, varsayılan `18473` (8080 genelde Traefik'te dolu)                                         |
   | `COOKIE_SECURE`                 | Sadece panel HTTPS üzerinden açılıyorsa `true`                                                         |
   | `IMAGE_TAG`                     | Opsiyonel: belirli bir sürüme sabitlemek/geri dönmek için kısa SHA (ör. `sha-d64059a`); boşsa `latest` |

6. **Erişim:** Tailscale için `web`'e domain verme, `WEB_BIND`'i Tailscale IP'si yap → `http://<tailscale-ip>:18473`. Domain + HTTPS istersen `web`'e domain ata ve `COOKIE_SECURE=true` ver.
7. **Deploy**'a bas. `api` migration + seed'i çalıştırır, `worker` ve `web` api healthy olunca başlar.
8. **Otomatik deploy (opsiyonel):** Coolify'da kaynağın **Webhooks** sekmesindeki _Deploy Webhook_ URL'ini ve **Keys & Tokens → API Tokens**'tan _deploy_ yetkili bir token'ı GitHub repo secret'ı olarak ekle:
   ```bash
   gh secret set COOLIFY_WEBHOOK   # deploy webhook URL'i
   gh secret set COOLIFY_TOKEN     # Coolify API token'ı
   ```
   Bundan sonra push → test → imaj → Coolify deploy tamamen otomatik.

Geri dönmek için: `IMAGE_TAG`'i önceki çalışan SHA tag'ine ayarla ve redeploy et.

### Coolify olmadan

```bash
cp .env.example .env   # doldur (WEB_BIND / WEB_PORT dahil)
docker compose up -d --build
```

- Healthcheck: `GET /api/health` (DB'ye `SELECT 1`). Worker'ın healthcheck'i kapalıdır (HTTP sunucusu yok).
- Kaynak: tek hesapla toplam ~300–400 MB RAM; OCR sırasında kısa süreli 1 çekirdek. `OCR_CONCURRENCY` varsayılan 1.

## Panel

- **Dashboard:** son poll ve sonucu, sonraki poll, token kalan gün (kritikse kırmızı), aktif/erişilemez hesap, son 24 saat eşleşme, kuyruk durumu, son hatalar, askı/token banner'ları
- **Eşleşmeler:** hesap / keyword / kaynak / status / tarih filtresi; snippet, OCR metni, permalink; Görüldü / Yok say / Yeni yap
- **Hesaplar:** ekle / sil / aktif-pasif, erişim durumu + son hata, "Şimdi doğrula"
- **Anahtar kelimeler:** ekle / sil / aktif-pasif (Türkçe-normalize unique)
- **Ayarlar:** poll aralığı, medya limiti, OCR, rate-limit beklemesi, token eşiği; token durumu + "Şimdi yenile", "Şimdi poll çalıştır", "Askıyı kaldır"
- **Loglar:** `poll_runs` geçmişi, satıra tıklayınca hata detayları

Auth: tek kullanıcı, `PANEL_PASSWORD` ile giriş, session Redis'te tutulur (`igw.sid` cookie, 7 gün rolling). 15 dk içinde 5 hatalı denemeden sonra IP bazlı geçici blok.

## Telegram bildirimleri

1. Telegram'da **@BotFather** → `/newbot` → token'ı `TELEGRAM_BOT_TOKEN` olarak env'e ekle, api + worker'ı yeniden başlat.
2. Bildirimin gideceği yere bot'u ekle:
   - **Kanal:** Kanal → Yöneticiler → Yönetici ekle → bot (en az "Mesaj gönder" izni)
   - **Grup:** bot'u gruba üye olarak ekle
   - **Kişi:** bot'a özelden `/start` yaz
3. O sohbete bir mesaj at, panelde **Bildirimler → Chat bul** ile bulup **Ekle**'ye bas (ya da chat ID'yi elle gir), **Test mesajı** ile doğrula.

Yeni eşleşmeler (hesap, keyword, kaynak, snippet, OCR metni, link), token yenileme hataları ve rate-limit askıları tüm aktif sohbetlere gider. Bir sohbete gönderim başarısız olursa diğerleri etkilenmez; hata o sohbetin satırında görünür. Telegram'a ulaşılamaması poll/OCR job'ını bozmaz (eşleşme zaten kaydedilmiştir).

## Genişletme

- **Yeni bildirim kanalı** (e-posta, Slack…): `NotifierPort`'u implemente eden bir adapter yaz, `core.module.ts`'teki `CompositeNotifier` listesine ekle.
- **LLM classifier:** `ClassifierPort.classify()` implemente et (`relevant: false` dönen eşleşmeler kaydedilmez), `PassThroughClassifier` yerine bağla.
