# Codex Meter v0.6.1 verification

Verified locally on 2026-10-26.

- All 18 tests pass, including exact rolling-window boundaries, hourly bin edges, future-event rejection, external-provider filtering, zero buckets, previous-period comparison, and existing history/pricing/desktop/export behavior.
- Real local API: the window spans exactly 24 hours; 24 hourly buckets sum to the same total as the summary and daily rows. No scan warnings were returned.
- Browser inspection: 24 hourly hit targets in one-day mode, seven date targets in seven-day mode, and historical dates in all-history mode. Resizing preserves the hourly series.
- Chinese/dark and English/light were inspected at desktop, 1024px, and 390px widths. The 390px and 1024px layouts had no document-level horizontal overflow. Mobile navigation labels fit on one line.
- Hover/focus exposes interval boundaries and input/cache/output/event counts. The rightmost axis label equals the current window endpoint; the caption includes both dates across midnight.
- No application console errors were captured in the preview. Chrome reported unrelated extension content-script connection errors, separately identified by their chrome-extension URL.
- Classic navigation is removed and duplicate classic source assets are no longer bundled. Existing public v0.6.0 and baseline tags are preserved.
- JavaScript syntax and Git whitespace checks passed. Actual public reference analysis is recorded in DESIGN.md; no remote fonts, scripts, background animation, or dependencies were added.

Screenshots remain outside the repository because they contain local usage data. Older QA.md documents the separate v0.6.0 release.
