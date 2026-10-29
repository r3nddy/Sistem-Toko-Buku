# 02 — Paket `app/core/`

`app/core/` adalah paket **paling bawah** dalam grafik dependensi: konfigurasi,
keamanan (JWT), klien Supabase, pemetaan error, jam toko, ongkir, dan validasi
unggahan. Paket ini **tidak** mengimpor `app.api`, `app.services`, maupun
`app.models`.

---

## 1. Struktur

| Berkas | Tujuan | Simbol utama | Dipakai oleh |
|--------|--------|--------------|--------------|
| `config.py` | Satu-satunya tempat konfigurasi | `Settings(BaseSettings)`, `settings` | Hampir semua modul |
| `security.py` | Verifikasi JWT + peran | `UserPayload`, `resolve_user_role`, `get_current_user`, `require_admin`, `require_user`, `get_optional_user` | Semua router |
| `supabase.py` | Klien PostgREST/Storage/Auth | `supabase_admin`, `supabase_anon` | Service PostgREST, `auth.py` |
| `errors.py` | Tuple exception yang wajar menjadi 4xx | `SERVICE_ERRORS` | `categories.py`, `cart.py`, `orders.py`, `promos.py`, `inventory.py`, ... |
| `clock.py` | "Sekarang" menurut zona toko | `STORE_TZ`, `store_now()`, `store_today()` | `order_service`, `promo_service`, `dashboard_service`, `payment_service` |
| `shipping.py` | Tarif ongkir sisi server | `SHIPPING_OPTIONS`, `resolve()` | `orders.py`, `order_service` |
| `uploads.py` | Validasi isi berkas gambar | `MAX_FILE_SIZE`, `ALLOWED_IMAGE_TYPES`, `detect_image_type()`, `validate_image()` | `uploads.py`, `payments.py` |
| `__init__.py` | Ringkasan isi paket | — | — |

---

## 2. `config.py`

### Fakta
`Settings` mewarisi `pydantic_settings.BaseSettings` dengan
`SettingsConfigDict(env_file=".env", extra="ignore")`. Contoh potongan:

```python
# app/core/config.py
class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    ...
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/postgres",
        description="Database URL PostgreSQL",
    )
```

Nilai turunan berupa `@property` (dihitung ulang dari field mentah):

- `database_url` — URL untuk engine SQLAlchemy.
- `cors_origins` — pisah `FRONTEND_ORIGINS` per koma, buang nilai kosong, buang `/` di akhir.
- `vercel_origins_regex` — pola `^https://(?:<nama>)...\.vercel\.app$` dari `VERCEL_FRONTEND_PROJECTS`.
- `dev_lan_origins_trusted` — `True` hanya bila `ENVIRONMENT == "development"`.

Di bagian akhir modul: `settings = Settings()` — **objek singleton** yang
diimpor ke seluruh aplikasi.

### Evaluasi
**[Evaluasi]** Menaruh aturan turunan sebagai `@property` (bukan file terpisah)
membuat konfigurasi CORS mudah diuji dan tidak tersebar. Namun `Settings`
memuat **banyak** area (Supabase, Gemini, OpenRouter, scraper, storage,
database) sehingga nilainya cukup untuk menjadi beberapa kelas bila tumbuh lagi.

### Rekomendasi
**[Rekomendasi]** Jika area konfigurasi bertambah, pecah menjadi
`SupabaseSettings`, `AISettings`, dan `ScraperSettings` yang dikomposisikan di
`Settings` (composition) — tanpa mengubah nama variabel lingkungan.

---

## 3. `security.py`

### Fakta
Simbol dan alurnya:

| Simbol | Peran |
|--------|-------|
| `UserPayload` | Objek data pengguna hasil verifikasi token (`id`, `email`, `role`, ...). |
| `_get_jwks_client` | Membuat/meng-cache klien JWKS untuk verifikasi tanda tangan asimetris (ES256/RS256), dengan jalur transisi HS256. |
| `_decode_token` | Memverifikasi dan men-decode token dari header `Authorization: Bearer`. |
| `resolve_user_role` | Satu-satunya sumber `role` yang dipercaya: membaca `profiles.role`; nilai di luar `VALID_ROLES` (`user`, `admin`) ditolak (fail-closed). |
| `get_current_user` | Dependency: gagal bila tanpa token / token tidak sah. |
| `require_admin` / `require_user` | Dependency turunan: menolak peran yang tidak cocok. |
| `get_optional_user` | Dependency opsional untuk endpoint publik yang tetap bisa dipersonalisasi (mis. daftar buku). |

`HTTPBearer(auto_error=False)` dipakai agar respons tanpa token dapat dibuat
sendiri (pesan konsisten), bukan 403 dari FastAPI.

### Evaluasi
**[Fakta]** Komentar di `app/core/supabase.py` menegaskan bahwa karena
`supabase_admin` menembus RLS, **otorisasi tidak boleh bergantung pada RLS**;
ia harus melalui dependency di `security.py`. Pola ini konsisten: semua router
admin memakai `Depends(require_admin)`.

**[Fakta]** `get_current_user` mengabaikan `role` di metadata token dan hanya
memakai `profiles.role` (diuji oleh `tests/test_security.py`,
`test_get_current_user_ignores_user_metadata_role`).

