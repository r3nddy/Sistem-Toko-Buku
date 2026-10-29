# Readr — Frontend

Aplikasi web **Readr** (toko buku online) berbasis **Next.js App Router**,
React, TypeScript, dan Tailwind CSS v4. Berisi storefront publik, halaman akun
dan pesanan, Book Community, dan portal admin di `/admin`.

Backend-nya adalah FastAPI di [`../backend`](../backend); ringkasan proyek ada
di [`../README.md`](../README.md).

---

## Daftar Isi

- [Prasyarat](#prasyarat)
- [Menjalankan Lokal](#menjalankan-lokal)
- [Variabel Lingkungan](#variabel-lingkungan)
- [Cara Frontend Memanggil Backend](#cara-frontend-memanggil-backend)
- [Autentikasi & Peran](#autentikasi--peran)
- [Struktur Folder](#struktur-folder)
- [Halaman](#halaman)
- [Testing, Lint & Build](#testing-lint--build)
- [Deploy](#deploy)
- [Catatan Pengembangan](#catatan-pengembangan)

---

## Prasyarat

- **Bun ≥ 1.3** — paket manager yang dipakai repo ini (`packageManager` di
  `package.json`, dipakai juga saat deploy).
- Akses ke **backend** yang berjalan, serta **proyek Supabase** dengan Auth aktif
  (URL dan anon key diambil dari backend/.env Supabase yang sama).

Framework: Next.js `16.3.6`, React `19.2`, TypeScript `5`, Tailwind CSS `4`,
Supabase JS `2`, Radix UI, TanStack Table, Recharts, Zod, React Hook Form.

---

## Menjalankan Lokal

Jalankan backend lebih dulu:

```bash
cd ../backend
uv run main.py        # http://localhost:8000
```

Lalu frontend:

```bash
cd frontend
bun install
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
bun run dev                   # http://localhost:3000
```

Buka `http://localhost:3000`. Halaman admin: `/admin` (dialihkan ke
`/admin/dashboard`).

Untuk menjadikan akun sebagai admin, promosikan langsung di Supabase SQL Editor:

```sql
UPDATE public.profiles SET role = 'admin' WHERE id = 'SUPABASE_USER_UUID';
```

Peran dibaca dari backend (`GET /api/v1/me` → `profiles.role`), bukan dari
metadata sesi Supabase, jadi muat ulang halaman setelah promosi.

### Dari perangkat lain di Wi-Fi yang sama

1. Lihat IPv4 komputer backend: `ipconfig` → **IPv4 Address** (mis. `192.168.1.10`).
2. Backend harus bind `0.0.0.0` (`HOST` di `backend/.env`; default sudah begitu).
   Bila koneksi ditolak, izinkan port 8000 di Windows Firewall (profil **Private**)
   sesuai [`backend/README.md`](../backend/README.md).
3. `bun run dev` sudah listen di semua antarmuka; buka `http://192.168.1.10:3000`.
4. Bila HMR/aset dev diblokir Next ("Blocked cross-origin request to Next.js
   dev resource"), isi di `.env.local` lalu restart:

   ```text
   NEXT_DEV_ALLOWED_ORIGINS=192.168.*.*,10.*.*.*
   ```

   Variabel ini hanya berpengaruh di `next dev` (`next.config.ts`).

---

## Variabel Lingkungan

Nilai lengkap beserta komentar ada di [`.env.example`](.env.example). Berkas
`.env*` di-ignore git, jadi **nilai tidak ikut ke Vercel** — set di dashboard.

| Variabel | Wajib | Keterangan |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL proyek Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon key Supabase (aman untuk browser) |
| `NEXT_PUBLIC_API_URL` | Opsional lokal, **wajib** di deploy | URL backend, mis. `http://localhost:8000/api/v1` atau `https://<backend>.vercel.app/api/v1` (tanpa garis miring akhir) |
| `NEXT_DEV_ALLOWED_ORIGINS` | Opsional | Hanya `next dev`: host tambahan untuk akses via LAN |

---

## Cara Frontend Memanggil Backend

Semua panggilan API lewat [`lib/api.ts`](lib/api.ts); URL dasar dihitung oleh
[`lib/apiUrl.ts`](lib/apiUrl.ts) pada setiap panggilan:

1. `NEXT_PUBLIC_API_URL` dipakai bila diisi.
2. Bila kosong → `http://<host halaman>:8000/api/v1`, sehingga
   `http://192.168.1.10:3000` memanggil `http://192.168.1.10:8000/api/v1`.
3. Bila diisi tapi menunjuk loopback (`localhost`/`127.0.0.1`) sementara halaman
   dibuka dari host lain di HTTP, host loopback diganti host halaman.
4. Untuk halaman HTTPS dengan URL loopback, dipakai origin halaman
   (`https://<host>/api/v1`) agar salah konfigurasi terlihat sebagai 404,
   bukan koneksi menggantung.

Perilaku lain di `lib/api.ts`:

- Batas waktu default 45 detik (`DEFAULT_TIMEOUT_MS`).
- `GET`/`HEAD` diulang otomatis dengan jeda bertingkat (`RETRY_DELAYS_MS`)
  bila koneksi ditolak; `POST` tidak diulang agar tidak terduplikasi.
- Pesan error jaringan menyebut URL API dan origin halaman, plus saran membuka
  `/health` untuk membedakan CORS dari backend yang tidak terjangkau.
- `ApiError` menyimpan `status` dan `code` (dari prefix `KODE: pesan` pada
  `detail`, mis. `INSUFFICIENT_POINTS`).

---

## Autentikasi & Peran

- Login/daftar/reset kata sandi memakai **Supabase Auth**
  (`components/AuthProvider.tsx`, `lib/auth-utils.ts`).
- Token akses sesi dikirim sebagai `Authorization: Bearer …` ke backend.
- Peran (`admin` / `user`) hanya berasal dari `GET /api/v1/me`.
- `app/admin/layout.tsx` menjaga seluruh rute `/admin/*` (tanpa sesi →
  `/login?redirect=…`; bukan admin → `AccessDenied`), tetapi ini **hanya UX** —
  penolakan yang mengikat ada di backend (`require_admin`).
- Tautan reset kata sandi (sesi recovery) yang mendarat di halaman lain
  dialihkan otomatis ke `/reset-password`.

---

## Struktur Folder

```text
frontend/
├── app/                  # Rute App Router (lihat tabel Halaman)
│   └── admin/            # Portal admin (dijaga layout.tsx)
├── components/           # Komponen UI (header, katalog, checkout, admin, community, ...)
│   ├── admin/            #   sidebar, header, tabel, dialog admin
│   ├── payment/          #   unggah & pratinjau bukti transfer
│   └── ui/               #   primitif UI (Radix/Base UI + Tailwind)
├── config/site.ts        # Nama toko, tautan, sosial, kontak
├── context/              # CartContext
├── data/                 # mockData.ts (bentuk data katalog + pintasan kategori);
│                         # customers.ts & orders.ts hanya contoh lama dan tidak diimpor halaman
├── hooks/                # useGroupRealtime, dll.
├── lib/
│   ├── api.ts            # Klien REST backend
│   ├── apiUrl.ts         # Penentu URL API
│   ├── services/         # Lapisan service (product, order, customer, promo, ...)
│   ├── supabase.ts       # Klien Supabase (browser)
│   ├── auth-utils.ts     # Deteksi sesi recovery, URL redirect
│   ├── utils.ts          # formatRupiah, formatTanggal, dsb.
│   └── types.ts          # Tipe bersama
├── types/index.ts        # Tipe domain lama (Customer, dll.)
├── next.config.ts        # allowedDevOrigins untuk akses LAN
├── vercel.json           # Konfigurasi deploy Vercel
└── vitest.config.ts      # Konfigurasi test (jsdom)
```

---

## Halaman

### Publik & Pengguna

| Rute | Deskripsi |
| :--- | :--- |
| `/` | Katalog: hero, pencarian, filter kategori (pencocokan kata kunci di klien), keranjang |
| `/books/[id]` | Detail buku, ulasan, ulasan AI, bandingkan harga marketplace |
| `/login`, `/register` | Masuk & daftar akun |
| `/forgot-password`, `/reset-password` | Reset kata sandi |
| `/auth/callback` | Penukaran kode autentikasi (PKCE) |
| `/checkout` | Keranjang, alamat, kurir, metode bayar, konfirmasi |
| `/orders`, `/orders/[id]` | Daftar & detail pesanan, unggah bukti pembayaran |
| `/komunitas` | Book Community (grup diskusi + chat real-time) |
| `/poin` | Saldo poin dan mutasi Book Rewards |
| `/support`, `/privacy`, `/terms` | Bantuan/FAQ, Kebijakan Privasi, Ketentuan Layanan |

### Admin (`/admin/*`)

| Rute | Deskripsi |
| :--- | :--- |
| `/admin` | Dialihkan ke `/admin/dashboard` |
| `/admin/dashboard` | KPI, grafik, pesanan terkini, stok menipis |
| `/admin/produk` | CRUD katalog + unggah sampul |
| `/admin/inventori` | Stok kritis & penyesuaian stok |
| `/admin/pesanan` | Status pesanan & resi |
| `/admin/pembayaran`, `/admin/pembayaran/[paymentId]` | Verifikasi bukti pembayaran |
| `/admin/pelanggan` | Data pembeli (diturunkan dari daftar pesanan) |
| `/admin/promo` | Kupon & diskon |
| `/admin/laporan` | Laporan bulanan & grafik |
| `/admin/rewards` | Aturan, aktivitas, penyesuaian, rekonsiliasi poin |
| `/admin/marketplace-sources` | Sumber harga marketplace per buku |
| `/admin/pengaturan` | Form pengaturan UI — backend belum punya endpoint pengaturan/notifikasi |

---

## Testing, Lint & Build

```bash
bun run dev          # development server
bun run test         # vitest run (jsdom) — 9 berkas tes
bun run test:watch   # vitest watch
bun run lint         # eslint
npx tsc --noEmit     # TypeScript
bun run build        # next build
```

Tes mencakup: `lib/api.test.ts` (timeout, retry, error), `lib/apiUrl.test.ts`,
`lib/auth-utils.test.ts`, `lib/services/index.test.ts`, dialog pembayaran,
unggah bukti pembayaran, badge status pembayaran, dialog berbagi buku di
komunitas, dan alur reset kata sandi.

---

## Deploy

`vercel.json` memasang `bun install --frozen-lockfile` dan `bun run build`.

1. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan
   **`NEXT_PUBLIC_API_URL`** (URL backend publik, berakhiran `/api/v1`) di
   Vercel → Project → Settings → Environment Variables (Production + Preview).
2. Redeploy — nilai `NEXT_PUBLIC_*` di-inline saat build.
3. Pastikan origin frontend terdaftar di `FRONTEND_ORIGINS` backend (atau
   `VERCEL_FRONTEND_PROJECTS` untuk domain `*.vercel.app`).

---

## Catatan Pengembangan

- **Baca [`AGENTS.md`](AGENTS.md) sebelum menulis kode.** Versi Next.js di repo
  ini berbeda dari yang umum; panduannya ada di `node_modules/next/dist/docs/`.
- Jangan menampilkan data karangan: kolom yang tidak ada di backend
  (`rating`, `soldCount`, `discountPercent`, dsb.) dibuat opsional dan tidak
  diisi angka palsu (lihat `data/mockData.ts`).
- `GET /api/v1/books` hanya menerima `page`, `page_size`, dan `q` — filter
  kategori dilakukan di klien.
- Halaman `/admin/pengaturan` belum tersambung ke backend; simpan menampilkan
  pesan bahwa perubahan belum tersimpan.
