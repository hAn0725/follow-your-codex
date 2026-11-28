---
name: Codex Meter
description: An editorial usage report for local Codex activity.
colors:
  paper: "#f8f8f8"
  ink: "#222220"
  surface: "#ffffff"
  secondary-surface: "#efefed"
  rule: "#dcdcd8"
  night: "#171716"
  night-text: "#f4f4ef"
  chart-ink: "#20211f"
  chart-paper: "#f6f7f1"
  chart-highlight: "#d7ee9d"
typography:
  display:
    fontFamily: "Segoe UI Variable Display, Segoe UI Variable Text, Segoe UI, Microsoft YaHei UI, PingFang SC, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1.14
    letterSpacing: "-0.018em"
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, Microsoft YaHei UI, PingFang SC, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  control: "7px"
  panel: "14px"
spacing:
  gutter: "clamp(16px, 3.4vw, 56px)"
  grid-gap: "clamp(14px, 2vw, 28px)"
  panel-inset: "clamp(18px, 2.3vw, 32px)"
  report-inset: "{spacing.panel-inset}"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
    height: "40px"
  report:
    backgroundColor: "{colors.chart-ink}"
    textColor: "{colors.chart-paper}"
    rounded: "{rounded.panel}"
    padding: "{spacing.report-inset}"
---

## Overview

Codex Meter opens as a compact usage report. Put the page title and sync status on the same baseline and give the widest column to the trend. The opening composition uses a single charcoal feature on a quiet canvas. Tokscale's web tables informed the thin row rules, right-aligned figures, and separate layers for primary values and supporting labels. [Awwwards](https://www.awwwards.com/) · [Tokscale](https://tokscale.ai/)

## Colors

Use paper gray and dark ink for the page, with white data surfaces and light rules. The feature has a charcoal surface in both themes and pale lime for the main trend line. Dark mode uses a warmer near-black canvas with off-white text. Supporting charts use a quiet gray-green scale.

## Typography

Use the installed UI fonts for Latin and Chinese text. Headings use a semibold weight, with standard letter spacing for Chinese. Model names and percentages sit on a shared baseline, and tabular figures align token counts and prices.

## Layout

Align the masthead, report, and analysis to one outer grid. Follow the feature with a four-column summary and a paired quota/composition row. Compact section titles and thin rules introduce the analysis and export areas. At 872px the feature stacks. At 760px the daily table keeps date, token total, and estimated cost in view, with the other metrics available inside the date row. At 600px the summary uses two columns and the analysis uses one. Keep the complete heatmap within its panel.

## Elevation & Depth

Separate data surfaces with borders and spacing. Use soft shadows for the export menu, tooltips, and temporary feedback.

## Shapes

Use 14px panel corners. Toolbar controls use 7px corners, with 4–6px inner selection and label treatments.

## Components

The sticky masthead combines navigation, the range control, sync and export. Section navigation follows the visible reading position. The range marker slides through the four segments, with keyboard and pointer input. Use the charcoal feature for the main time series. Use compact status labels for the date range, quota freshness, and chart summaries.

Use one chart for tokens and estimated USD at the selected granularity. An unpriced bucket with usage leaves a gap in the cost curve. Date rows expand in place to show model totals and estimated costs. Quota pace compares the most recent recorded usage percentage with the elapsed percentage of that window at the same observation. Omit the comparison for an expired or incomplete window. [Tokscale daily detail](https://github.com/junhoyeo/tokscale#tui-features) · [CodexUsage](https://github.com/osiristlg/CodexUsage) · [CodexBar quota pace](https://github.com/steipete/CodexBar/blob/main/docs/ui.md)

Keep chart axes stationary while the time series traces from left to right. Reveal bars from their baseline and animate the quota rails from the right edge during their first view. Project slices and legend rows highlight together. First-view chart motion begins when the chart enters the viewport. Explicit range changes may replay motion for visible charts. Respect reduced motion by showing the final values immediately.

## Do's and Don'ts

- Keep the featured curve and actual period visible in the opening report.
- Carry the same typography, alignment and spacing into both themes.
- Use a graphical surface only where real data needs it. Preserve reduced motion and visible focus.
