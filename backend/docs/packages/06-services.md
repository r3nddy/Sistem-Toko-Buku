# 06 — Paket `app/services/` (level atas)

`app/services/` adalah **layer bisnis**. Inilah tempat aturan aplikasi
diterapkan: menghitung total, memeriksa stok, memanggil PostgREST atau ORM,
melempar error domain. Router hanya memanggil kelas/fungsi di sini.

Isi level atas paket ini dibagi dua: **service CRUD satu tabel** (berbasis
kerangka `SupabaseTableService`) dan **service orkestrasi** (stateless, memakai
PostgREST langsung). Empat subpaket (`community/`, `marketplace/`, `rewards/`,
`advisor/`) dibahas di doc 07–10.

---

## 1. Struktur

| Berkas | Simbol utama | Jenis | Pemakai |
|--------|--------------|-------|---------|
| `__init__.py` | (*kosong selain docstring*) | — | — |
| `base.py` | `BookRepository` (ABC), `ReportService` (ABC), `SupabaseTableService` (ABC) | Kerangka | `category_service`, `promo_service`, `book_service`, `dashboard_service` |
| `book_service.py` | `OrmBookRepository`, `RestBookRepository`, `BookRepository` | Repository | `app/api/v1/books.py`, `marketplaces.py` |
| `category_service.py` | `CategoryService`, `_serialize`, `category_service` (singleton) | CRUD | `app/api/v1/categories.py` |
| `promo_service.py` | `PromoView`, `PromoNotFound`, `PromoService`, `_serialize`, `promo_service` | CRUD + hook | `app/api/v1/promos.py` |
| `cart_service.py` | `CartService`, `_uuid_or_none`(helper), `cart_service` | Orkestrasi | `app/api/v1/cart.py` |
| `order_service.py` | `OrderService`, `OrderTransitionError`, `order_service` | Orkestrasi | `app/api/v1/orders.py` |
| `inventory_service.py` | `InventoryService`, `inventory_service` | Orkestrasi | `app/api/v1/inventory.py` |
| `dashboard_service.py` | `DashboardService`, `_serialize`, `dashboard_service` | CRUD/report | `app/api/v1/dashboard.py` |
| `payment_service.py` | `PaymentService`, `PaymentError`, `payment_service` | Orkestrasi | `app/api/v1/payments.py` |
| `review_service.py` | `ReviewService` (+ error domain) | Orkestrasi ORM | `app/api/v1/reviews.py`, `app/api/v1/books.py` |
| `review_repository.py` | kelas repository ulasan (`AsyncSession`) | Repository ORM | `review_service.py`, `app/api/v1/reviews.py` |
| `ai_review_service.py` | `AIReviewService` | Orkestrasi + provider OpenRouter | `app/api/v1/ai.py` |
| `marketplace_repository.py` | `OrmMarketplaceSourceRepository`, `OrmMarketplacePriceRepository` | Repository ORM | `app/api/v1/marketplaces.py`, `app/api/v1/books.py` |

---

## 2. Empat "bentuk" service di `__init__.py` (fakta)

**[Fakta]** Docstring `app/services/__init__.py` menyebut pembagian ini secara
eksplisit; daftar di bawah memverifikasi baris-demi-baris:

| Bentuk | Ciri | Kelas |
|--------|------|-------|
| **1. CRUD berbasis kerangka** | Mewarisi `SupabaseTableService`, mengimplementasikan `_table_name`, `_serialize`, `_order_clause`, `_before_delete` | `CategoryService`, `PromoService`, `DashboardService` |
| **2. Repository** | Mewarisi ABC `BookRepository` dengan dua implementasi (ORM & REST) | `OrmBookRepository`, `RestBookRepository` |
| **3. Orkestrasi stateless** | Tidak mewarisi apa pun; memakai `supabase_admin` langsung, melempar error domain | `CartService`, `OrderService`, `InventoryService`, `PaymentService`, `AIReviewService` |
| **4. Service per-request (DI)** | Menerima repository di konstruktor; contoh paling jelas di subpaket `community/`, `marketplace/`, `rewards/`, `advisor/` | lihat doc 07–10 |

**[Evaluasi]** Pembagian ini membuat pembaca cepat tahu "service ini memakai
ORM atau PostgREST, dan di mana error-nya didefinisikan".

---

## 3. `base.py` — kerangka ABC (fakta)

```python
# app/services/base.py (potongan)
class SupabaseTableService(ABC):
    """Kerangka untuk operasi CRUD sederhana di satu tabel Supabase."""

    @property
    @abstractmethod
    def _table_name(self) -> str: ...

    @abstractmethod
    def _serialize(self, row: dict) -> Any: ...

    @abstractmethod
    def _order_clause(self) -> tuple[str, bool]:
        """(kolom, descending)"""

    def _before_delete(self, row: dict) -> None:
        """Hook opsional sebelum DELETE; default: tidak melakukan apa-apa."""
```
**[Fakta]** Metode `get_all`, `get_by_id`, `create`, `update`, `delete` sudah
disediakan kerangka dan **tidak** didefinisikan ulang oleh subclass — ini yang
diuji `tests/test_oop_contracts.py::test_inherited_framework_methods_are_not_redefined_by_subclasses`.
`_before_delete` adalah *template-method hook*: `PromoService` meng-override
untuk menolak hapus promo yang sedang aktif.

