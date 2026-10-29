# Readr — Backend (Bookstore API)

REST API **FastAPI** untuk aplikasi Readr: katalog buku, keranjang, pesanan,
pembayaran manual, ulasan, promosi, inventori, dashboard, Book Community,
Book Rewards, dan AI Book Advisor. Data disimpan di **Supabase (PostgreSQL)**;
beberapa fitur memakai SQLAlchemy ORM, sisanya PostgREST.

Dokumentasi terkait:

- Ringkasan proyek: [`../README.md`](../README.md)
- Penjelasan **per paket** `app/`: [`docs/packages/README.md`](docs/packages/README.md)
- Pola OOP/SOLID lintas paket: [`IMPLEMENTASI-4-PILAR-OOP.md`](IMPLEMENTASI-4-PILAR-OOP.md)
- AI Book Advisor: [`BOOK-ADVISOR.md`](BOOK-ADVISOR.md)
- Book Community: [`COMMUNITY.md`](COMMUNITY.md)

> **Catatan git:** pola `docs` di `.gitignore` root meng-ignore **setiap** folder
> bernama `docs`, termasuk `backend/docs/`. Dokumen di `docs/packages/` ada di
> mesin lokal tetapi tidak akan muncul di GitHub sampai aturan itu dipersempit.
> `COMMUNITY.md` dan `IMPLEMENTASI-4-PILAR-OOP.md` juga sedang **terhapus di
> working tree** (belum di-commit); tautannya tetap valid di `main`.

---

## Daftar Isi

