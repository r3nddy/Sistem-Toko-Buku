# 12 — `tests/` dan `scripts/`

`tests/` berisi suite pytest yang menguji perilaku API dan kontrak OOP tanpa
database sungguhan. `scripts/` berisi skrip manual (bukan bagian CI).

---

## 1. Struktur (fakta)

| Path | Isi |
|------|-----|
| `tests/__init__.py` | Penanda paket |
| `tests/conftest.py` | Satu fixture: `client` (async `httpx.AsyncClient` + `ASGITransport(app=app)`) |
| `tests/test_*.py` | **22 berkas tes** (total 23 berkas `*.py` di `tests/`) |
| `scripts/smoke_payment_bucket.py` | Uji asap manual bucket Storage privat `payment-proofs` |

```python
# tests/conftest.py
@pytest_asyncio.fixture
async def client() -> AsyncClient:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as test_client:
        yield test_client
```

**[Fakta]** `pyproject.toml` **tidak** punya `[tool.pytest.ini_options]` dan tidak
mengatur `asyncio_mode`, sehingga setiap tes `async` memakai `@pytest.mark.asyncio`
secara eksplisit.

---

## 2. Inventaris berkas tes (fakta)

| Berkas | Baris | Yang diuji |
|--------|------:|------------|
| `test_api.py` | 67 | Smoke route dasar: `/health`, daftar kategori publik, pembuatan kategori butuh admin |
| `test_auth.py` | 107 | Envelope `/api/v1/me`, `require_admin` untuk admin vs pengguna biasa |
| `test_book_advisor.py` | 796 | Book Advisor: gabungan preferensi, ranking, validasi, sesi, klien Gemini, endpoint chat/sesi/preferensi/feedback (51 tes) |
| `test_advisor_billing.py` | 555 | Penagihan poin chat advisor: idempotensi, saldo tidak negatif, refund saat provider gagal, konkurensi, penolakan admin/tamu (19 tes) |
| `test_books.py` | 379 | Schema buku, route buku, jalur baca ORM → fallback PostgREST, pemetaan konflik ISBN (22 tes) |
| `test_cart.py` | 325 | Regresi keranjang (harga stok sisi server, kepemilikan, guard UUID, klamp saat merge) |
| `test_category_response.py` | 35 | Kategori tanpa kolom opsional live schema mengembalikan default |
| `test_community.py` | 879 | Grup, pesan, izin, rate limit, pagination keyset, peran anggota (30 tes) |
| `test_community_moderation.py` | 407 | Keputusan moderasi dan tanda "membantu" (11 tes) |
| `test_cors.py` | 123 | Kebijakan CORS: loopback, LAN dev, regex Vercel, trim slash (8 tes) |
| `test_dashboard.py` | 87 | `DashboardService.get_monthly_reports` dari pesanan nyata |
| `test_health.py` | 9 | `/health` |
| `test_marketplaces.py` | 1399 | Perbandingan harga: normalisasi, cache/refresh/backoff, scraper, adapter, CRUD sumber admin, schema, adapter demo (57 tes) |
| `test_oop_contracts.py` | 263 | **Kontrak OOP**: ABC menolak instansiasi, pewarisan nyata, enkapsulasi, polimorfisme (23 fungsi tes) |
| `test_orders.py` | 707 | Checkout → siklus status: total sisi server, retry nomor order, stok, batal memulihkan stok, gerbang transisi (34 tes) |
| `test_payments.py` | 387 | Verifikasi pembayaran manual: 404 kepemilikan, jumlah dari server, unggah bukti, approve/reject, unggah ulang |
| `test_price_validation.py` | 693 | 25 skenario bernomor validasi harga deterministik + AI |
| `test_promos.py` | 207 | CRUD promo: status turunan, validasi, normalisasi kode, PATCH parsial, admin-only |
| `test_reviews.py` | 505 | Ulasan: identitas dari token, antrian moderasi, edit, reward hook (19 tes) |
| `test_rewards.py` | 737 | Ledger Book Rewards: rumus akses, reward, cap harian, admin, penagihan AI (30 tes) |
| `test_security.py` | 161 | Verifikasi JWT + RBAC: peran hanya dari `profiles`, fail-closed (12 tes) |

**[Evaluasi]** Cakupan luas: setiap paket (doc 01–10) punya minimal satu berkas
tes. Berkas terbesar (`test_marketplaces.py`) mencerminkan besarnya paket
marketplace.

---

## 3. Pola pengujian (fakta)

