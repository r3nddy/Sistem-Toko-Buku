"""Paket Book Rewards.

Berisi seluruh alur poin:

- `rule_catalog` — katalog aturan yang boleh diubah admin (satu sumber nilai
  default dan batas atas).
- `access` — rumus akses ulasan spoiler (fungsi murni).
- `errors` — `RewardsError` dengan kode mesin yang sama dengan RPC database.
- `repository` — `LedgerGateway` (`Protocol`), `SupabaseLedger` (pemanggil RPC
  `apply_point_transaction`), dan `RewardsRepository`.
- `service` — `RewardsService`, orkestrasi reward aktivitas, penyesuaian admin,
  penagihan AI review, dan penagihan pesan Book Advisor.

Pengguna impor berikutnya cukup memakai `app.services.rewards.service`; ekspor
di bawah dipertahankan agar jalur impor lama tetap berjalan.
"""

from app.services.rewards.rule_catalog import (
    DEFAULT_VALUES,
    RULES,
    RULES_BY_KEY,
    RuleDefinition,
)

__all__ = ["DEFAULT_VALUES", "RULES", "RULES_BY_KEY", "RuleDefinition"]