- [Prasyarat](#prasyarat)
- [Menjalankan Lokal](#menjalankan-lokal)
- [Konfigurasi `.env`](#konfigurasi-env)
- [Database & Migrasi](#database--migrasi)
- [Endpoint](#endpoint)
- [Akses dari LAN](#akses-dari-lan)
- [Testing & Lint](#testing--lint)
- [Deploy (Vercel)](#deploy-vercel)
- [Dua Jalur Akses Data](#dua-jalur-akses-data)

---

## Prasyarat

- **Python ≥ 3.12** (dideklarasikan di `pyproject.toml`)
- [**uv**](https://docs.astral.sh/uv/) — pengelola dependensi dan runner
- Proyek **Supabase** dengan Auth, PostgreSQL, dan Storage aktif

Dependensi inti: FastAPI, SQLAlchemy 2 (async) + asyncpg, Pydantic v2 /
pydantic-settings, `supabase` (PostgREST + Storage + Auth), httpx, PyJWT,
slowapi, Alembic & uvicorn (lokal saja).

---

## Menjalankan Lokal

```bash
cd backend
uv sync
cp .env.example .env            # PowerShell: Copy-Item .env.example .env
uv run main.py                  # http://localhost:8000, selalu --reload
```

`main.py` membaca `HOST`/`PORT` dari `.env` (default `0.0.0.0:8000`). Padanan
perintah langsung:

```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

| URL | Keterangan |
| :--- | :--- |
| `http://localhost:8000/health` | Health check (`{"status": "online", ...}`) |
| `http://localhost:8000/docs` | Swagger UI |
| `http://localhost:8000/redoc` | ReDoc |
| `http://localhost:8000/api/v1/openapi.json` | Spesifikasi OpenAPI |

---

## Konfigurasi `.env`

Seluruh nama variabel (dengan komentar) ada di [`.env.example`](.env.example).
Tidak ada nilai kredensial di dalam kode — semuanya dibaca lewat
`app/core/config.py`.

| Kelompok | Variabel | Catatan |
| :--- | :--- | :--- |
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` | Service role dipakai backend untuk PostgREST (melewati RLS) |
| Database | `DATABASE_URL`, `DATABASE_POOL_RECYCLE_SECONDS` | **Gunakan Supavisor pooler** (`*.pooler.supabase.com`), bukan `db.<ref>.supabase.co` yang tidak punya record IPv4 |
| Server | `ENVIRONMENT`, `HOST`, `PORT`, `FRONTEND_ORIGINS` | `ENVIRONMENT=development` mengaktifkan origin LAN `:3000` |
| Storage | `STORAGE_BUCKET_PRODUCTS` | Bucket sampul produk |
| AI | `GEMINI_*`, `OPENROUTER_*` | Klien dibuat malas; tanpa key tidak ada koneksi yang dibuka |
| Pencarian buku | `GOOGLE_BOOKS_API_KEY` | Opsional |
| Scraper | `SCRAPER_SERVICE_URL`, `SCRAPER_API_TOKEN`, `SCRAPER_TIMEOUT_SECONDS` | Dipakai fitur *Bandingkan Harga* |

### CORS

- `FRONTEND_ORIGINS` — daftar origin eksplisit (dipisah koma), aktif di semua environment.
- `VERCEL_FRONTEND_PROJECTS` — nama proyek Vercel; backend membangun regex
  `https://<proyek>[-hash].vercel.app`.
- Origin LAN `http://<ip-privat>:3000` hanya diterima bila `ENVIRONMENT=development`.

---

## Database & Migrasi

Skema dikelola **Alembic** (`migrations/versions/`, 13 revisi, head
`20261024_13`). `alembic.ini` tidak memuat kredensial — URL diambil dari
`DATABASE_URL` lewat `app/core/config.py` (`migrations/env.py`).

```bash
uv run alembic upgrade head
uv run alembic current
```

> ⚠️ **Rantai migrasi tidak dapat membangun database kosong dari nol.**
> `20261011_04_rbac_rls.py` memanggil `public.is_admin()` di policy
> `categories_admin_write`, padahal fungsi itu baru dibuat di `20261011_05`.
> Tabel `categories` juga tidak pernah dibuat oleh migrasi mana pun.
> **Database live adalah acuan** — jangan menganggap `upgrade head` di DB kosong
> akan berhasil. Rincian: [`docs/packages/11-migrations-supabase.md`](docs/packages/11-migrations-supabase.md).

Yang dibuat & dikelola migrasi:

| Revisi | Isi |
| :--- | :--- |
| `20260928_01` | Tabel `profiles` (FK ke `auth.users.id`, `role` default `user`) + trigger `handle_new_user()` |
| `20260928_02` / `_03` | Tabel `books`, `promos` |
| `20261011_04` – `_06` | RBAC/RLS, fungsi `is_admin()`, kolom identitas profil |
| `20261015_07` – `20261018_09` | Tabel & slug marketplace |
| `20261019_10` – `_11` | Book Community, Book Rewards |
| `20261020_12` | Biaya pesan AI Book Advisor |
| `20261024_13` | Verifikasi pembayaran manual (bukti, audit log) |

### Akun admin

Role hanya dibaca dari `profiles.role`; metadata di JWT tidak dipercaya.
Promosikan akun langsung di Supabase SQL Editor:

```sql
UPDATE public.profiles SET role = 'admin' WHERE id = 'SUPABASE_USER_UUID';
```

### Aset di luar migrasi

- **Bucket Storage privat `payment-proofs` tidak dibuat oleh migrasi.** Buat
  manual lewat Dashboard/SQL Editor. Pemeriksaan (menyentuh Storage live):
  ```bash
  uv run python scripts/smoke_payment_bucket.py
  ```
- Folder [`supabase/`](supabase/README.md) adalah **arsip historis** — jangan
  jalankan `*.sql` di sana ke database aktif.

---

## Endpoint

Semua endpoint aplikasi berada di bawah `/api/v1` (`API_V1_PREFIX`), kecuali
`/health`. Kolom **Akses**: 🔓 publik · 🔑 login (Bearer) · 🛡️ admin.

### Umum

| Method | Endpoint | Akses |
| :--- | :--- | :--- |
| `GET` | `/health` | 🔓 |
| `GET` | `/api/v1/me` (alias `/api/v1/auth/me`) | 🔑 |
| `POST` | `/api/v1/auth/login`, `/api/v1/auth/register` | 🔓 |

```bash
curl.exe http://localhost:8000/api/v1/me -H "Authorization: Bearer ACCESS_TOKEN"
```

### Ringkasan per modul (18 router)

| Modul | Prefix | Akses utama |
| :--- | :--- | :--- |
| `auth.py` | `/auth` | 🔓 login/register, 🔑 `me` |
| `books.py` | `/books` | 🔓 baca, 🛡️ tulis |
| `categories.py` | `/categories` | 🔓 baca, 🛡️ tulis |
| `uploads.py` | `/uploads` | 🛡️ `POST /product-image` |
| `inventory.py` | `/inventory` | 🛡️ `movements`, `low-stock`, `adjust` |
| `orders.py` | `/orders`, `/shipping-options` | 🔑 pesanan, 🛡️ status & `expire-overdue` |
| `payments.py` | `/orders/{id}/payment…`, `/admin/payments` | 🔑 bukti transfer, 🛡️ verifikasi |
| `cart.py` | `/cart` | 🔑 |
| `promos.py` | `/promos` | 🛡️ |
| `dashboard.py` | `/dashboard` | 🛡️ `summary`, `sales-chart`, `categories-chart`, `reports/monthly` |
| `marketplaces.py` | `/books/{id}/marketplace-prices`, `/marketplaces`, `/marketplace-sources` | 🔑 bandingkan harga, 🛡️ kelola sumber |
| `reviews.py` | `/books/{id}/reviews`, `/reviews` | 🔓 baca, 🔑 tulis, 🛡️ moderasi |
| `rewards.py` | `/rewards` | 🔑 `me`, `transactions`, `spoiler-access` |
| `admin_rewards.py` | `/admin/rewards` | 🛡️ `rules`, `adjustments`, `backfill`, `reconcile`, `activities`, `ai/recover` |
| `community.py` | `/community` | 🔑 grup/anggota/pesan, 🛡️ buat grup |
| `ai.py` | `/ai` | 🔑 ulasan AI & akses spoiler |
| `book_advisor.py` | `/book-advisor` | 🔑 `pricing`, `chat`, `sessions`, `preferences`, `feedback` |

> `POST /api/v1/books/{book_id}/ai-review` tetap ada sebagai **alias lama
> (`deprecated`)** untuk level spoiler gratis; level berbayar wajib lewat
> `/api/v1/ai/books/{book_id}/review`.

Daftar route lengkap beserta parameter: Swagger `/docs` atau
[`docs/packages/01-api.md`](docs/packages/01-api.md).

---

## Akses dari LAN

Backend bind `0.0.0.0` (IPv4) agar bisa dibuka dari perangkat lain di Wi-Fi
yang sama.

1. Lihat IP komputer: `ipconfig` → **IPv4 Address** (mis. `192.168.1.10`).
2. Jalankan backend dan frontend (`bun run dev` di `../frontend`).
3. Dari HP/laptop lain buka `http://192.168.1.10:3000`; frontend memanggil
   `http://192.168.1.10:8000/api/v1` (lihat `../frontend/lib/apiUrl.ts`).
4. Bila koneksi ditolak padahal backend jalan, izinkan port di Windows Firewall
   (PowerShell **sebagai Administrator**, jaringan privat saja):

   ```powershell
   New-NetFirewallRule -DisplayName "Readr API 8000" -Direction Inbound `
     -Protocol TCP -LocalPort 8000 -Profile Private -Action Allow
   ```

> `--host ::` (IPv6) **tidak** dipakai: di Windows socket IPv6 bersifat v6-only
> sehingga IPv4 ikut mati. Firewall dan CORS adalah urusan terpisah — keduanya
> harus benar. Jangan membuka `-Profile Public` atau port-forward router;
> autentikasi tetap berlaku, tetapi backend tidak dirancang untuk internet publik.

---

## Testing & Lint

```bash
uv run pytest        # test memakai dependency override & repository palsu — tanpa DB
uv run ruff check .
```

Konfigurasi pytest/ruff ada di `pyproject.toml` (mis. `B008` diabaikan karena
pola `Depends(...)` FastAPI, dan `BLE001` dilonggarkan di layer router).
Ringkasan suite: [`docs/packages/12-tests.md`](docs/packages/12-tests.md).

---

## Deploy (Vercel)

- [`vercel.json`](vercel.json) mengarahkan semua request ke
  [`api/index.py`](api/index.py) (ASGI app, `maxDuration` 60 dtk, `app/**`
  disertakan sebagai file).
- Bila variabel `VERCEL` ada: `/docs`, `/redoc`, dan `openapi.json` dimatikan,
  dan `app/db/session.py` memakai `NullPool`.
- Dependensi serverless dipasang dari [`requirements.txt`](requirements.txt)
  (tanpa `alembic`/`uvicorn`). **Migrasi dijalankan dari mesin lokal**, bukan
  dari deployment.
- `main.py` tidak dipakai di Vercel; modul aplikasinya sama (`app.main:app`).

---

## Dua Jalur Akses Data

| Jalur | Klien | Dunia | Konsekuensi |
| :--- | :--- | :--- | :--- |
| SQLAlchemy async | `AsyncSession` dari `get_db` (`app/db/session.py`) | `books`, `community`, `reviews`, `marketplaces`, `advisor` | Model ORM, transaksi `commit()` eksplisit |
| PostgREST | `supabase_admin` / `supabase_anon` (`app/core/supabase.py`) | kategori, promo, keranjang, pesanan, inventori, dashboard, pembayaran, rewards | Tanpa model ORM; data berupa `dict` |

`supabase_admin` memakai service role dan **melewati RLS**, maka otorisasi
wajib dilakukan di layer API (`app/core/security.py`: `require_admin`,
`require_user`). Rincian: [`docs/packages/03-db.md`](docs/packages/03-db.md).