### Rekomendasi
**[Rekomendasi]** `security.py` menggabungkan verifikasi JWT, resolusi peran,
dan pembuatan objek pengguna. Ini masih wajar (SRP tingkat "auth"), tetapi bila
bertambah, pisahkan `verifier` (JWT → klaim) dan `role_resolver` (klaim → peran).

---

## 4. `supabase.py`

### Fakta
Dua klien dibuat saat impor:

- `supabase_admin` — memakai service role; **melewati RLS**; dipakai service backend.
- `supabase_anon` — memakai anon key; **tunduk RLS**; dipakai alur login/registrasi di `app/api/v1/auth.py`.

### Evaluasi
**[Evaluasi]** Global seperti ini sulit diganti per-request dan menuntut
monkeypatch di tes. Namun ia juga yang membuat service PostgREST bisa stateless
(`CategoryService`, `PromoService`, ...).

### Rekomendasi
**[Rekomendasi]** Bungkus dalam dependency `get_supabase()` agar bisa di-override
dengan `app.dependency_overrides` seperti `get_db` — bertahap, mulai dari
service yang sudah menerima dependensi lewat konstruktor.

---

## 5. `errors.py`

### Fakta
```python
# app/core/errors.py
SERVICE_ERRORS = (
    ValueError,
    KeyError,
    TypeError,
    APIError,
    StorageApiError,
    httpx.HTTPError,
    RuntimeError,
)
```
Dokumen modul menjelaskan alasannya: `except Exception` menelan bug
pemrograman; tuple ini hanya mencakup kegagalan input pengguna serta klien
Supabase/HTTP/storage.

### Evaluasi
**[Evaluasi]** Memasukkan `TypeError` berarti bug pemrograman berwujud
`TypeError` akan tampil sebagai HTTP 400, bukan 500. Ini kekurangan yang
**disadari** tim (dijelaskan di docstring) dan ditukar dengan kenyamanan
menangkap error klien Supabase.

### Rekomendasi
**[Rekomendasi]** Pertimbangkan `except (ValueError, KeyError, APIError, StorageApiError, httpx.HTTPError) as e` di router baru, dan biarkan `TypeError`/`RuntimeError` menjadi 500. Alternatif yang lebih bersih: definisikan error domain per fitur (seperti `CommunityError`, `RewardsError`, `PaymentError`) yang memang sudah dipakai di fitur baru.

---

## 6. `clock.py`

### Fakta
```python
# app/core/clock.py
STORE_TZ = timezone(timedelta(hours=7), name="WIB")

def store_now() -> datetime:
    """Waktu sekarang menurut zona waktu toko (WIB)."""
    return datetime.now(STORE_TZ)
```
Offset tetap (bukan `zoneinfo`) karena image server Windows tidak selalu membawa
tzdata. Alasan tersebut ditulis di docstring modul.

### Evaluasi
**[Evaluasi]** Ini contoh kecil **abstraction**: kode bisnis tidak memanggil
`datetime.now()` langsung sehingga zona waktu dapat diganti di satu titik.

---

## 7. `shipping.py`

### Fakta
`SHIPPING_OPTIONS: dict[str, tuple[str, str, int]]` (id → kurir, layanan, tarif)
dan `resolve(option_id) -> tuple[str, str, float]` yang melempar `ValueError`
untuk id tak dikenal. Docstring menegaskan backend adalah **sumber kebenaran**
`courier`, `courier_service`, dan `shipping_cost` pesanan — bukan payload klien.

### Evaluasi
**[Evaluasi]** Pemetaan statis adalah keputusan sadar (ada komentar `ponytail:`
di kode). Tidak ada ketergantungan API kurir.

### Rekomendasi
**[Rekomendasi]** Bila kelak memakai API kurir, ekstrak ke `ShippingProvider`
(Protocol) + `FlatRateProvider` implementasi saat ini — tanpa mengubah router.

---

## 8. `uploads.py`

### Fakta
Tipe berkas ditentukan **dari isi** (magic bytes), bukan header
`Content-Type`. Mendukung JPEG, PNG, dan WebP (`RIFF....WEBP`). Batas ukuran
`MAX_FILE_SIZE = 5 * 1024 * 1024`.

```python
# app/core/uploads.py
def validate_image(data: bytes, declared_content_type: str | None) -> tuple[str, str]:
    if len(data) > MAX_FILE_SIZE:
        raise ValueError("Ukuran berkas terlalu besar. Maksimal 5MB.")
    ...
```

Dipakai bersama oleh unggahan sampul produk dan bukti pembayaran agar batas
berkas tidak berbeda diam-diam (alasan ini tertulis di docstring).

### Evaluasi
**[Evaluasi]** Ini contoh terbaik *reuse* di paket `core`: satu fungsi murni
dipakai dua fitur berbeda.

---

## 9. Kesimpulan paket

- **[Fakta]** `app/core` berisi konfigurasi, keamanan, klien DB eksternal,
  pemetaan error, dan util murni.
- **[Evaluasi]** Batas paketnya sehat: tidak ada impor naik ke layer API/service,
  sehingga dapat diuji sendiri.
- **[Rekomendasi]** Prioritas: (1) jadikan `supabase_admin` dapat di-inject,
  (2) sempitkan `SERVICE_ERRORS` untuk router baru. *(Docstring usang yang semula
  disebut di sini ternyata berada di `app/db/` dan sudah diperbarui — lihat doc
  03.)*
