# Scraper Service — Harga Buku Marketplace

Layanan berbasis **Python, uv & Playwright** yang mengambil harga buku di
marketplace Indonesia (**Tokopedia, Lazada, Blibli, Gramedia, Periplus,
Shopee**) tanpa SerpApi. Satu image yang sama punya dua peran:

- **Server API** (`python -m src.api`) — backend Readr memanggil
  `POST /scrape` saat pengguna menekan *Bandingkan Harga*. Hasil dikembalikan
  lewat HTTP dan **tidak** disimpan service ini; backend yang menyimpannya
  sebagai snapshot di `marketplace_prices`. Chromium tidak pernah dijalankan di
  proses backend utama.
- **Worker cron** (`python -m src.main`, opsional) — mengambil daftar buku dari
  database, scrape semuanya, lalu menulis snapshot langsung ke
  `public.marketplace_prices`.

Kedua mode memakai jalur scraping yang sama (`src/pipeline.py`): tiap marketplace
dicoba langsung dengan Playwright; yang gagal tidak dicoba ulang dengan cara lain.

**Batas waktu:** backend memanggil scraper dengan `SCRAPER_TIMEOUT_SECONDS`
(default 20 dtk), lebih ketat daripada batas total perbandingan 25 dtk di
`backend/app/services/marketplace/service.py`; bila waktu habis, backend tetap
menampilkan harga terakhir yang tersimpan.

---

## Daftar Isi