| Pola | Contoh |
|------|--------|
| Override dependency | `app.dependency_overrides[get_current_user]`, `[require_admin]`, `[get_db]`, provider per-fitur (`comparison_service`, `get_group_service`, `get_review_service`) |
| Bersih-bersih otomatis | Fixture autouse `clear_overrides` di berkas yang memakai override |
| Patch klien Supabase | `unittest.mock.patch("app.services.<mod>.supabase_admin")` + `MagicMock` berantai `.table().select().eq().execute()` |
| Patch JWT & peran | `monkeypatch` `security.settings.SUPABASE_JWT_SECRET` dan `security.resolve_user_role` |
| Repository palsu untuk OOP | `FakeGroupRepository`, `FakeMemberRepository`, `FakeMessageRepository`, `FakeReviewRepository`, `FakeLedger`, `FakeRepo`, `StubAdapter(MarketplaceAdapter)` |
| Fake model AI | `FakeModel`, `FailingModel`, `FakeCatalog` (advisor) |
| Dua gaya klien | Fixture `client` (async) dan `TestClient(app)` (sinkron) di beberapa berkas |

**[Evaluasi]** Pola override dependency adalah alasan utama router memakai
*fungsi provider* (bukan singleton langsung): tes bisa menyuntikkan fake tanpa
DB.

**[Rekomendasi]** Untuk endpoint baru, selalu daftarkan provider `Depends(...)`
dan tambahkan override `get_current_user` **dan** `require_*` yang sesuai —
suite `test_advisor_billing.py` menunjukkan override `get_current_user` saja
tidak melewati `require_user`.

---

## 4. `test_oop_contracts.py` (fakta)

**[Fakta]** 23 fungsi tes terbagi menjadi:

| Kelompok | Contoh tes |
|----------|------------|
| Abstraksi | `test_abstract_base_cannot_be_instantiated` (param `[SupabaseTableService, BookRepository, ReportService]`), `test_subclass_missing_an_abstract_method_is_still_rejected` |
| Enkapsulasi | `test_private_table_name_is_inaccessible_from_outside`, `test_table_name_property_is_read_only`, `test_promo_view_hides_its_raw_row` |
| Polimorfisme / template method | `test_get_all_dispatches_to_each_subclass_serializer`, `test_promo_delete_hook_runs_before_the_framework_delete` |
| Regresi kontrak | `test_inherited_framework_methods_are_not_redefined_by_subclasses`, `test_search_term_is_shared_by_both_book_repositories` |

---

## 5. `scripts/smoke_payment_bucket.py` (fakta)

**[Fakta]** Skrip manual (bukan pytest):

1. Membuat klien Supabase dengan URL + service role key dari `.env` (`load_dotenv`).
2. Mengunggah PNG 1×1 ke bucket `payment-proofs`.
3. Membuat *signed URL* (60 detik), mengunduh, mencocokkan byte.
4. Memastikan URL publik mengembalikan status ≥ 400 (bucket tidak bocor).
5. Menghapus objek.

Cara jalan: `uv run python scripts/smoke_payment_bucket.py`.
**[Fakta]** Menyentuh Storage **live**; tidak bagian CI. Jangan dijalankan tanpa
izin.

---

## 6. Konfigurasi tes (fakta)

| Berkas | Isi relevan |
|--------|-------------|
| `pyproject.toml` | `[project]` Python ≥3.12; dev group: `pytest>=8.4.2`, `pytest-asyncio>=1.2.0`, `ruff>=0.13.0`; `[tool.ruff]` `target-version = "py312"`, `lint.ignore = ["B008"]`, per-file-ignores `BLE001` untuk 4 berkas kode |
| `requirements.txt` | Pin runtime untuk Vercel; **tidak** memuat `pytest`/`ruff`/`alembic`/`uvicorn` |
| `.vercelignore` | Mengecualikan `tests/`, `scripts/`, `migrations/`, `alembic.ini`, `.env*` dari bundel serverless |

---

## 7. Evaluasi & rekomendasi

| Aspek | Evaluasi | Rekomendasi |
|-------|----------|-------------|
| `asyncio_mode` | Tidak diaktifkan; setiap tes async perlu marker manual | Tambahkan `[tool.pytest.ini_options] asyncio_mode = "auto"` agar marker tidak terlupa (`asyncio_default_fixture_loop_scope` juga disarankan) |
| Monkeypatch global | Beberapa tes mem-patch `supabase_admin` di modul service | Preferem dependency override untuk kode baru |
| `test_marketplaces.py` 1399 baris | Sangat besar | Pecah per topik (adapter / service / endpoint) |
| Skrip smoke | Manual, menyentuh live | Dokumentasikan di README dengan peringatan eksplisit |

---

## 8. Kesimpulan

- **[Fakta]** 22 modul tes, satu `conftest.py`, satu `__init__.py`, satu skrip
  manual.
- **[Evaluasi]** Cakupan kuat dan memakai DI yang benar; `test_oop_contracts.py`
  memberi bukti terukur untuk klaim OOP.
- **[Rekomendasi]** Aktifkan mode asyncio otomatis; pecah berkas tes besar.
