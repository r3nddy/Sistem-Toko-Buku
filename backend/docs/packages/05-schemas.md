# 05 — Paket `app/schemas/`

`app/schemas/` berisi **model Pydantic** untuk validasi request dan pembentukan
response API. Ini **bukan** model database — model ORM ada di `app/models/`.

---

## 1. Bedanya dengan `app/models` (fakta)

Docstring `app/schemas/__init__.py`:

> "Schema di sini **bukan** model database: model SQLAlchemy ada di
> `app.models`, sedangkan tabel yang dibaca lewat PostgREST tidak memiliki model
> dan direpresentasikan sebagai dict oleh service."

| Pertanyaan | `app/models` | `app/schemas` |
|-----------|--------------|---------------|
| Dipakai oleh | SQLAlchemy (`select`, `insert`) | FastAPI (parsing body, `response_model`, OpenAPI) |
| Sumber data | Tabel (ORM) | Body request / dict service / objek ORM |
| Validasi | *DB constraint* (`CHECK`, `UNIQUE`) | Validator Pydantic |
| Contoh | `Book`, `Profile` | `BookCreate`, `BookRead` |

**[Fakta]** Salah satu cara "menjembatani" keduanya:
`BookRead.model_config = ConfigDict(from_attributes=True)` (di `app/schemas/book.py`),
sehingga objek ORM `Book` dapat dipakai sebagai response model.

---

## 2. Struktur per berkas

| Berkas | Isi utama | Dipakai router |
|--------|-----------|----------------|
| `__init__.py` | Re-export `BookCreate`, `BookPage`, `BookRead`, `BookUpdate` | — |
| `common.py` | `ApiResponse[T]`, `PaginationMeta`, `PaginatedResponse[T]` (generic PEP 695) | Semua router |
| `auth.py` | `LoginRequest`, `RegisterRequest`, `UserProfileResponse`, `TokenResponse` | `auth.py` |
| `book.py` | `normalize_isbn()`, `BookCreate`, `BookUpdate`, `BookRead`, `BookPage` | `books.py` |
| `category.py` | `CategoryBase`, `CategoryCreate`, `CategoryUpdate`, `CategoryResponse` | `categories.py` |
| `promo.py` | `DiscountType`, `PromoStatus`, `PromoBase`, `PromoCreate`, `PromoUpdate`, `PromoResponse` | `promos.py` |
| `cart.py` | `CartItemAdd`, `CartItemUpdate`, `CartMergeItem`, `CartMergeInput`, `CartItemResponse`, `CartResponse` | `cart.py` |
| `order.py` | `OrderStatus`, `OrderCustomer`, `OrderAddress`, `OrderItemBase`, `OrderItemResponse`, `OrderCreate`, `OrderStatusUpdate`, `OrderResponse` | `orders.py`, `payments.py` |
| `payment.py` | `PaymentStatusView`, `PaymentProofStatus`, `PaymentProofRead`, `PaymentRead`, `PaymentAdminListItem`, `PaymentDetailRead`, `RejectPaymentRequest` | `payments.py` |
| `inventory.py` | `StockMovementType`, `StockAdjustmentRequest`, `StockMovementResponse`, `LowStockBookResponse` | `inventory.py` |
| `dashboard.py` | `DashboardKpi`, `SalesTimeseriesItem`, `CategorySalesSummary`, `MonthlyReportItem` | `dashboard.py` |
| `review.py` | `ReviewCreate`, `ReviewUpdate`, `ReviewModeration`, `ReviewAuthor`, `ReviewRead`, `ReviewSummary`, `ReviewPage`, `ReviewQueuePage` | `reviews.py` |
| `rewards.py` | `PointTransactionRead`, `PointTransactionPage`, `SpoilerAccessRead`, `RecentReward`, `RewardsMe`, `RewardRuleRead`, `RewardRulesRead`, `RewardRulesUpdate`, `AdminAdjustmentRequest`, `BackfillReport`, `ReconcileReport`, `RewardActivityRead`, `RewardActivityPage`, `AIReviewGenerateRequest`, `AIReviewSummary`, `AIReviewGenerationRead` | `rewards.py`, `ai.py`, `admin_rewards.py`, `books.py` |
| `ai_review.py` | `SpoilerLevel`, `AIReviewRequest`, `AIReviewResponse` | `ai.py`, `books.py` |
| `marketplace.py` | `MarketplaceSlug` (`Literal[11 slug]`), `PriceSource`, `MarketplaceSourceCreate`, `MarketplaceSourceUpdate`, `MarketplaceSourceRead`, `MarketplacePriceRead`, `MarketplaceHistoryPoint`, `MarketplaceComparisonResponse`, `MarketplaceInfo` | `marketplaces.py` |
| `price_validation.py` | `ValidationStatus`, `ProductMatchStatus`, `PriceAssessment`, `AIValidationStatus`, `PriceStatistics`, `DetectedProductAttributes`, `DeterministicEvaluation`, `AICandidateAssessment`, `AIValidationResult`, `ValidatedMarketplaceQuote` | `marketplace/deterministic_validator.py`, `marketplace.py` |
| `community.py` | `GroupCategory`, `GroupVisibility`, `MemberRole`, `MessageType` + 19 model (`GroupCreate` ... `DeleteResult`) | `community.py` |
| `advisor_preferences.py` | `AdvisorPreferenceUpdate` | `book_advisor.py` |
| `book_advisor.py` | `ReadingLevel`, `PreferredStyle`, `PreferredLength`, `ConversationState`, `AdvisorOutcome`, `ModelSource`, `BookPreferences`, `PreferenceDelta`, `CandidateBook`, `Recommendation`, `AdvisorChatRequest`, `AdvisorChatResponse`, `AdvisorMessage`, `AdvisorSessionRead`, `AdvisorFeedbackRequest`, `AdvisorFeedbackResponse` | `book_advisor.py` + seluruh `advisor/` |

