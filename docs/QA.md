# Codex Meter v0.6.0 verification

Verified locally on 2026-10-26.

## Preservation and compatibility

- Before editing, saved the existing dashboard in commit `cff1bc7` and tag `baseline-0.5.1-20261026`.
- Kept the original HTML, script, and stylesheet under `public/classic/`; loaded the page in the actual browser and confirmed its charts render.
- Inspected local CLI 0.159.2 and log metadata through desktop 0.164.0-alpha.11.1. No accounting-schema change was necessary. Modern token records, legacy token counts, compressed files, archives, and capacity windows remain supported.
- Full history API returned the new name/version and zero scan warnings. Excluded-provider filtering and existing price rules were retained.

## Automated and service checks

- All 16 Node tests passed, covering compressed history, migration, archive copies, pricing, exports, and desktop lifetime.
- Syntax checks passed for new and classic JavaScript; PowerShell installer parsed successfully; Git whitespace checks passed.
- Classic HTML and asset paths returned HTTP 200.
- CSV export returned HTTP 200 and the `codex-meter-YYYY-MM-DD.csv` filename.
- Installed and inspected the new `Codex Meter.lnk`, targeting the hidden launcher and new monochrome icon. The old shortcut was preserved.

## Browser review

- Inspected actual views at default desktop size, 1440×900, 1024×768, and 390×844.
- Checked Chinese/light and English/dark. The narrow and mobile layouts had no document-level horizontal overflow. Tables retain their own horizontal scroll area.
- Verified manual sync success feedback, the export menu, Escape dismissal, language/theme changes, and range selection. One-day charts retain explicit seven-day reference copy.
- A fresh browser tab at the desktop launcher's default address rendered all data without JavaScript console errors. Keyboard order follows the visible range/sync/export control order.
- Inspected activity heatmap, hourly distribution, project share, and the retained classic view.
- Independent screenshot review identified excessive overview height and undersized metadata. Reduced card and KPI spacing and increased secondary text size/contrast. Kept the remaining-capacity battery direction because it was an explicit prior user requirement.
- Reduced-motion CSS disables nonessential motion; an OS-level preference change was not performed.

## Evidence

Screenshots are saved in the task's visualization folder, outside version-controlled source, to avoid publishing local usage data. Reference study and design decisions are in `DESIGN.md`. Awwwards failed to load in both browser and page fetch; the other four requested references were visually inspected.
