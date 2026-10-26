"use strict";
// Apply saved preferences before styles paint; migrate existing users gently.
try {
  const theme = localStorage.getItem("codex-meter:theme") || localStorage.getItem("follow-your-codex:theme") || "light";
  const locale = localStorage.getItem("codex-meter:locale") || localStorage.getItem("follow-your-codex:locale") || "zh";
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
  document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
} catch { /* Storage can be disabled; use the readable HTML defaults. */ }
