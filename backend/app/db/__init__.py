"""Lapisan database SQLAlchemy.

- `base` — `Base` deklaratif untuk seluruh model.
- `session` — engine async, pabrik sesi, dan dependency `get_db`.

`get_db` dipakai endpoint `books`, `community`, `reviews`, `marketplaces`, `ai`,
dan `book_advisor` (beserta repository ORM yang mereka susun). Service CRUD
sederhana dan laporan tetap mengakses Supabase lewat `app.core.supabase`
(PostgREST). Rincian pembagiannya ada di docstring `app/db/session.py`.
"""
