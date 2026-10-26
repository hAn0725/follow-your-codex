# Codex Meter · v0.6 design notes

## Purpose

A local measurement workspace for Codex: see token volume, API-equivalent cost, remaining capacity, and the pattern behind usage. The existing accounting, exports, compressed-history support, and desktop lifecycle remain available.

## Reference study · 2026-10-26

- [Linear](https://linear.app/): observed its actual homepage, restrained weights, compact navigation, fine divisions, and clear contrast between primary text and secondary metadata. The displayed headline uses Inter Variable at a moderate weight rather than an excessively bold display face.
- [Stripe](https://stripe.com/): observed its content grouping, generous alignment grid, and distinct action hierarchy. Adapted the grouping and primary/secondary action distinction; its decorative color field is not suited to this analytical tool.
- [Vercel](https://vercel.com/): observed a focused black/white hierarchy, controlled borders, and concise controls. Applied the clarity to the data workspace without adopting its large decorative hero graphic.
- [Framer](https://www.framer.com/): observed clean typography, economical action groups, and separation between explanatory text and product visuals. Adapted the short, action-led feedback rather than the marketing animation.
- [Awwwards](https://www.awwwards.com/): navigation and content fetch both timed out in this environment. No unsupported claims about its live visual or motion treatment are used.

## Decisions

- Neutral measurement palette: canvas #fafafa, surface #ffffff, text #18181b, metadata #71717a, divider #e8e8ec. Dark mode uses matching neutral roles, not inverted screenshots.
- Local system typography: Segoe UI Variable/Segoe UI and Microsoft YaHei, with tabular numbers. No font downloads or analytics assets are required.
- Stable left navigation, compact sticky header, one clear primary sync action, and a native accessible export menu.
- Token volume and cost share the primary surface; capacity remains adjacent. Supporting metrics form a divided row, charts keep room for actual data, and explanatory copy stays subordinate.
- Controls use 120–220ms feedback. Chart updates fade once after an explicit action; there are no perpetual decorative effects. Reduced-motion preferences are honored.
- Initial skeletons indicate loading; sync and preference changes produce brief status feedback. Exports close their menu after invocation.
- Retain the complete classic page at `/classic/index.html`, with its own frozen styles and script. The original project baseline is tagged `baseline-0.5.1-20261026`.

## Acceptance

Inspect overview, activity, model efficiency, daily details, and exports at desktop and narrow sizes, in both themes and languages. Verify range input, tooltip focus, manual sync, classic access, exports, absence of console errors, and reduced motion. Record actual results after running the page.