`BookRepository` (ABC) mendefinisikan kontrak `search`, `get_by_id`,
`add_or_update`, ... yang diimplementasikan `OrmBookRepository` (memakai
`AsyncSession`) dan `RestBookRepository` (memakai `supabase_admin`).

`ReportService` (ABC) mendefinisikan `get_monthly_reports` (nama metode aktual
per kontrak; lihat juga override `_serialize` di `DashboardService`).

---

## 4. Singleton modul (fakta)

```python
# app/services/category_service.py
category_service = CategoryService()
```
Pola yang sama di `promo_service.py`, `cart_service.py`, `order_service.py`,
`inventory_service.py`, `dashboard_service.py`, `payment_service.py`,
`rewards/service.py` (`rewards_service`), dan `rewards/ledger.py` (`ledger_gateway`).

**[Fakta]** Karena service ini hanya memegang referensi ke `supabase_admin`
(klien global) dan tidak menyimpan state per-pengguna, satu instance cukup.

**[Evaluasi]** Singleton memudahkan router (`from app.services.cart_service import cart_service`)
dan tes (patches `app.services.cart_service.supabase_admin`), tetapi membuat
penggantian implementasi harus lewat `app.dependency_overrides` pada fungsi
provider di router, bukan mengganti singleton.

**[Rekomendasi]** Untuk fitur baru yang memerlukan database sungguhan, ikuti
pola subpaket (repository di konstruktor + provider `Depends`), bukan menambah
singleton baru.

---

## 5. Evaluasi ukuran berkas (fakta)

Jumlah baris berkas level atas `app/services/*.py` (dihitung dengan `wc -l`):

| Berkas | Baris | Fungsi yang menumpuk |
|--------|------:|----------------------|
| `payment_service.py` | 593 | Bukti bayar, unggah Storage, approve/reject, audit |
| `order_service.py` | 456 | Total, ongkir, diskon, retry nomor order, transisi status, pemulihan stok |
| `ai_review_service.py` | 330 | Prompt, panggilan OpenRouter, validasi JSON |
| `base.py` | 320 | Tiga ABC |
| `review_service.py` | 259 | Ulasan, moderasi, hook reward |
| `cart_service.py` | 251 | Gabung keranjang, klamp stok |
| `review_repository.py` | 216 | Query ORM ulasan |
| `dashboard_service.py` | 212 | Laporan bulanan (PostgREST) |
| `marketplace_repository.py` | 186 | Query ORM marketplace |
| `promo_service.py` | 162 | CRUD + hook hapus |
| `book_service.py` | 135 | Dua repository buku |
| `inventory_service.py` | 104 | Pergerakan stok (tipis; endpoint `inventory.py` memberi `tags` "Inventori & Stok") |
| `category_service.py` | 71 | CRUD kategori |

**[Fakta]** `inventory_service.py` hanya 104 baris — lebih kecil dari perkiraan
umum. Kelas besar ada di **subpaket** (`rewards/service.py` 876 baris,
`community/repository.py` 617, `marketplace/service.py` 528, `advisor/service.py` 487).

**[Evaluasi]** `PaymentService` (593) dan `OrderService` (456) menggabungkan
banyak tanggung jawab. Bukan pelanggaran OOP (tidak ada pewarisan salah), tetapi
bertentangan dengan *Single Responsibility* pada tingkat kelas.

**[Rekomendasi]** Bila akan diubah, ekstrak fungsi murni (hitung total, hitung
ongkir, aturan transisi) ke modul pure-function seperti yang sudah dilakukan
`community/permissions.py` dan `rewards/access.py`. Ini menurunkan ukuran kelas
dan memudahkan tes tanpa DB. **Belum dilakukan** — di luar cakupan dokumen ini.

---

## 6. Cara router memakai service (fakta)

| Pola pemakaian | Contoh |
|----------------|--------|
| Impor singleton langsung | `from app.services.category_service import category_service` (`categories.py`) |
| Provider `Depends` mengembalikan singleton | `get_rewards_service()` (`rewards.py`) |
| Provider `Depends` menerima `get_db` dan menyusun repository | `comparison_service(db)` (`marketplaces.py`) |
| Fungsi provider yang menyusun beberapa service | `get_message_service(db, groups, members)` (`community.py`) |

---

## 7. Kesimpulan

- **[Fakta]** 13 modul di level atas (termasuk `__init__.py`); satu kerangka
  ABC (`base.py`) dan tiga jenis service (CRUD, repository, orkestrasi).
- **[Evaluasi]** Struktur konsisten dan terdokumentasi di docstring paket.
- **[Rekomendasi]** Pertahankan pembagian; hindari menambah singleton; pecah
  service besar dengan cara mengekstrak fungsi murni.