---

## 3. Pola terpenting (fakta)

### a. Envelope seragam
```python
# app/schemas/common.py
class ApiResponse[T](BaseModel):
    ...
class PaginatedResponse[T](BaseModel):
    ...
```
**[Fakta]** Generik PEP 695: `ApiResponse[list[CategoryResponse]]`,
`PaginatedResponse[PaymentAdminListItem]`. Satu bentuk respons untuk semua
endpoint, `data` diganti tipe isinya.

### b. Validasi di level field → `@field_validator`
Contoh: `BookCreate` menolak judul/pengarang kosong (`reject_blank`) dan
menormalkan ISBN (`canonicalize_isbn` / `normalize_isbn`).

### c. Validasi lintas field → `@model_validator(mode="after")`
Contoh: `BookUpdate`/`GroupUpdate`/`AdvisorPreferenceUpdate` memakai
`require_change` untuk menolak PATCH kosong.

### d. Inheritance pada schema
`CategoryCreate(CategoryBase)` dan `CategoryResponse(CategoryBase)`;
`PromoCreate(PromoBase)`; `GroupDetail(GroupSummary)`; `AIReviewGenerationRead(AIReviewSummary)`.

### e. Enum sebagai `str, Enum`
`GroupCategory`, `MemberRole`, `SpoilerLevel`, ... — nilai JSON-nya string, tetapi
divalidasi ke anggota enum.

### f. Batas nilai dengan `Field(...)`
`OrderItemBase.quantity: gt=0, le=99`; `BookCreate.price: ge=0, max_digits=12, decimal_places=2`;
`RejectPaymentRequest.reason: min_length=10, max_length=500`.

---

## 4. Impor lintas paket yang perlu dicatat (fakta)

| Impor | Arah | Komentar |
|-------|------|----------|
| `app/schemas/community.py` → `GROUP_CATEGORIES, GROUP_VISIBILITIES, MEMBER_ROLES` dari `app/models/community.py` | schema → model | Schema sengaja memakai **konstanta** model agar nilai enum dan check DB tidak berbeda; ada `assert` saat impor. |
| `app/schemas/rewards.py` `RewardRulesUpdate._validate` → `RULES_BY_KEY` dari `app/services/rewards/rule_catalog.py` | schema → service | Import **lokal di dalam validator** (bukan level modul) untuk menghindari siklus impor. |
| `app/services/marketplace/deterministic_validator.py` → `normalize_isbn` dari `app/schemas/book.py` | service → schema | Helper domain (`normalize_isbn`) tinggal di modul schema. |

**[Evaluasi]** Dua baris terakhir adalah *dependency inversion* yang tidak
sempurna: nilai/helper milik domain tersimpan di paket schema. Konsekuensinya,
paket service bergantung pada paket schema.

**[Rekomendasi]** Pindahkan `normalize_isbn` dan `RULES_BY_KEY` ke modul domain
murni (mis. `app/services/isbn.py`, sudah ada `rule_catalog.py` di domain
rewards), lalu schema mengimpor dari sana. Untuk `community.py`, impor konstanta
dari model sudah tepat.

---

## 5. Evaluasi umum

**[Evaluasi]** Validasi cukup ketat dan konsisten; hampir semua batas angka
berasal dari `Field`/validator, bukan dari router. Dua schema cukup besar:
`community.py` (317 baris, 23 kelas) dan `book_advisor.py` (309 baris).

**[Rekomendasi]** Pecah `community.py` menjadi `community_group.py`,
`community_member.py`, `community_message.py` bila bertambah lagi — tidak
mengubah API karena nama impor di router tetap bisa diarahkan ulang.

---

## 6. Kesimpulan

- **[Fakta]** 18 modul schema, 132 kelas/top-level ekspor.
- **[Evaluasi]** Pemetaan satu schema per resource jelas, envelope generik memudahkan
  frontend.
- **[Rekomendasi]** Kurangi impor schema → service; jaga ukuran modul schema.
