# Changelog

## 0.5.0 — 2026-10-15

- Read both active sessions and archived sessions so archiving no longer removes historical usage from the dashboard.
- Support current `token_usage_record` per-response usage while retaining legacy `token_count` compatibility.
- Prefer modern usage per migrated turn; do not mix incompatible cumulative baselines or count mirrored records twice.
- Merge split logs for the same session and deduplicate response IDs and copied legacy events.
- Index events by session to avoid repeatedly scanning the entire event list for each session.
- Apply the GPT/Codex provider filter to prior-period comparisons as well as current totals.
- Derive the dashboard version from package metadata and show both source directories.
- Add migration, archive, duplicate, and split-session regression coverage.
