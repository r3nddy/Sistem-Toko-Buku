# 09 — Paket `app/services/rewards/`

`app/services/rewards/` adalah **Book Rewards**: ledger poin, aturan reward,
akses ulasan spoiler, dan penagihan generasi AI review. Ledger-nya dipegang
oleh fungsi PostgreSQL (`apply_point_transaction`) yang dipanggil lewat RPC
PostgREST, sehingga saldo tidak pernah dihitung di Python.

---

## 1. Struktur (fakta)

| Berkas | Baris | Simbol utama | Tanggung jawab |
|--------|------:|--------------|----------------|
| `__init__.py` | — | Re-export `DEFAULT_VALUES`, `RULES`, `RULES_BY_KEY`, `RuleDefinition` | Antarmuka paket aturan |
| `rule_catalog.py` | 57 | `RuleDefinition` (dataclass frozen: `key`, `default`, `max_value`), `RULES`, `RULES_BY_KEY`, `DEFAULT_VALUES` | Satu sumber kebenaran nilai aturan |
| `access.py` | 102 | `FREE_LEVELS`, `PAID_LEVELS`, `ACCESS_FREE`, `ACCESS_PURCHASE`, `ACCESS_POINTS`, `purchase_points`, `evaluate_access` | Rumus akses spoiler, fungsi murni |
| `errors.py` | 117 | `RewardsError(status_code, code, message)` + factory `insufficient_points`, `daily_cap_reached`, `idempotency_conflict`, `reward_already_claimed`, `not_eligible`, `invalid_request`, `from_rpc_error` | Error domain + kode mesin |
| `repository.py` | 470 | `LedgerGateway` (`Protocol`), `SupabaseLedger`, `RewardsRepository`, `ledger_gateway` | Akses data + gateway RPC |
| `service.py` | 876 | `LedgerResult`, `RewardsService`, `rewards_service`, konstanta `STALE_GENERATION_AFTER`, `RECENT_REWARDS_LIMIT` | Orkestrasi seluruh alur reward |

---

## 2. Katalog aturan (fakta)

```python
# app/services/rewards/rule_catalog.py
@dataclass(frozen=True)
class RuleDefinition:
    key: str
    default: int
    max_value: int

RULES: tuple[RuleDefinition, ...] = (
    RuleDefinition("purchase_points_per_10000", 10, 1000),
    RuleDefinition("review_points", 20, 1000),
    RuleDefinition("community_contribution_points", 5, 1000),
    RuleDefinition("community_contribution_daily_cap", 2, 100),
    RuleDefinition("helpful_answer_points", 10, 1000),
    RuleDefinition("helpful_answer_daily_cap", 3, 100),
    RuleDefinition("spoiler_medium_points", 100, 100_000),
    RuleDefinition("spoiler_heavy_points", 300, 100_000),
    RuleDefinition("spoiler_medium_min_units", 1, 1000),
    RuleDefinition("spoiler_heavy_min_units", 3, 1000),
    RuleDefinition("helpful_answer_min_marks", 2, 50),
    RuleDefinition("advisor_message_points", 10, 1000),
)

RULES_BY_KEY: dict[str, RuleDefinition] = {rule.key: rule for rule in RULES}
DEFAULT_VALUES: dict[str, int] = {rule.key: rule.default for rule in RULES}
```
*(Komentar per aturan di berkas asli dihapus dari kutipan ini.)*

**[Fakta]** Docstring modul: nilai yang sama dipakai migrasi `20261019_11`,
validasi API admin, dan pembacaan default. `RewardsService.rules()` memakai
`{**DEFAULT_VALUES, **self._repo.load_rules()}` — baris DB menimpa default.

**[Evaluasi]** Ini `frozen dataclass`, bukan enum — tepat karena jumlahnya bisa
bertambah dan tiap aturan membawa dua angka (default, batas atas).

---

## 3. Ledger via `Protocol` (fakta)

