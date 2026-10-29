# 01 — Paket `api/` dan `app/api/` (Layer HTTP)

Paket ini adalah **layer HTTP**: menerima request, memvalidasi lewat schema,
memeriksa identitas/peran, memanggil service, dan menerjemahkan error domain ke
`HTTPException`. Tidak ada aturan bisnis di sini.

---

## 1. Struktur

| Path | Isi |
|------|-----|
| `api/index.py` | Entrypoint Vercel (dibahas di doc 00) |
| `app/api/__init__.py` | Docstring paket (7 baris) |
| `app/api/v1/__init__.py` | Docstring "Endpoint versi 1 (`/api/v1`)" |
| `app/api/v1/*.py` | **18 modul router** |

---

## 2. Router: prefix, tag, otorisasi

**[Fakta]** Daftar router dan cara didaftarkan (`app/main.py`):

| Modul | `APIRouter(...)` | Pemakai otorisasi | Catatan |
|-------|------------------|-------------------|---------|
| `auth.py` | `prefix="/auth"`, `tags=["Autentikasi"]` | Publik (`login`, `register`); `get_current_user` di `/me` | Memakai `supabase_anon` untuk login/registrasi |
| `books.py` | `prefix="/books"`, `tags=["books"]` | Publik + `require_admin` untuk tulis | Satu-satunya jalur ORM penuh; ada fallback PostgREST |
| `categories.py` | `prefix="/categories"`, `tags=["Kategori"]` | Publik baca, `require_admin` tulis | Memanggil singleton `category_service` langsung |
| `promos.py` | `prefix="/promos"`, `tags=["Promo"]` | `require_admin` semua | Promo belum diterapkan ke checkout |
| `cart.py` | `prefix="/cart"`, `tags=["Keranjang"]` | `require_user` semua | Admin ditolak |
| `orders.py` | `prefix="/orders"` + `shipping_router` `prefix="/shipping-options"` | `require_user` / `require_admin` | Dua router, satu berkas |
| `inventory.py` | `prefix="/inventory"`, `tags=["Inventori & Stok"]` | `require_admin` semua | Pergerakan stok |
| `dashboard.py` | `prefix="/dashboard"`, `tags=["Dashboard & Laporan"]` | `require_admin` semua | KPI/laporan |
| `uploads.py` | `prefix="/uploads"`, `tags=["Unggah Berkas"]` | `require_admin` | Validasi gambar via `app/core/uploads.py` |
| `marketplaces.py` | `APIRouter(tags=["marketplace"])` (tanpa prefix) | Campuran | Path: `/books/{id}/marketplace-prices`, `/marketplaces`, `/marketplace-sources` |
| `community.py` | `prefix="/community"`, `tags=["community"]` | Publik baca + user + admin | Grup, anggota, pesan |
| `reviews.py` | `APIRouter(tags=["reviews"])` (tanpa prefix) | Campuran | Path: `/books/{id}/reviews`, `/reviews/*`, `/admin/reviews` |
| `rewards.py` | `prefix="/rewards"`, `tags=["rewards"]` | `require_user` | Saldo & transaksi poin |
| `ai.py` | `prefix="/ai"`, `tags=["ai"]` | `require_user` | Ulasan AI berbayar |
| `admin_rewards.py` | `prefix="/admin/rewards"`, `tags=["admin-rewards"]` | `require_admin` | Aturan, penyesuaian, backfill, reconcile |
| `payments.py` | `router` `prefix="/orders"` + `admin_router` `prefix="/admin/payments"` | `require_user` / `require_admin` | Dua router, satu berkas |
| `book_advisor.py` | `prefix="/book-advisor"`, `tags=["book-advisor"]` | `require_user` untuk chat | Sesi in-memory |

**[Fakta]** Prefix `/api/v1` **tidak** ditulis di masing-masing router; ia
ditambahkan saat `app.include_router(..., prefix=settings.API_V1_PREFIX)`.
Alasan: bila versi berubah, hanya satu tempat yang diubah.

---

## 3. Pola dependency yang dipakai (fakta)

### a. Alias tipe `Annotated`
```python
# app/api/v1/community.py
CurrentUser = Annotated[UserPayload, Depends(get_current_user)]
Db = Annotated[AsyncSession, Depends(get_db)]
...

# app/api/v1/payments.py
User = Annotated[UserPayload, Depends(require_user)]
Admin = Annotated[UserPayload, Depends(require_admin)]
```
Daftar lengkap alias: `Admin`, `Customer`, `User`, `CurrentUser`, `Db`, `RewardsSvc`,
`GroupSvc`, `MemberSvc`, `MessageSvc`, `ReviewSvc`.

### b. Dependency pada dependency
```python
# app/api/v1/community.py
def get_member_service(
    db: Db, groups: Annotated[GroupService, Depends(get_group_service)]
) -> MemberService:
    return MemberService(groups, OrmMemberRepository(db))
```
`MemberService` menerima `GroupService` yang secara otomatis disuntik oleh FastAPI.

### c. Provider yang menerima `get_db` (service dengan sesi per-request)
```python
# app/api/v1/marketplaces.py
def comparison_service(db: Annotated[AsyncSession, Depends(get_db)]) -> MarketplaceComparisonService:
    return build_service(
        OrmMarketplaceSourceRepository(db),
        OrmMarketplacePriceRepository(db),
    )
```
Komentar di kode: "Inilah satu-satunya tempat repository nyata disusun; pengujian
meng-override dependency ini untuk menyuntikkan repository palsu — tanpa database."

