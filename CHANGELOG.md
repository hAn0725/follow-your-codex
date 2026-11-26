# Changelog

## 0.6.3 — 2026-11-26

- Add standard short-context API-equivalent rates for GPT-6.2 Sol and GPT-6.2 Astra.
- Match desktop Codex and Work usage records to their own turn context, including usage written before the context or after a model switch.
- Rebuild the local metadata cache once so historical turn attribution uses the corrected parser.

- Refine the current monochrome dashboard with neutral theme tokens, more readable metadata, consistent panel spacing, and compact mobile actions.
- Fix 320px horizontal overflow and fit heatmaps, composition legends, and chart labels to narrow viewports.
- Align range clicking and dragging with the four visible segments while retaining native keyboard controls and descriptive accessible values.
- Add arrow-key chart exploration with one Tab entry per supported chart; keep custom tooltips within the viewport.
- Improve refreshing, disabled exports, unavailable local storage, empty-data presentation, and localized error recovery.
- Preserve GPT accounting, Terra pricing, rolling 24-hour trends, exports, and the worker-backed startup cache without adding dependencies.

## 0.6.2 — 2026-10-27

- Recognize GPT-6.1 Terra and estimate its standard short-context API-equivalent cost using $1 / $0.05 / $5 per million input / cached input / output tokens.
- Move history scanning to a worker thread so the local server remains responsive during a cold scan.
- Cache parsed usage metadata in the local temporary directory across launches, validating file size and timestamps before reuse and rebuilding from logs if the cache is unavailable or invalid.
- Continue filtering excluded providers and keeping prompts, replies, and tool output out of the cache.

## 0.6.1 — 2026-10-26

- Make the one-day range a rolling 24-hour window ending at the current request time, with 24 hourly trend buckets and exact timestamp tooltips.
- Keep summary totals, exports, and previous-period comparisons on the same rolling window; retain natural-day grouping for daily details.
- Calculate the seven-day average independently of the selected range.
- Refine neutral console styling, numeric typography, and the joined usage/capacity surface after studying codex-reset.com.
- Continue with the current interface only; remove the classic entry and bundled duplicate assets. Old classic bookmarks redirect to the current homepage; v0.6.0 and earlier Git releases remain available.

## 0.6.0 — 2026-10-26

- Rename the app, local package, reports, and exported downloads to Codex Meter.
- Refresh the main dashboard while retaining the classic interface at `/classic/index.html` and the complete `baseline-0.5.1-20261026` Git tag.
- Preserve all existing accounting, pricing, historical-log decoding, and export behavior.
- Verify local CLI 0.159.2 and observed desktop logs up to 0.164.0-alpha.11.1 without changing the parsing or pricing rules.
- Add `start-codex-meter.cmd`; keep the previous command entry point and old desktop shortcut compatible.
- Make desktop shortcut installation idempotent and use a neutral monochrome token-meter icon.

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
