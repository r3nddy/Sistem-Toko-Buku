"""Endpoint versi 1 (`/api/v1`).

Setiap modul mewakili satu kelompok resource:

- `auth` — login, registrasi, dan profil pengguna yang sedang masuk.
- `books` — katalog buku (publik) dan CRUD admin.
- `categories` — kategori produk.
- `cart` — keranjang pelanggan.
- `orders` — pesanan dan layanan pengiriman.
- `inventory` — penyesuaian stok dan riwayat pergerakan.
- `dashboard` — KPI, grafik, dan laporan admin.
- `promos` — voucher/diskon.
- `uploads` — unggah gambar ke Supabase Storage.
- `marketplaces` — perbandingan harga marketplace dan sumber harga (admin).
- `community` — grup diskusi, anggota, dan pesan.
- `reviews` — ulasan buku dan antrian moderasi.
- `rewards` — saldo dan transaksi poin pelanggan.
- `admin_rewards` — aturan reward, penyesuaian poin, backfill, rekonsiliasi.
- `ai` — generasi ulasan AI berbayar poin.
- `payments` — verifikasi pembayaran manual (pelanggan + admin).
- `book_advisor` — percakapan AI Book Advisor.

Modul-modul ini dirangkai menjadi satu aplikasi di `app.main`.
"""