### d. Provider yang mengembalikan singleton
```python
# app/api/v1/rewards.py
def get_rewards_service() -> RewardsService:
    """Provider terpisah agar tes dapat menyuntikkan ledger/repository palsu."""
    return rewards_service
```
Pola yang sama di `admin_rewards.py`, `ai.py`, dan `book_advisor.py` (masing-masing
punya `get_rewards_service` lokal).

### e. `app.add_api_route` untuk alias
```python
# app/main.py
app.add_api_route(f"{settings.API_V1_PREFIX}/me", auth.get_my_profile, methods=["GET"], tags=["Autentikasi"])
```
**[Fakta]** Alias `/api/v1/me` ditambahkan supaya klien frontend yang memanggil
`/me` tetap berfungsi; `/api/v1/auth/me` tetap ada.

---

## 4. Penanganan error di layer ini

| Pola | Contoh | Makna |
|------|--------|-------|
| `except SERVICE_ERRORS as e: raise HTTPException(400, ...)` | `categories.py`, `cart.py`, `promos.py`, `inventory.py`, `orders.py` | Error input/klien DB → 400 |
| `except CommunityError as exc: raise _http(exc)` | `community.py`, `reviews.py` | Error domain → status dari error |
| `except RewardsError as exc: raise _http(exc)` | `rewards.py`, `ai.py`, `admin_rewards.py`, `book_advisor.py` | Sama, untuk domain rewards |
| `except PaymentError as exc: raise http_error(exc)` | `payments.py` | Sama, untuk domain pembayaran |
| `except OrderTransitionError` / `PromoNotFound` | `orders.py`, `promos.py` | Status transisi tidak sah / 404 |
| `except IntegrityError → _is_isbn_conflict → 409` | `books.py` | Bentrok ISBN |
| `except DB_UNREACHABLE → fallback PostgREST` | `books.py` | Hanya kegagalan lapisan DB |

**[Fakta]** `_http()` / `_ok()` adalah helper **di dalam modul router**, bukan
di `app/core`. Fungsi kecil ini muncul di banyak berkas dengan implementasi
hampir sama (`HTTPException(status_code=exc.status_code, detail=exc.detail)`
dan `ApiResponse(sukses=True, pesan=..., data=data)`).

**[Evaluasi]** Duplikasi kecil namun nyata.

**[Rekomendasi]** Pindahkan `_http` dan `_ok` ke satu modul bersama
(mis. `app/api/v1/_helpers.py`) agar perilakunya konsisten satu sumber.

---

## 5. Evaluasi spesifik beberapa modul

### `books.py` (297 baris)
**[Fakta]** Berisi logika jalur baca ORM → fallback PostgREST
(`load_book_for_read`), helper ISBN (`_is_isbn_conflict`), dan endpoint CRUD +
ulasan AI lama (`deprecated=True`). Alur tulisnya:

```python
# inti create_book (disederhanakan dari app/api/v1/books.py)
book = Book(**data)
db.add(book)
await db.flush()
await OrmMarketplaceSourceRepository(db).create_many_if_absent(build_default_source_rows(...))
await db.commit()
```
`IntegrityError` dari `flush()`/`commit()` diterjemahkan ke 409 bila
`_is_isbn_conflict` benar.

**[Evaluasi]** Menggabungkan "cara membaca buku" (dipakai modul lain) dengan
endpoint katalog membuat `books.py` menjadi utilitas tidak resmi.

### `marketplaces.py` (309 baris)
**[Fakta]** Mengimpor dari `books.py`:
```python
from app.api.v1.books import DB_UNREACHABLE, load_book_for_read
```
Dengan alasan yang tertulis di docstring modul: alur baca buku harus konsisten.

**[Evaluasi]** Ketergantungan router→router adalah *code smell* kecil. Bila
`books.py` berubah, `marketplaces.py` ikut berisiko.

**[Rekomendasi]** Pindahkan `load_book_for_read` dan `DB_UNREACHABLE` ke
`app/services/book_service.py` (atau modul `app/api/v1/_book_reader.py`) lalu
impor dari sana. Tidak mengubah perilaku API.

### `community.py` (464 baris)
**[Fakta]** `community.py` berisi 19 dekorator route, provider service
(`get_group_service`, `get_member_service`, `get_message_service`), hook reward
(`_reward_contribution`, `_reward_helpful`), dan memakai `SendRateLimiter` dari
`app/services/community/rate_limit.py`.

**[Evaluasi]** Modul terbesar di layer API. Struktur internalnya masih terbaca
(provider → helper → endpoint), tetapi memuat tiga resource.

**[Rekomendasi]** Bila bertambah, pecah per resource (`community_groups.py`,
`community_members.py`, `community_messages.py`) dengan satu router gabungan
`include_router` di `community.py` — path API tidak berubah.

### `auth.py`, `uploads.py`, `dashboard.py`, `inventory.py`
**[Fakta]** Tipis: validasi, otorisasi, panggil service, bungkus respons.
`auth.py` adalah satu-satunya router yang memakai `supabase_anon`.

---

## 6. Kesimpulan paket

- **[Fakta]** 18 modul router (total ±2.960 baris), **97 dekorator route**
  (`@router.get/post/patch/put/delete` dan padanannya di `admin_router` /
  `shipping_router` / ...).
- **[Evaluasi]** Router rata-rata tipis dan otorisasi mudah dibaca per berkas;
  inilah kekuatan terbesar layer ini.
- **[Rekomendasi]** Prioritas: (1) satukan helper `_http`/`_ok`,
  (2) pindahkan `load_book_for_read` keluar dari `books.py`,
  (3) pecah `community.py` dan `books.py` bila fitur bertambah.