- [Prasyarat](#prasyarat)
- [Konfigurasi `.env`](#konfigurasi-env)
- [Persiapan Lokal](#persiapan-lokal)
- [Mode API](#mode-api-dipakai-backend)
- [Mode Cron](#mode-cron-opsional)
- [Cara Tiap Marketplace Diambil](#cara-tiap-marketplace-diambil)
- [Struktur Folder](#struktur-folder)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Prasyarat

- **Python ≥ 3.12**
- [**uv**](https://docs.astral.sh/uv/getting-started/installation/)
- Untuk mode cron: akses ke database Supabase (pooler PostgreSQL)

Dependensi: Playwright, playwright-stealth, SQLAlchemy (async) + asyncpg,
pydantic-settings, BeautifulSoup, FastAPI + uvicorn (server API).

---

## Konfigurasi `.env`

Salin template lalu isi:

```bash
cp .env.example .env            # PowerShell: Copy-Item .env.example .env
```

| Variabel | Default | Mode | Keterangan |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | lokal | cron | Connection string Supabase, sama seperti backend. **Gunakan Supavisor pooler** (`*.pooler.supabase.com`) |
| `PORT` | `8001` | API | Port server scraper |
| `SCRAPER_API_TOKEN` | *(kosong)* | API | Token wajib di header `X-Scraper-Token`; harus sama dengan `backend/.env`. Kosong = tanpa pemeriksaan token |
| `MAX_CONCURRENT_SCRAPES` | `2` | API | Buku yang di-scrape bersamaan (1–4). Kelebihan permintaan → HTTP 429 + `Retry-After: 5` |
| `HEADLESS` | `true` | keduanya | Jalankan browser headless |
| `BROWSER_CHANNEL` | `chromium` | keduanya | Mode headless baru yang lolos di Tokopedia; kosong = headless lama |
| `CONCURRENCY` | `5` | cron | Tab browser paralel per proses (1–5) |
| `REQUEST_TIMEOUT_MS` | `15000` *(kode)* / `25000` *(`.env.example`)* | keduanya | Batas waktu muat satu halaman |
| `DELAY_MIN_SECONDS` / `DELAY_MAX_SECONDS` | `2.0` / `5.0` | cron | Jeda acak antar pencarian untuk menghindari deteksi bot |
| `MAX_BOOKS_PER_RUN` | `0` | cron | Batas buku per run; `0` = semua |

> `PORT` sengaja **tidak** di-set di `Dockerfile`; platform (Render/Railway)
> menyuntikkan nilainya sendiri dan nilai env platform mengalahkan `.env`.

---

## Persiapan Lokal

```bash
cd scraper-service
uv sync
uv run playwright install chromium
```

---

## Mode API (dipakai backend)

```bash
uv run python -m src.api          # http://0.0.0.0:8001
```

Isi `backend/.env`:

```env
SCRAPER_SERVICE_URL=http://127.0.0.1:8001
SCRAPER_API_TOKEN=<sama dengan scraper-service/.env>
SCRAPER_TIMEOUT_SECONDS=20
```

### Endpoint

| Method | Path | Keterangan |
| :--- | :--- | :--- |
| `GET` | `/health` | Penanda hidup (`{"status": "ok"}`) |
| `POST` | `/scrape` | Cari harga satu buku di semua marketplace |

Body `POST /scrape`:

```json
{ "title": "Bumi Manusia", "author": "Pramoedya Ananta Toer", "keywords": { "tokopedia": "..." } }
```

`keywords` opsional, per slug marketplace (dari `marketplace_sources.search_keyword`).

Respons:

```json
{
  "offers": {
    "tokopedia": {
      "title": "...", "price": "85000", "product_url": "...",
      "seller_name": "...", "in_stock": true, "match_score": 0.93
    }
  },
  "failures": { "shopee": "alasan gagal" }
}
```

Marketplace yang gagal muncul di `failures` — tidak menggagalkan permintaan.
Respons disimpan di cache in-memory **5 menit** per kombinasi judul/penulis/kata
kunci.

Uji cepat (PowerShell):

```powershell
$body = @{ title = "Bumi Manusia"; author = "Pramoedya Ananta Toer" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8001/scrape `
  -Headers @{ "X-Scraper-Token" = "<token>" } -ContentType "application/json" -Body $body
```

Panggilan pertama lambat (Chromium baru start, ±40–60 dtk dan butuh memori
cukup); berikutnya lebih cepat.

---

## Mode Cron (opsional)

```bash
uv run python -m src.main
```

Mengambil buku dari database, men-scrape tiap buku di semua marketplace, lalu
menyisipkan snapshot ke tabel `marketplace_prices`. Kegagalan satu penawaran
hanya menggugurkan penawaran itu, bukan seluruh run. Keluar dengan kode 1 bila
pipeline gagal fatal (dipakai `restartPolicyType: ON_FAILURE` di Railway).

Cek parser tanpa browser/network:

```bash
uv run python selftest.py
```

---

## Cara Tiap Marketplace Diambil

Semua marketplace diambil lewat Playwright langsung. Hasil pencarian disaring
di `src/scrapers/filtering.py` (salinan aturan backend): seluruh kata judul
wajib cocok, judul bertanda paket (`tetralogi`, `set`, `paket`, ...) dan barang
non-buku ditolak, lalu dipilih harga termurah yang wajar dibanding titik tengah
harga kandidat.

| Marketplace | Status | Catatan |
| :--- | :--- | :--- |
| Tokopedia | ✅ Jalan | Butuh UA desktop Chrome eksplisit (`browser.py`) dan `BROWSER_CHANNEL=chromium` (mode headless baru); tanpa itu `ERR_HTTP2_PROTOCOL_ERROR` / 0 kartu. Query wajib `quote_plus` (`+`), bukan `%20`. |
| Lazada | ✅ Jalan | URL `catalog/?q=` dengan `+`; judul dibaca dari atribut `title`. |
| Blibli | ⚠️ Tidak stabil | `/cari/<q>` kadang mengembalikan 0 kartu (deteksi bot). Pencarian memakai varian query pendek. |
| Gramedia | ✅ Jalan | `/search?q=`; kartu produk di `<a href*="/products/">`. Query dipendekkan (tanpa subtitle setelah `:`). |
| Periplus | ✅ Jalan | `/product/Search?filter_name=`; kartu di `<a href*="/p/">`. Katalog cenderung buku import/Inggris. |
| Shopee | ❌ Tidak bisa | Selalu dialihkan ke `/verify/traffic/error` (wajib login). |

---

## Struktur Folder

```text
scraper-service/
├── src/
│   ├── api.py            # FastAPI: /health, /scrape, cache 5 menit, semaphore
│   ├── main.py           # Entry point worker cron
│   ├── pipeline.py       # scrape_book_offers() & run_scrape_pipeline()
│   ├── browser.py        # Manajer Chromium (UA desktop, channel chromium)
│   ├── config.py         # Settings (pydantic-settings)
│   ├── db.py             # Engine async, ambil buku, INSERT marketplace_prices
│   └── scrapers/         # base, filtering, tokopedia, lazada, blibli,
│                         # gramedia, periplus, shopee
├── selftest.py           # Uji parser tanpa browser/network
├── Dockerfile            # mcr.microsoft.com/playwright/python + uv
└── railway.json          # Konfigurasi Railway (Dockerfile builder)
```

---

## Deployment

`Dockerfile` memakai base image resmi
`mcr.microsoft.com/playwright/python:v1.64.0-noble` (versi disamakan dengan
`playwright` di `uv.lock`), memasang binary `uv` dari Astral, lalu memasang
Chromium ke `PLAYWRIGHT_BROWSERS_PATH=/app/.ms-playwright`. Build **gagal lebih
awal** bila binary Chromium tidak mendarat di path tersebut. `.env` dan artefak
lokal tidak ikut ke image (`.dockerignore`).

Default `CMD` adalah mode API. Mode cron memakai image yang sama dengan start
command berbeda.

| Service | Start Command | Keterangan |
| :--- | :--- | :--- |
| scraper-api | `uv run python -m src.api` | Dipanggil backend via `SCRAPER_SERVICE_URL`; butuh public domain |
| scraper-cron (opsional) | `uv run python -m src.main` | Cron schedule; mengakses DB langsung |

### Render (jalur yang dipakai repo ini)

`render.yaml` di **root** repo sudah mendefinisikan Web Service Docker:

- `dockerContext: ./scraper-service`, health check `/health`, region `singapore`,
  `plan: standard`, `autoDeploy: true`.
- Env yang diisi manual di dashboard (`sync: false`): `SCRAPER_API_TOKEN` dan
  `DATABASE_URL`; `MAX_CONCURRENT_SCRAPES=2`, `HEADLESS=true`,
  `BROWSER_CHANNEL=chromium` sudah diset.
- **Jangan pakai plan `free`**: Chromium + 2 scrape bersamaan butuh ≥ 1 GB RAM,
  dan cold start ±50 dtk melebihi `SCRAPER_TIMEOUT_SECONDS=20` di backend.
- Deploy: Render Dashboard → **New → Blueprint** → pilih repo → Apply.
- Mode cron **tidak** didefinisikan di `render.yaml`; sediakan sebagai Cron Job
  terpisah dengan image dan start command `uv run python -m src.main` bila
  dibutuhkan.

### Railway (alternatif)

`railway.json` memakai `DOCKERFILE` builder dengan `restartPolicyType:
ON_FAILURE` (maks. 3 percobaan).

1. Railway Dashboard → **+ Create → GitHub Repo**, pilih repositori ini.
2. Set **Root Directory** ke `/scraper-service`.
3. Set **Start Command** sesuai tabel di atas.
4. Environment variable:

   ```env
   PORT=8001
   SCRAPER_API_TOKEN=<token acak panjang>
   HEADLESS=true
   MAX_CONCURRENT_SCRAPES=2
   ```

   Service cron juga butuh:

   ```env
   DATABASE_URL=postgresql+asyncpg://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   DELAY_MIN_SECONDS=2.0
   DELAY_MAX_SECONDS=5.0
   ```

5. Di backend, set `SCRAPER_SERVICE_URL=<domain service API>` dan
   `SCRAPER_API_TOKEN` yang sama.
6. Untuk cron: di halaman service → **Settings → Cron Schedule**, misalnya
   `0 3 * * *` (tiap hari 03.00) atau `0 */6 * * *` (tiap 6 jam).

---

## Troubleshooting

| Gejala | Penyebab & solusi |
| :--- | :--- |
| `401 Token scraper salah` | `SCRAPER_API_TOKEN` di backend dan scraper berbeda, atau header `X-Scraper-Token` tidak terkirim |
| `429 Server scraper sedang sibuk` | Semua slot `MAX_CONCURRENT_SCRAPES` terpakai; tunggu sesuai `Retry-After` |
| Request pertama timeout / OOM | Chromium belum start atau RAM container kurang; minimal 1 GB, sebaiknya 2 GB |
| Tokopedia 0 kartu / `ERR_HTTP2_PROTOCOL_ERROR` | Pastikan `BROWSER_CHANNEL=chromium` dan UA desktop dipakai (`browser.py`) |
| Aset/probing gagal di Windows lokal | Pasang browser dulu: `uv run playwright install chromium` |
