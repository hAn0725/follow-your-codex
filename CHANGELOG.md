# Changelog

## 0.5.1 — 2026-10-15

- Restore historical usage from `.jsonl.zst` files created by Codex history compression, in both active and archived session trees.
- Keep reading plain JSONL and deduplicate compressed/uncompressed copies.
- Surface read/decompression failures in both languages instead of silently omitting history.
- Require Node.js 24+ for built-in Zstandard support; retain zero third-party runtime dependencies.
- Add regression coverage for compressed archives, copied logs, and corrupt compressed files.

## 0.5.0 — 2026-10-15

- Read both active sessions and archived sessions so archiving no longer removes historical usage from the dashboard.
- Support current `token_usage_record` per-response usage while retaining legacy `token_count` compatibility.
- Prefer modern usage per migrated turn; do not mix incompatible cumulative baselines or count mirrored records twice.
- Merge split logs for the same session and deduplicate response IDs and copied legacy events.
- Index events by session to avoid repeatedly scanning the entire event list for each session.
- Apply the GPT/Codex provider filter to prior-period comparisons as well as current totals.
- Derive the dashboard version from package metadata and show both source directories.
- Add migration, archive, duplicate, and split-session regression coverage.