```python
# app/services/rewards/repository.py
class LedgerGateway(Protocol):
    """Permukaan minimal ledger yang dipakai service dan tes."""
    def apply(self, *, user_id, delta, transaction_type, source_type, source_id,
              idempotency_key, metadata=None, created_by=None, book_id=None,
              daily_cap=None, cap_type=None) -> dict[str, Any] | None: ...

class SupabaseLedger(LedgerGateway):
    """Pemanggil RPC `apply_point_transaction` (migrasi `20261019_11`)."""
```

**[Fakta]** `RewardsService` menerima ledger dan repository lewat konstruktor:

```python
class RewardsService:
    def __init__(
        self,
        ledger: LedgerGateway | None = None,
        repository: RewardsRepository | None = None,
    ) -> None:
        self._ledger: LedgerGateway = ledger or SupabaseLedger()
        self._repo: RewardsRepository = repository or RewardsRepository()
```
Tes (`tests/test_rewards.py`) menyuntikkan `FakeLedger`/`FakeRepo`.

**[Evaluasi]** Pemakaian `typing.Protocol` (bukan ABC) tepat di sini: gateway
adalah kontrak *struktural* — `FakeLedger` tidak perlu mewarisi apa pun.

---

## 4. Error dengan kode mesin (fakta)

```python
# app/services/rewards/errors.py
class RewardsError(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        ...
    @property
    def detail(self) -> str:
        return f"{self.code}: {self.message}"

def from_rpc_error(exc: Exception) -> RewardsError | None:
    ...
```
**[Fakta]** Kode (`INSUFFICIENT_POINTS`, `DAILY_CAP_REACHED`, ...) sama dengan
kode `RAISE EXCEPTION` di RPC. `RewardsService._apply` membungkus RPC dan
menerjemahkan error lewat `from_rpc_error`.

**[Evaluasi]** "Satu kosa kata dari database sampai UI" — frontend tidak perlu
mencocokkan teks Bahasa Indonesia.

---

## 5. Metode `RewardsService` (fakta)

| Kelompok | Metode |
|----------|--------|
| Ringkasan | `rules` (dict nilai efektif), `list_rules` (`RewardRulesRead`), `get_me`, `get_balance`, `list_transactions`, `list_activities` |
| Reward aktivitas | `reward_order`, `reverse_order`, `reward_review`, `reward_contribution`, `reward_helpful_answer` |
| Admin | `update_rules`, `adjust_points`, `backfill`, `reconcile` |
| Akses spoiler | `spoiler_access` (+ `evaluate_access` di `access.py`) |
| AI review berbayar | `generate_ai_review`, `get_generation`, `list_generations`, `recover_stale_generations`, `_finish_generation`, `_refund_generation` |
| Penagihan advisor | `advisor_message_cost`, `charge_advisor_message`, `refund_advisor_message`, `find_advisor_charge` |

**[Fakta]** Semua tulis ke ledger lewat `_apply` → RPC. Tidak ada penambahan
saldo di Python; saldo `balance_after` dikembalikan oleh RPC.

---

## 6. Evaluasi & rekomendasi

| Aspek | Evaluasi | Rekomendasi |
|-------|----------|-------------|
| `service.py` 876 baris | Kelas terbesar di backend; tiga domain (reward, spoiler, AI billing) | Pecah menjadi `RewardService`, `SpoilerAccessService`, `AIBillingService` yang berbagi `LedgerGateway` |
| `access.py` | Fungsi murni, teruji (`test_purchase_points_floor_per_10000`) | Pertahankan sebagai acuan |
| `TRANSACTION_TYPES` di `app/models/rewards.py` | Belum memuat `ai_chat_charge` (doc 04) | Selaraskan dengan migrasi 12 |
| Docstring `__init__.py` | Sudah diperbarui 2026-10-30 (sebelumnya menyebut "tahap ini hanya katalog") | Pertahankan deskripsi per modul |

---

## 7. Kesimpulan

- **[Fakta]** Satu katalog aturan, satu gateway `Protocol`, satu repository,
  satu kelas service besar, satu hierarki error berkode.
- **[Evaluasi]** Pemisahan layer bersih (aturan murni vs I/O vs orkestrasi);
  masalah utama hanya ukuran kelas.
- **[Rekomendasi]** Pecah `service.py` per domain; samakan vocabulary dengan DB.
