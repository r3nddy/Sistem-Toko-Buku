# 04 — Paket `app/models/`

`app/models/` berisi **model ORM SQLAlchemy** — representasi Python dari tabel
yang diakses lewat `AsyncSession`. Berbeda dari `app/core/supabase.py`
(PostgREST), model di sini hanya mencakup tabel yang memang butuh transaksi ORM.

---

## 1. Prinsip yang tertulis di paket (fakta)

Docstring `app/models/__init__.py` (diperbarui 2026-10-30):

> "Sebagian besar tabel lain yang dipakai aplikasi (`orders`, `order_items`,
> `payments`, `payment_proofs`, `payment_audit_logs`, `carts`, `cart_items`)
> dibaca lewat PostgREST di `app.core.supabase` dan karena itu **tidak** punya
> model di sini. `categories` dibaca lewat PostgREST di
> `app/services/category_service.py` dan lewat SQL eksplisit di
> `app/services/advisor/catalog.py`. Jadi daftar model ini sengaja tidak
> mencerminkan seluruh skema database."

**[Fakta]** Semua model mewarisi `Base` (`app/db/base.py`) dan seluruh tabel
berada di schema `"public"`.

---

## 2. Struktur dan tabel

| Berkas | Kelas → tabel | Catatan |
|--------|---------------|---------|
| `__init__.py` | — | Mengimpor semua model sekaligus (penting agar `Base.metadata` lengkap) dan mengekspor konstanta + kelas di `__all__`. |
| `book.py` | `Book` → `books` | `ck_books_price_nonnegative`, `ck_books_stock_nonnegative`. |
| `profile.py` | `Profile` → `profiles` | `ck_profiles_role` (`user`/`admin`); FK ke `auth.users.id` dengan `use_alter=True`; `username` nullable (indeks unik parsial di DB); kolom `points` (cache saldo). |
| `promo.py` | `Promo` → `promos` | Status promo **dihitung**, bukan kolom; 6 check constraint (tipe diskon, nilai, min belanja, kuota, terpakai, rentang tanggal). |
| `community.py` | `ChatGroup` → `chat_groups`; `ChatGroupMember` → `chat_group_members`; `ChatMessage` → `chat_messages`; `ChatMessageHelpfulMark` → `chat_message_helpful_marks` | Konstanta `GROUP_CATEGORIES`, `GROUP_VISIBILITIES`, `MEMBER_ROLES`, `MESSAGE_TYPES`, `MODERATION_STATUSES`; check constraint dibangun dari konstanta tersebut. Mark: PK komposit (`message_id`, `user_id`). |
| `marketplace.py` | `MarketplaceSource` → `marketplace_sources`; `MarketplacePrice` → `marketplace_prices` | `MARKETPLACE_SLUGS` (11 slug), `MOCK_SLUGS` (`demo_store_a/b/c`); tabel harga bersifat *append-only*; indeks `ix_marketplace_prices_book_marketplace_fetched`. |
| `review.py` | `Review` → `reviews` | `REVIEW_STATUSES = ("pending", "approved", "rejected", "rewarded")`; check rating, panjang isi, status. |
| `rewards.py` | `PointTransaction` → `point_transactions`; `RewardActivity` → `reward_activities`; `RewardRule`; `RewardRuleAudit`; `AIReviewGeneration` | Konstanta `TRANSACTION_TYPES`, `SOURCE_TYPES`, `ACTIVITY_TYPES`, `ACTIVITY_STATUSES`; check tipe/sumber/saldo. |

---

## 3. Pola OOP yang dipakai (fakta)

### a. Inheritance dari `Base`
```python
# app/models/book.py
class Book(Base):
    __tablename__ = "books"
```
Seluruh kelas di atas memakai pola ini. Warisan tunggal dari satu kelas dasar
deklaratif.

### b. Konstanta → SQL check
```python
# app/models/community.py
MEMBER_ROLES = ("owner", "moderator", "member")
...
_ROLE_CHECK = ", ".join(f"'{value}'" for value in MEMBER_ROLES)
```
**[Fakta]** Nilai yang sah didefinisikan **sekali** sebagai tuple Python lalu
dirakit menjadi SQL `CHECK`. Ini mencegah daftar nilai tersebar di model, migrasi,
dan schema.

### c. FK ke `auth.users` dengan `use_alter=True`
**[Fakta]** `Profile` dan tabel community memberi FK ke `auth.users.id` dengan
`use_alter=True` (FK dibuat terpisah setelah tabel). `auth.users` **tidak**
didaftarkan ke `Base.metadata` (dikelola Supabase).

**[Evaluasi]** Keputusan ini konsisten dengan catatan proyek sebelumnya ("jangan
daftarkan `auth.users` ke metadata"). Bila didaftarkan, Alembic akan mencoba
membuat tabel `auth.users` sendiri.

---

## 4. Ketidaksesuaian model ↔ migrasi (fakta)

Ditemukan saat membaca `app/models/rewards.py`, `app/models/community.py`, dan
`migrations/versions/`:

| Temuan | Bukti |
|--------|-------|
| `TRANSACTION_TYPES` di `rewards.py` **tidak** memuat `ai_chat_charge`, dan `SOURCE_TYPES` tidak memuat `ai_chat`, padahal migrasi `20261020_12_advisor_message_cost.py` menambahkannya ke check constraint DB. | Baca `app/models/rewards.py` baris 35–46 vs migrasi 12. |
| `ChatMessage` mendefinisikan `ck_chat_messages_moderation_status` (memakai `moderation_status`), tetapi kolom itu baru ditambahkan migrasi `20261019_11` — bukan di `20261019_10` yang membuat tabel. | Baca `app/models/community.py` vs migrasi 10 dan 11. |

**[Evaluasi]** Model dipakai hanya untuk membaca/menulis kolom yang biasa; check
constraint model hanya relevan bila Alembic membuat tabel dari nol. Karena DB
live dibangun dari migrasi, ketidaksesuaian ini tidak memicu error runtime,
tetapi **menyesatkan pembaca**.

**[Rekomendasi]** (1) tambahkan `ai_chat_charge` dan `ai_chat` ke konstanta
`rewards.py`; (2) pindahkan check `moderation_status` ke migrasi 10 atau
dokumentasikan bahwa kolom datang dari 11. Jalankan `alembic revision --autogenerate`
di DB kosong sebagai pemeriksaan. **Belum dilakukan** karena aturan tugas.

---

## 5. Kesimpulan paket

- **[Fakta]** 13 kelas model untuk 13 tabel (9 domain).
- **[Evaluasi]** Struktur konsisten (satu berkas per domain, konstanta → check),
  mudah dipindai.
- **[Rekomendasi]** Samakan konstanta dengan vocabulary DB; tambahkan tes kecil
  yang membandingkan tuple konstanta dengan check constraint di migrasi.
