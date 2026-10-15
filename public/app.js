"use strict";

// Refreshes may reconnect within the desktop launcher's shutdown grace period.
let pageLifetime;
function connectPageLifetime() {
  if (!pageLifetime || pageLifetime.readyState === EventSource.CLOSED) {
    pageLifetime = new EventSource("/api/page-lifetime");
  }
}
connectPageLifetime();
window.addEventListener("pagehide", () => pageLifetime?.close());
window.addEventListener("pageshow", connectPageLifetime);

const rangeValues = ["1", "7", "30", "all"];
const translations = {
  zh: {
    brandSubtitle:"本地 Token 追踪器", mainNav:"主导航", navOverview:"控制中心", navTrends:"趋势分析", navData:"数据与导出", localRead:"本地只读", localReadSub:"数据不会离开这台电脑", privacyNote:"仅解析 Codex 用量元数据，不读取提示词、回复或代码正文。", pageTitle:"Codex 使用中心", viewPreferences:"界面偏好", themeDark:"深色", themeLight:"浅色", rangeLabel:"统计范围", range1:"1 天", range7:"7 天", range30:"30 天", rangeAll:"全部", sync:"同步数据", overviewTitle:"每一次思考，都有迹可循。", overviewSub:"用量、花费与额度，在这里一目了然。", localUsage:"● 本机用量",
    loading:"正在读取本地记录…", justNow:"刚刚", minutesAgo:"{n} 分钟前", hoursAgo:"{n} 小时前", daysAgo:"{n} 天前", today:"今天", tomorrow:"明天", resetUnknown:"重置时间未知", reset:"重置", shortWindow:"短周期额度", longWindow:"长周期额度", hourWindow:"{n} 小时窗口", dayWindow:"{n} 天窗口", minuteWindow:"{n} 分钟窗口", remaining:"剩余", used:"已用", updated:"更新", waiting:"等待数据", context:"最近上下文占用", noContext:"最近记录中没有上下文窗口数据", noLimits:"最近的 Codex 记录中没有额度窗口。完成一次 Codex 对话后再同步。",
    recent:"最近 {n} 天", allHistory:"全部历史", unpriced:"待计价", gptPriced:"GPT 已计价 {n} Token · 输入、缓存与输出分项估算", noGpt:"当前范围内暂无 GPT / Codex 用量", input:"输入", output:"输出", cached:"缓存", todayUse:"今日消耗", dailyAverage:"日均消耗", cacheHit:"缓存命中", activeDays:"活跃天数", localTimezone:"本地时区", apiValue:"API 等值", noToday:"今日暂无记录", noComparison:"上个周期暂无数据", compared:"较上个周期 {n}", streak:"连续活跃 {n} 天", peakDay:"高峰日期", busyHour:"活跃时段", recentAverage:"近 7 日日均", projection:"30 日趋势预测", noRecords:"暂无记录", localTime:"按本地时间统计", mostActive:"{n}最活跃", rolling:"滚动窗口", projectByRecent:"按近 7 日日均推算",
    providerTitle:"模型供应商计费", providerSub:"各家费用、币种与 GPT 用量彼此独立，不跨币种合计。", separateBilling:"独立费用", token:"Token", modelUsage:"尚未检测到已计价模型", trendTitle:"Token 使用趋势", dailyTotal:"每日总量", hoverDetail:"悬停查看明细", tokenMix:"Token 构成", total:"总计", uncachedInput:"非缓存输入", cachedInput:"缓存输入", reasoningOutput:"其中：推理输出", trendsTitle:"趋势分析", trendsSub:"找出最常使用 Codex 的星期与时段", heatTitle:"活跃热力图", heatHint:"颜色越深，Token 消耗越高", projectRank:"项目消耗排行 · TOP 10", projectRankSub:"从高到低排列 · 占比以全部项目为基数", projectPie:"项目消耗占比", projectPieSub:"前十名分别展示，其余合并为“其他”", cacheTrend:"每日缓存命中率", cacheHint:"缓存输入 ÷ 全部输入 · 无输入的日期留空", ioTitle:"输入与输出构成", ioSub:"所选周期 · 缓存计入输入，推理计入输出", cumulative:"累计用量", cumulativeHint:"所选周期内逐日累积 · 悬停查看数值", weekly:"每周用量分布", localAggregate:"按本地时间汇总", efficiency:"模型缓存效率", efficiencySub:"每个模型的缓存命中率、缓存量与独立费用估算", daily:"每日明细", dailySub:"输入、缓存、输出与用量事件", dataTitle:"数据与导出", dataSub:"可验证、可带走、不上传", pricingTitle:"金额是怎样计算的？", exportTitle:"导出当前范围", exportSub:"CSV 适合表格分析，Markdown 适合归档，JSON 保留完整结构。", sourceTitle:"本机 Codex 会话元数据", sourceEmpty:"等待扫描", localEstimate:"本地估算", other:"其他", noUsage:"所选范围内暂无用量", noRank:"所选范围内暂无排行数据", noProject:"所选范围内暂无项目用量", noInput:"所选周期暂无输入用量", noModel:"暂无模型用量", recentActive:"最近 {n} 个活跃日", noDaily:"所选范围内没有每日用量记录", activeDay:"活跃日", dailyUsage:"日均用量", cacheReuse:"缓存复用", noOutput:"暂无输出", inputOutput:"输入 / 输出 {n} : 1", everyOutput:"每 1 个输出 Token 对应 {n} 个输入 Token", priceUnavailable:"无公开 API 单价", localFile:"{time} 刷新 · {count} 个本地会话文件", refreshFailed:"读取失败：{message}", noFiles:"尚未在 {path} 找到 Codex 会话记录。也可以用 --codex-home 指定其他位置。", autoRefresh:"上次同步 {time} · {seconds} 秒后自动刷新", recentReference:"最近 7 天参考 · ", tooltipTotal:"总量", events:"{n} 个事件", cacheRate:"缓存命中率", all:"全部", weekday:["周一","周二","周三","周四","周五","周六","周日"]
  },
  en: {
    brandSubtitle:"Local token tracker", mainNav:"Main navigation", navOverview:"Overview", navTrends:"Trends", navData:"Data & export", localRead:"Local read-only", localReadSub:"Your data stays on this computer", privacyNote:"Only Codex usage metadata is read. Prompts, responses, and source code are never accessed.", pageTitle:"Codex usage", viewPreferences:"View preferences", themeDark:"Dark", themeLight:"Light", rangeLabel:"Time range", range1:"1 day", range7:"7 days", range30:"30 days", rangeAll:"All", sync:"Sync", overviewTitle:"A clear record of every thought.", overviewSub:"Usage, estimated cost, and capacity in one place.", localUsage:"● Local usage",
    loading:"Reading local records…", justNow:"Just now", minutesAgo:"{n}m ago", hoursAgo:"{n}h ago", daysAgo:"{n}d ago", today:"Today", tomorrow:"Tomorrow", resetUnknown:"Reset unknown", reset:"reset", shortWindow:"Short window", longWindow:"Long window", hourWindow:"{n}-hour window", dayWindow:"{n}-day window", minuteWindow:"{n}-minute window", remaining:"remaining", used:"used", updated:"updated", waiting:"Waiting", context:"Latest context", noContext:"No context window was found in recent records", noLimits:"No capacity window was found in recent Codex records. Complete a Codex conversation and sync again.",
    recent:"Last {n} days", allHistory:"All history", unpriced:"Unpriced", gptPriced:"GPT priced {n} Token · input, cache, and output estimated separately", noGpt:"No GPT / Codex usage in this range", input:"Input", output:"Output", cached:"Cache", todayUse:"Today", dailyAverage:"Daily average", cacheHit:"Cache hit", activeDays:"Active days", localTimezone:"Local time", apiValue:"API equivalent", noToday:"No activity today", noComparison:"No prior period data", compared:"vs. prior period {n}", streak:"{n}-day active streak", peakDay:"Peak day", busyHour:"Busiest hour", recentAverage:"7-day average", projection:"30-day projection", noRecords:"No records", localTime:"Local time", mostActive:"{n} is busiest", rolling:"Rolling window", projectByRecent:"Based on the recent 7-day average",
    providerTitle:"Provider billing", providerSub:"Costs, currencies, and GPT usage stay separate. Currencies are never combined.", separateBilling:"Separate cost", token:"Token", modelUsage:"No priced models detected", trendTitle:"Token trend", dailyTotal:"Daily total", hoverDetail:"Hover for detail", tokenMix:"Token mix", total:"Total", uncachedInput:"Uncached input", cachedInput:"Cached input", reasoningOutput:"of which: reasoning output", trendsTitle:"Trend analysis", trendsSub:"Find your most-used days and hours", heatTitle:"Activity heatmap", heatHint:"Darker cells mean more Token usage", projectRank:"Project ranking · Top 10", projectRankSub:"Descending order · share is based on all projects", projectPie:"Project share", projectPieSub:"Top ten shown separately; the rest are grouped", cacheTrend:"Daily cache hit rate", cacheHint:"Cached input ÷ all input · days without input are blank", ioTitle:"Input and output", ioSub:"Selected range · cache is part of input, reasoning is part of output", cumulative:"Cumulative usage", cumulativeHint:"Cumulative by day in this range · hover for values", weekly:"Weekly usage", localAggregate:"Aggregated in local time", efficiency:"Model cache efficiency", efficiencySub:"Cache hit rate, cached volume, and separately estimated cost per model", daily:"Daily detail", dailySub:"Input, cache, output, and usage events", dataTitle:"Data & export", dataSub:"Verifiable, portable, never uploaded", pricingTitle:"How is the estimated cost calculated?", exportTitle:"Export this range", exportSub:"CSV for analysis, Markdown for archives, JSON for the full structure.", sourceTitle:"Local Codex session metadata", sourceEmpty:"Waiting to scan", localEstimate:"Local estimate", other:"Other", noUsage:"No usage in this range", noRank:"No ranking data in this range", noProject:"No project usage in this range", noInput:"No input usage in this range", noModel:"No model usage", recentActive:"Latest {n} active days", noDaily:"No daily usage records in this range", activeDay:"Active days", dailyUsage:"Daily average", cacheReuse:"Cache reuse", noOutput:"No output", inputOutput:"Input / output {n} : 1", everyOutput:"Every output Token corresponds to {n} input Token", priceUnavailable:"No public API price", localFile:"Refreshed {time} · {count} local session files", refreshFailed:"Read failed: {message}", noFiles:"No Codex session records found in {path}. You can also use --codex-home to choose another directory.", autoRefresh:"Last sync {time} · refreshes in {seconds}s", recentReference:"Recent 7-day reference · ", tooltipTotal:"Total", events:"{n} events", cacheRate:"Cache hit rate", all:"All", weekday:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
  }
};
const state = { range: "30", rank: "projects", data: null, contextData: null, timer: null, resizeTimer: null, requestId: 0, nextRefresh: 0, locale: localStorage.getItem("follow-your-codex:locale") || "zh", theme: localStorage.getItem("follow-your-codex:theme") || "dark", motion: false };
Object.assign(translations.zh, { capacityTitle:"Codex 额度状态", tokenUsage:"Codex Token 用量", date:"日期", eventCount:"事件", costNote:"计价说明", overview:"概览", privacyCompact:"仅本地读取", overviewTitle:"使用概览", overviewSub:"用量、费用与额度。", trendsSub:"活跃时间与项目占比。", dataSub:"本地读取，可导出。", pricingTitle:"金额如何估算？", pricingScope:"仅统计 GPT / Codex；输入、缓存与输出分别计价。", pricingUnknown:"Unknown model 保留用量，但不计入金额。自动审查采用 GPT-5.3-Codex 代理估算。", unknownModel:"未识别模型", unknownModelInfo:"仅计入用量，未计价", proxyEstimate:"代理估算" });
Object.assign(translations.en, { capacityTitle:"Codex capacity", tokenUsage:"Codex Token usage", date:"Date", eventCount:"Events", costNote:"Pricing notes", overview:"Overview", privacyCompact:"Local only", overviewTitle:"Usage at a glance", overviewSub:"Usage, cost, capacity.", trendsSub:"Activity times and project share.", dataSub:"Local, exportable, private.", pricingTitle:"How is cost estimated?", pricingScope:"Only GPT / Codex is counted; input, cache, and output are priced separately.", pricingUnknown:"Unknown models keep verified usage but no cost. Auto review uses a GPT-5.3-Codex proxy estimate.", unknownModel:"Unidentified model", unknownModelInfo:"Usage only, not priced", proxyEstimate:"Proxy estimate" });
const $ = (selector) => document.querySelector(selector);
Object.assign(translations.zh, { scanIncomplete:"{n} 个历史文件读取失败，统计可能不完整。", zstdUnavailable:"{n} 个压缩历史文件尚未读取，请使用 Node.js 24+。" });
Object.assign(translations.en, { scanIncomplete:"{n} history files could not be read; totals may be incomplete.", zstdUnavailable:"{n} compressed history files need Node.js 24+ to be read." });
const $$ = (selector) => [...document.querySelectorAll(selector)];
const t = (key, values = {}) => String(translations[state.locale]?.[key] ?? translations.zh[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
const weekdays = () => translations[state.locale].weekday;

const iconPaths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  trend: '<path d="M3 19V5m0 14h18M6 14l5-5 4 3 6-8m-5 0h5v5"/>',
  sessions: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M9 3v18m4-12h3m-3 5h3"/>',
  data: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  ring: '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M16 3.9A9 9 0 0 1 20.1 8H16z"/>',
  refresh: '<path d="M20 7a9 9 0 0 0-15-1L3 9m0-5v5h5m-4 8a9 9 0 0 0 15 1l2-3m0 5v-5h-5"/>',
};
function icon(name) { return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`; }
$$(".sidebar nav button > span").forEach((span) => { span.innerHTML = icon({overview:"home",trends:"trend","data-source":"data"}[span.parentElement.dataset.target]); });
$("#refresh > span").innerHTML = icon("refresh");
$$(".trend-panel h2, .heat-panel h3, .ranking-panel h3, .mix-panel h2, .daily-panel h3").forEach((heading) => {
  const name = heading.closest(".heat-panel") ? "grid" : heading.closest(".mix-panel") ? "ring" : heading.closest(".daily-panel") ? "sessions" : "trend";
  heading.insertAdjacentHTML("afterbegin", icon(name));
});

const staticCopy = {
  ".usage-hero .section-heading h2":"tokenUsage", ".usage-hero .section-heading .eyebrow":"overview", ".quota-hero .section-heading h2":"capacityTitle", ".hero-label":"cumulative", ".cost-line span:last-child":"apiValue", ".hero-breakdown a":"costNote", ".metrics-grid article:nth-child(1)>span":"todayUse", ".metrics-grid article:nth-child(2)>span":"dailyAverage", ".metrics-grid article:nth-child(3)>span":"cacheHit", ".metrics-grid article:nth-child(4)>span":"activeDays", ".trend-panel h2":"trendTitle", ".trend-panel .legend span:first-child":"dailyTotal", "#trendHint":"hoverDetail", ".mix-panel h2":"tokenMix", "#donut span":"total", ".trend-panel + .mix-panel":null,
  ".section-title-row h2":"trendsTitle", ".section-title-row > p":"trendsSub", ".heat-panel h3":"heatTitle", "#heatHint":"heatHint", ".ranking-panel h3":"projectRank", ".ranking-panel p":"projectRankSub", ".project-pie-panel h3":"projectPie", ".project-pie-panel p":"projectPieSub", ".extra-analysis > article:nth-child(1) h3":"cacheTrend", ".extra-analysis > article:nth-child(1) p":"cacheHint", ".extra-analysis > article:nth-child(2) h3":"ioTitle", ".extra-analysis > article:nth-child(2) p":"ioSub", ".cumulative-panel h3":"cumulative", ".weekly-pattern-heading span":"weekly", ".weekly-pattern-heading small":"localAggregate", ".extra-analysis > article:nth-child(4) h3":"efficiency", ".extra-analysis > article:nth-child(4) p":"efficiencySub", ".daily-panel h3":"daily", ".daily-panel p":"dailySub", ".daily-panel th:nth-child(1)":"date", ".daily-panel th:nth-child(2)":"total", ".daily-panel th:nth-child(3)":"input", ".daily-panel th:nth-child(4)":"cached", ".daily-panel th:nth-child(5)":"output", ".daily-panel th:nth-child(6)":"eventCount", "#data-title":"dataTitle", "#data-title + p":"dataSub", ".pricing-note h3":"pricingTitle", ".pricing-note p:nth-of-type(1)":"pricingScope", ".pricing-note p:nth-of-type(2)":"pricingUnknown", ".export-card h3":"exportTitle", ".export-card p":"exportSub", ".source-card h3":"sourceTitle", "#footerStatus":"sourceEmpty"
};
function setStaticCopy() {
  Object.entries(staticCopy).forEach(([selector, key]) => {
    if (!key) return;
    const node = $(selector); if (!node) return;
    const existingIcon = node.querySelector(".ui-icon");
    if (existingIcon) node.replaceChildren(existingIcon, document.createTextNode(t(key)));
    else node.textContent = t(key);
  });
  const dataSub = $("#data-source .section-title-row>p"); if (dataSub) dataSub.textContent = t("dataSub");
}
function updateRangeUI(value = Number($("#rangeSlider").value)) {
  const slider = $("#rangeSwitch");
  const progress = value / (rangeValues.length - 1);
  slider.style.setProperty("--range-progress", progress);
  slider.style.setProperty("--range-step", value);
  $$("[data-range-value]").forEach((item) => item.classList.toggle("active", Number(item.dataset.rangeValue) === value));
}
function applyPreferences({ rerender = false } = {}) {
  const root = document.documentElement;
  root.lang = state.locale === "en" ? "en" : "zh-CN";
  root.dataset.theme = state.theme;
  $("meta[name='color-scheme']").content = state.theme === "dark" ? "dark light" : "light dark";
  $$('[data-i18n]').forEach((node) => { node.textContent = t(node.dataset.i18n); });
  $$('[data-i18n-aria]').forEach((node) => { node.setAttribute("aria-label", t(node.dataset.i18nAria)); });
  $("#rangeSlider").setAttribute("aria-label", t("rangeLabel"));
  $("#themeToggle").setAttribute("aria-pressed", String(state.theme === "dark"));
  $("#themeToggle b").textContent = t(state.theme === "dark" ? "themeDark" : "themeLight");
  $("#localeToggle").textContent = state.locale === "zh" ? "EN" : "中文";
  $("#localeToggle").setAttribute("aria-pressed", String(state.locale === "en"));
  setStaticCopy();
  updateRangeUI();
  if (rerender && state.data) render(state.data);
}
applyPreferences();

function formatNumber(value) {
  const number = Number(value) || 0;
  if (number >= 1e9) return `${(number / 1e9).toFixed(number >= 1e10 ? 1 : 2)}B`;
  if (number >= 1e6) return `${(number / 1e6).toFixed(number >= 1e7 ? 1 : 2)}M`;
  if (number >= 1e3) return `${(number / 1e3).toFixed(number >= 1e4 ? 1 : 2)}K`;
  return Math.round(number).toLocaleString(state.locale === "en" ? "en-US" : "zh-CN");
}

function formatFull(value) { return Math.round(Number(value) || 0).toLocaleString(state.locale === "en" ? "en-US" : "zh-CN"); }
function formatMoney(value, currency = "USD") {
  return new Intl.NumberFormat(state.locale === "en" ? "en-US" : "zh-CN", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
}
function formatDate(value) { return new Intl.DateTimeFormat(state.locale === "en" ? "en-US" : "zh-CN", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`)); }
function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function relativeTime(timestamp) {
  const seconds = Math.max(0, (Date.now() - Number(timestamp)) / 1000);
  if (seconds < 60) return t("justNow");
  if (seconds < 3600) return t("minutesAgo", { n: Math.floor(seconds / 60) });
  if (seconds < 86400) return t("hoursAgo", { n: Math.floor(seconds / 3600) });
  return t("daysAgo", { n: Math.floor(seconds / 86400) });
}

function resetTimeLabel(timestamp, type) {
  if (!timestamp) return t("resetUnknown");
  const reset = new Date(timestamp);
  if (Number.isNaN(reset.getTime())) return t("resetUnknown");
  if (type === "short") {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const prefix = reset.toDateString() === today.toDateString()
      ? t("today")
      : reset.toDateString() === tomorrow.toDateString() ? t("tomorrow") : state.locale === "en" ? `${reset.getMonth() + 1}/${reset.getDate()}` : `${reset.getMonth() + 1}月${reset.getDate()}日`;
    return `${prefix} ${reset.toLocaleTimeString(state.locale === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  }
  return state.locale === "en" ? `${reset.getMonth() + 1}/${reset.getDate()}` : `${reset.getMonth() + 1}月${reset.getDate()}日`;
}

function windowLabel(window, fallback) {
  if (!window || !window.windowMinutes) return fallback;
  if (window.windowMinutes >= 1440 && window.windowMinutes % 1440 === 0) return t("dayWindow", { n: window.windowMinutes / 1440 });
  if (window.windowMinutes >= 60 && window.windowMinutes % 60 === 0) return t("hourWindow", { n: window.windowMinutes / 60 });
  return t("minuteWindow", { n: window.windowMinutes });
}

function showTooltip(event, html) {
  const tooltip = $("#tooltip");
  const rect = event.currentTarget && event.currentTarget.getBoundingClientRect
    ? event.currentTarget.getBoundingClientRect()
    : { right: 0, top: 0 };
  const clientX = Number.isFinite(event.clientX) ? event.clientX : rect.right;
  const clientY = Number.isFinite(event.clientY) ? event.clientY : rect.top;
  tooltip.innerHTML = html;
  tooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - 265, clientX + 14))}px`;
  tooltip.style.top = `${Math.max(8, clientY - 74)}px`;
  tooltip.classList.remove("hidden");
}
function hideTooltip() { $("#tooltip").classList.add("hidden"); }
function setCount(selector, value, formatter = formatNumber) {
  const node = $(selector); const previous = Number(node.dataset.value ?? value); const next = Number(value) || 0;
  node.dataset.value = String(next);
  if (!state.motion || window.matchMedia("(prefers-reduced-motion: reduce)").matches || previous === next) { node.textContent = formatter(next); return; }
  const started = performance.now(); const duration = 430;
  const tick = (now) => {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 4);
    node.textContent = formatter(previous + (next - previous) * eased);
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function animateVisuals() {
  if (!state.motion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  $$("#trendChart svg, #cacheTrend svg, #cumulativeChart svg, #weeklyPattern svg, #projectPie svg").forEach((svg, index) => svg.animate([{ opacity:.18, transform:"translateY(7px)" }, { opacity:1, transform:"translateY(0)" }], { duration:360, delay:index * 35, easing:"cubic-bezier(.2,.8,.2,1)", fill:"both" }));
  $$(".stack-input,.stack-cache,.stack-output,.weekday-bar rect,#cacheTrend rect").forEach((bar, index) => bar.animate([{ transform:"scaleY(.04)", transformOrigin:"bottom" }, { transform:"scaleY(1)", transformOrigin:"bottom" }], { duration:420, delay:Math.min(index * 15, 260), easing:"cubic-bezier(.2,.8,.2,1)", fill:"both" }));
  $("#donut").animate([{ opacity:.2, transform:"scale(.86)" }, { opacity:1, transform:"scale(1)" }], { duration:420, easing:"cubic-bezier(.2,.8,.2,1)", fill:"both" });
}

function renderSummary(data) {
  const gptCost = data.cost.providers?.openai || data.cost;
  const money = (cost) => cost.pricedTokens ? formatMoney(cost.amount ?? cost.usd, cost.currency || "USD") : t("unpriced");
  $("#estimatedCost").textContent = money(gptCost);
  $("#rangeLabel").textContent = data.range === "all" ? t("allHistory") : t("recent", { n:data.range });
  $("#costCoverage").textContent = gptCost.pricedTokens ? t("gptPriced", { n:formatNumber(gptCost.pricedTokens) }) : t("noGpt");
  $("#costParts").textContent = `GPT / Codex: ${t("input")} $${(gptCost.input ?? data.cost.inputUsd).toFixed(2)} · ${t("cached")} $${(gptCost.cached ?? data.cost.cachedUsd).toFixed(2)} · ${t("output")} $${(gptCost.output ?? data.cost.outputUsd).toFixed(2)}` + (data.cost.unknownModels.length ? ` · ${t("unknownModel")}：${t("unknownModelInfo")}` : "");
  const recent = data.daily.slice(-7), peak = Math.max(1, ...recent.map((d) => d.usage.total));
  $("#miniBars").innerHTML = recent.map((d) => `<i style="height:${Math.max(2, d.usage.total / peak * 100)}%" title="${d.date} · ${formatFull(d.usage.total)} Token"></i>`).join("");
  setCount("#totalTokens", data.totals.total);
  setCount("#todayTokens", data.today.total);
  setCount("#averageTokens", data.insights.averagePerDay);
  setCount("#cacheRate", data.totals.input ? data.totals.cached / data.totals.input * 100 : 0, (value) => `${value.toFixed(1)}%`);
  setCount("#activeDays", data.insights.activeDays, formatFull);
  $("#streak").textContent = t("streak", { n:data.insights.streak });
  $("#totalFoot").textContent = `${formatNumber(data.totals.input)} ${t("input")} · ${formatNumber(data.totals.output)} ${t("output")}`;
  $("#todayFoot").textContent = data.today.total ? `≈ ${money(data.todayCost)} · ${t("apiValue")}` : t("noToday");
  const comparison = data.insights.comparison;
  if (!comparison || comparison.percent === null) $("#comparison").textContent = t("noComparison");
  else {
    const sign = comparison.percent > 0 ? "+" : "";
    $("#comparison").textContent = t("compared", { n:`${sign}${comparison.percent.toFixed(1)}%` });
  }

  const peakDay = data.insights.peakDay;
  $("#peakDay").textContent = peakDay ? formatDate(peakDay.date) : "—";
  $("#peakDayValue").textContent = peakDay ? `${formatNumber(peakDay.usage.total)} Token` : t("noRecords");
  const busy = data.insights.busiestHour;
  $("#busyHour").textContent = busy && busy.total ? `${String(busy.hour).padStart(2, "0")}:00–${String((busy.hour + 1) % 24).padStart(2, "0")}:00` : "—";
  const busyDay = data.insights.busiestWeekday;
  $("#busyWeekday").textContent = busyDay && busyDay.total ? t("mostActive", { n:weekdays()[busyDay.weekday] }) : t("localTime");
  $("#recentAverage").textContent = formatNumber(data.insights.recentAverage);
  $("#projection").textContent = formatNumber(data.insights.projected30Days);
}

function renderLimits(data) {
  const latest = data.latestLimits;
  const rows = latest ? [
    { label: windowLabel(latest.primary, t("shortWindow")), value: latest.primary, type: "short" },
    { label: windowLabel(latest.secondary, t("longWindow")), value: latest.secondary, type: "long" },
  ].filter((item) => item.value) : [];
  $("#limits").innerHTML = rows.length ? rows.map(({ label, value, type }) => {
    const severity = value.usedPercent >= 90 ? "danger" : value.usedPercent >= 70 ? "warn" : "";
    const remaining = Math.max(0, 100 - value.usedPercent);
    const resetLabel = resetTimeLabel(value.resetsAt, type);
    return `<div class="quota-card"><div class="quota-head"><span>${escapeHtml(label)}</span><strong data-remaining="${t("remaining")}">${remaining.toFixed(1)}%</strong></div><div class="quota-meta"><span>${value.usedPercent.toFixed(1)}% ${t("used")}</span><span>${escapeHtml(resetLabel)} ${t("reset")}</span></div><div class="progress battery ${severity}" role="progressbar" aria-label="${escapeHtml(label)} ${t("remaining")}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${remaining.toFixed(1)}"><span style="margin-left:${value.usedPercent}%;width:${remaining}%"></span></div></div>`;
  }).join("") : `<div class="quota-empty">${t("noLimits")}</div>`;
  $("#limitAge").textContent = latest ? `${relativeTime(latest.timestamp)} ${t("updated")}${latest.planType ? ` · ${latest.planType}` : ""}` : t("waiting");
  const context = data.latestContext;
  $("#context").innerHTML = context
    ? `${t("context")} <strong>${formatNumber(context.used)} / ${formatNumber(context.limit)}</strong> · ${context.percent.toFixed(1)}%`
    : t("noContext");
}

function chartPoints(values, width, height, pad, max) {
  const usableWidth = width - pad.left - pad.right;
  const usableHeight = height - pad.top - pad.bottom;
  return values.map((value, index) => ({
    x: pad.left + (values.length === 1 ? usableWidth / 2 : (index / (values.length - 1)) * usableWidth),
    y: pad.top + usableHeight - (value / max) * usableHeight,
  }));
}
function pathFromPoints(items) {
  if (!items.length) return "";
  let path = `M${items[0].x},${items[0].y}`;
  // Horizontal tangents keep every segment within its endpoints, without overshoot.
  for (let i = 1; i < items.length; i++) {
    const a = items[i - 1], b = items[i], mid = (a.x + b.x) / 2;
    path += ` C${mid},${a.y} ${mid},${b.y} ${b.x},${b.y}`;
  }
  return path;
}

function renderTrend(data) {
  const container = $("#trendChart");
  const width = Math.max(280, container.clientWidth || 780);
  const height = 292;
  const pad = { top: 18, right: 14, bottom: 32, left: 54 };
  const daily = data.daily;
  const totals = daily.map((item) => item.usage.total);
  if (!daily.length || !totals.some(Boolean)) {
    container.innerHTML = `<div class="empty">${t("noUsage")}</div>`;
    return;
  }
  const max = Math.max(...totals, 1) * 1.12;
  const points = chartPoints(totals, width, height, pad, max);
  const usableWidth = width - pad.left - pad.right;
  const slot = usableWidth / Math.max(1, daily.length);
  const barWidth = Math.max(2, Math.min(24, slot * .58));
  const bottom = height - pad.bottom;
  const labelEvery = Math.max(1, Math.ceil(daily.length / Math.max(2, Math.floor(width / 110))));
  const bars = daily.map((item, index) => {
    const uncached = Math.max(0, item.usage.input - item.usage.cached);
    const segments = [
      { value: uncached, cls: "stack-input" },
      { value: item.usage.cached, cls: "stack-cache" },
      { value: item.usage.output, cls: "stack-output" },
    ];
    let y = bottom;
    const x = points[index].x - barWidth / 2;
    return segments.map((segment) => {
      const segmentHeight = segment.value / max * (height - pad.top - pad.bottom);
      y -= segmentHeight;
      return `<rect class="${segment.cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(0, segmentHeight).toFixed(1)}" rx="${Math.min(3, barWidth / 3)}"/>`;
    }).join("");
  }).join("");
  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img">
    ${[0, .25, .5, .75, 1].map((tick) => { const y = pad.top + (1 - tick) * (height - pad.top - pad.bottom); return `<line class="grid-line" x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}"/><text x="${pad.left - 9}" y="${y + 4}" text-anchor="end">${formatNumber(max * tick)}</text>`; }).join("")}
    <defs><linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--chart-a)" stop-opacity=".18"/><stop offset="100%" stop-color="var(--chart-a)" stop-opacity=".01"/></linearGradient></defs>
    <path fill="url(#curveFill)" d="${pathFromPoints(points)} L${points.at(-1).x},${bottom} L${points[0].x},${bottom} Z"/>
    <path class="trend-line" d="${pathFromPoints(points)}"/>
    ${daily.map((item, index) => index % labelEvery === 0 || index === daily.length - 1 ? `<text x="${points[index].x}" y="${height - 7}" text-anchor="middle">${formatDate(item.date)}</text>` : "").join("")}
    <g id="hoverMarker" class="hidden"><line class="hover-guide" y1="${pad.top}" y2="${bottom}"/><circle class="hover-point" r="4"/></g>
    ${daily.map((item, index) => { const left = index === 0 ? pad.left : (points[index - 1].x + points[index].x) / 2; const right = index === daily.length - 1 ? width - pad.right : (points[index].x + points[index + 1].x) / 2; return `<rect class="hover-target" data-index="${index}" x="${left}" y="${pad.top}" width="${Math.max(2, right - left)}" height="${bottom - pad.top}"/>`; }).join("")}
  </svg>`;
  const marker = container.querySelector("#hoverMarker");
  container.querySelectorAll(".hover-target").forEach((target) => {
    target.setAttribute("tabindex", "0");
    target.setAttribute("aria-label", `${daily[Number(target.dataset.index)].date} · ${formatFull(daily[Number(target.dataset.index)].usage.total)} Token`);
    const reveal = (event) => {
      const index = Number(target.dataset.index); const item = daily[index]; const point = points[index];
      marker.classList.remove("hidden"); marker.querySelector("line").setAttribute("x1", point.x); marker.querySelector("line").setAttribute("x2", point.x); marker.querySelector("circle").setAttribute("cx", point.x); marker.querySelector("circle").setAttribute("cy", point.y);
      showTooltip(event, `<b>${escapeHtml(item.date)}</b><span>${t("tooltipTotal")} ${formatFull(item.usage.total)}<br>${t("input")} ${formatFull(item.usage.input)} · ${t("cached")} ${formatFull(item.usage.cached)}<br>${t("output")} ${formatFull(item.usage.output)} · ${t("events", { n:item.events })}</span>`);
    };
    target.addEventListener("mousemove", reveal);
    target.addEventListener("focus", reveal);
    target.addEventListener("mouseleave", () => { marker.classList.add("hidden"); hideTooltip(); });
    target.addEventListener("blur", () => { marker.classList.add("hidden"); hideTooltip(); });
  });
}

function renderMix(data) {
  const parts = [
    { label: t("uncachedInput"), value: Math.max(0, data.totals.input - data.totals.cached), color: "var(--chart-a)" },
    { label: t("cachedInput"), value: data.totals.cached, color: "var(--chart-b)" },
    { label: t("output"), value: data.totals.output, color: "var(--chart-c)" },
  ];
  const denominator = Math.max(1, parts.reduce((sum, part) => sum + part.value, 0));
  let cursor = 0;
  const segments = parts.map((part) => { const start = cursor; cursor += part.value / denominator * 360; return `${part.color} ${start}deg ${cursor}deg`; });
  $("#donut").style.background = data.totals.total ? `conic-gradient(${segments.join(",")})` : "var(--panel-soft)";
  setCount("#donutTotal", data.totals.total);
  $("#mixLegend").innerHTML = parts.map((part) => `<div class="mix-row"><i style="background:${part.color}"></i><span>${part.label}</span><b>${formatNumber(part.value)}</b></div>`).join("")
    + `<div class="mix-row reasoning-note"><i style="background:var(--chart-d)"></i><span>${t("reasoningOutput")}</span><b>${formatNumber(data.totals.reasoning)}</b></div>`;
}

function renderHeatmap(data) {
  const max = Math.max(...data.heatmap.map((item) => item.total), 1);
  const byKey = new Map(data.heatmap.map((item) => [`${item.weekday}-${item.hour}`, item]));
  let html = `<div class="heatmap"><span></span>${Array.from({ length: 24 }, (_, hour) => `<span class="hour-label">${hour % 3 === 0 ? hour : ""}</span>`).join("")}`;
  for (let day = 0; day < 7; day += 1) {
    html += `<span class="heat-label">${weekdays()[day]}</span>`;
    for (let hour = 0; hour < 24; hour += 1) {
      const item = byKey.get(`${day}-${hour}`) || { total: 0, events: 0 };
      const ratio = item.total / max;
      const level = !item.total ? 0 : ratio <= .12 ? 1 : ratio <= .35 ? 2 : ratio <= .65 ? 3 : 4;
      html += `<i class="heat-cell" data-level="${level}" data-day="${day}" data-hour="${hour}" data-total="${item.total}" data-events="${item.events}" tabindex="0" aria-label="${weekdays()[day]} ${hour}:00, ${formatFull(item.total)} Token"></i>`;
    }
  }
  $("#heatmap").innerHTML = `${html}</div><div class="heat-scale"><span>${t("localTime")} · 0–23</span><div><span>${state.locale === "en" ? "Less" : "少"}</span>${[0,1,2,3,4].map((level) => `<i class="heat-cell" data-level="${level}"></i>`).join("")}<span>${state.locale === "en" ? "More" : "多"}</span></div></div>`;
  const busy = data.insights.busiestHour;
  $("#heatPeak").textContent = busy && busy.total ? `${state.locale === "en" ? "Peak" : "峰值"} ${String(busy.hour).padStart(2, "0")}:00` : t("localTime");
  $$(".heat-cell[data-hour]").forEach((cell) => {
    const reveal = (event) => showTooltip(event, `<b>${weekdays()[cell.dataset.day]} ${String(cell.dataset.hour).padStart(2, "0")}:00</b><span>${formatFull(cell.dataset.total)} Token · ${t("events", { n:cell.dataset.events })}</span>`);
    cell.addEventListener("mousemove", reveal); cell.addEventListener("focus", reveal); cell.addEventListener("mouseleave", hideTooltip); cell.addEventListener("blur", hideTooltip);
  });
}

function renderRanking(data) {
  renderProjectPie(data);
  for (const [field, id] of [["projects", "#projectRanking"]]) {
    const rows = [...data[field]].sort((a,b) => b.usage.total-a.usage.total).slice(0,10);
    const max = Math.max(1, ...rows.map((row) => row.usage.total));
    $(id).innerHTML = rows.length ? rows.map((row,index) => `<div class="rank-row"><span class="rank-index">${String(index+1).padStart(2,"0")}</span><span class="rank-name" title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</span><div class="rank-bar"><span style="width:${row.usage.total/max*100}%"></span></div><span class="rank-value" title="${formatFull(row.usage.total)} Token">${formatNumber(row.usage.total)}<small>${(data.totals.total ? row.usage.total/data.totals.total*100 : 0).toFixed(1)}%</small></span></div>`).join("") : `<div class="empty">${t("noRank")}</div>`;
  }
}

function renderProjectPie(data) {
  const sorted = [...data.projects].filter((row) => row.usage.total > 0).sort((a,b) => b.usage.total-a.usage.total);
  const rows = sorted.slice(0,10).map((row) => ({name:row.name,value:row.usage.total}));
  const other = sorted.slice(10).reduce((sum,row) => sum+row.usage.total,0);
  if (other > 0) rows.push({name:"其他",value:other});
  const total = rows.reduce((sum,row) => sum+row.value,0);
  if (!total) {
    $("#projectPie").innerHTML = `<div class="empty">${t("noProject")}</div>`;
    $("#projectPieLegend").innerHTML = "";
    return;
  }
  const colors = ["var(--pie-1)","var(--pie-2)","var(--pie-3)","var(--pie-4)","var(--pie-5)","var(--pie-6)","var(--pie-7)","var(--pie-8)","var(--pie-9)","var(--pie-10)","var(--pie-other)"];
  let angle = -Math.PI/2;
  const slices = rows.map((row,i) => {
    const end = angle+row.value/total*Math.PI*2;
    const x1 = 120+100*Math.cos(angle), y1 = 120+100*Math.sin(angle);
    const x2 = 120+100*Math.cos(end), y2 = 120+100*Math.sin(end);
    const shape = rows.length === 1
      ? '<circle cx="120" cy="120" r="100"/>'
      : `<path d="M120 120 L${x1} ${y1} A100 100 0 ${end-angle>Math.PI?1:0} 1 ${x2} ${y2} Z"/>`;
    angle = end;
    return `<g class="pie-slice" data-pie-index="${i}" fill="${colors[i]}" tabindex="0" role="img" aria-label="${escapeHtml(row.name)}，${(row.value/total*100).toFixed(1)}%"><title>${escapeHtml(row.name)} · ${formatFull(row.value)} Token · ${(row.value/total*100).toFixed(1)}%</title>${shape}</g>`;
  }).join("");
  $("#projectPie").innerHTML = `<svg viewBox="0 0 240 240" aria-label="前十名与其他项目的 Token 消耗占比">${slices}</svg>`;
  $("#projectPieLegend").innerHTML = rows.map((row,i) => `<div class="pie-legend-row"><i style="background:${colors[i]}"></i><span title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</span><b>${(row.value/total*100).toFixed(1)}%</b></div>`).join("");
  $$(".pie-slice").forEach((slice) => {
    const row = rows[Number(slice.dataset.pieIndex)];
    const reveal = (event) => showTooltip(event,`<b>${escapeHtml(row.name)}</b><span>${formatFull(row.value)} Token · ${(row.value/total*100).toFixed(1)}%</span>`);
    slice.addEventListener("mousemove",reveal);
    slice.addEventListener("focus",reveal);
    slice.addEventListener("mouseleave",hideTooltip);
    slice.addEventListener("blur",hideTooltip);
  });
}

function renderDaily(data) {
  const rows = data.daily.filter((item) => item.usage.total > 0).slice().reverse().slice(0, 14);
  $("#dailyCount").textContent = rows.length ? t("recentActive", { n:rows.length }) : t("noRecords");
  $("#dailyRows").innerHTML = rows.length ? rows.map((item) => `<tr><td>${escapeHtml(item.date)}</td><td class="numeric"><b>${formatFull(item.usage.total)}</b></td><td class="numeric">${formatFull(item.usage.input)}</td><td class="numeric">${formatFull(item.usage.cached)}</td><td class="numeric">${formatFull(item.usage.output)}</td><td class="numeric">${formatFull(item.events)}</td></tr>`).join("") : `<tr><td colspan="6"><div class="empty">${t("noDaily")}</div></td></tr>`;
}

function updateExports() {
  const base = `/api/export?range=${encodeURIComponent(state.range)}`;
  $("#exportCsv").href = `${base}&format=csv`;
  $("#exportMd").href = `${base}&format=md`;
  $("#exportJson").href = `${base}&format=json`;
}

function renderEfficiencyCharts(data) {
  const rows = data.daily;
  const width = Math.max(280, $("#cacheTrend").clientWidth || 600);
  const height = 220, left = 42, right = 16, bottom = 186;
  const slot = (width-left-right) / Math.max(1,rows.length);
  $("#cacheTrend").innerHTML = !rows.some((row) => row.usage.input) ? `<div class="empty">${t("noInput")}</div>` : `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${t("cacheRate")}, 0 to 100 percent">
    ${[0,50,100].map((n) => `<line class="grid-line" x1="${left}" x2="${width-right}" y1="${bottom-n*1.6}" y2="${bottom-n*1.6}"/><text x="34" y="${bottom-n*1.6+4}" text-anchor="end">${n}%</text>`).join("")}
    ${rows.map((row,i) => { const rate = row.usage.input ? Math.min(100,row.usage.cached/row.usage.input*100) : null; return rate === null ? "" : `<rect x="${left+i*slot+slot*.18}" y="${bottom-rate*1.6}" width="${slot*.64}" height="${Math.max(1,rate*1.6)}" rx="2" fill="var(--chart-a)" tabindex="0"><title>${row.date} · ${rate.toFixed(1)}% · ${t("cached")} ${formatFull(row.usage.cached)} / ${t("input")} ${formatFull(row.usage.input)}</title></rect>`; }).join("")}
    <text x="${left}" y="213">${formatDate(rows[0].date)}</text><text x="${width-right}" y="213" text-anchor="end">${formatDate(rows.at(-1).date)}</text></svg>`;
  const total = data.totals.input + data.totals.output;
  const parts = [{label:t("input"),value:data.totals.input,color:"var(--chart-a)"},{label:t("output"),value:data.totals.output,color:"var(--chart-b)"}];
  $("#ioBreakdown").innerHTML = total ? `<div class="io-stacked" role="img" aria-label="${t("input")} ${formatFull(data.totals.input)} Token, ${t("output")} ${formatFull(data.totals.output)} Token">${parts.map((p) => `<span style="width:${p.value/total*100}%;background:${p.color}"></span>`).join("")}</div>${parts.map((p) => `<div class="io-row"><span>${p.label}</span><strong>${formatNumber(p.value)}</strong><small>${(p.value/total*100).toFixed(1)}%</small></div>`).join("")}<p class="context-strip">${t("everyOutput", { n:data.totals.output ? (data.totals.input/data.totals.output).toFixed(1) : "—" })}</p>` : `<div class="empty">${t("noUsage")}</div>`;
}

function renderExtraAnalysis(data, timelineData = data) {
  renderEfficiencyCharts(timelineData);
  let sum = 0;
  const values = timelineData.daily.map((row) => (sum += row.usage.total));
  const width = Math.max(320, $("#cumulativeChart").clientWidth || 640);
  const height = 220, pad = { left: 55, right: 18, top: 15, bottom: 30 };
  const pts = chartPoints(values, width, height, pad, Math.max(1, sum) * 1.1);
  $("#cumulativeTotal").textContent = formatNumber(sum) + " Token";
  $("#cumulativeChart").innerHTML = !sum ? `<div class="empty">${t("noUsage")}</div>` : `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${t("cumulative")} ${formatFull(sum)} Token">
    ${[0,.5,1].map((r) => { const y = pad.top + (1-r)*(height-pad.top-pad.bottom); return `<line class="grid-line" x1="55" x2="${width-18}" y1="${y}" y2="${y}"/><text x="46" y="${y+4}" text-anchor="end">${formatNumber(sum*1.1*r)}</text>`; }).join("")}
    <path class="trend-line" d="${pathFromPoints(pts)}"/>
    ${pts.map((p,i) => `<circle cx="${p.x}" cy="${p.y}" r="7" fill="transparent" tabindex="0"><title>${timelineData.daily[i].date} · 累计 ${formatFull(values[i])} Token</title></circle>`).join("")}
    <text x="55" y="215">${formatDate(timelineData.daily[0].date)}</text><text x="${width-18}" y="215" text-anchor="end">${formatDate(timelineData.daily.at(-1).date)}</text></svg>`;
  const activeRows = timelineData.daily.filter((row) => row.usage.total > 0);
  const peak = activeRows.reduce((best, row) => !best || row.usage.total > best.usage.total ? row : best, null);
  const inputOutput = timelineData.totals.output ? timelineData.totals.input / timelineData.totals.output : null;
  const cacheRate = timelineData.totals.input ? timelineData.totals.cached / timelineData.totals.input * 100 : null;
  $("#cumulativeStats").innerHTML = `<div><span>${t("activeDay")}</span><strong>${activeRows.length} / ${timelineData.daily.length}</strong></div><div><span>${t("dailyUsage")}</span><strong>${formatNumber(timelineData.totals.total / Math.max(1, timelineData.daily.length))}</strong></div><div><span>${t("peakDay")}</span><strong>${peak ? formatDate(peak.date) : "—"}</strong><small>${peak ? formatNumber(peak.usage.total) + " Token" : t("noRecords")}</small></div><div><span>${t("cacheReuse")}</span><strong>${cacheRate === null ? "—" : cacheRate.toFixed(1) + "%"}</strong><small>${inputOutput === null ? t("noOutput") : t("inputOutput", { n:inputOutput.toFixed(1) })}</small></div>`;
  const weekdayTotals = Array.from({ length: 7 }, () => 0);
  for (const row of timelineData.daily) weekdayTotals[(new Date(`${row.date}T00:00:00`).getDay() + 6) % 7] += row.usage.total;
  const weekdayMax = Math.max(...weekdayTotals, 1);
  const weeklyWidth = Math.max(320, $("#weeklyPattern").clientWidth || 760);
  const weeklyHeight = 210, weeklyPad = { top: 28, right: 14, bottom: 34, left: 44 };
  const weeklyBottom = weeklyHeight - weeklyPad.bottom;
  const weeklyChartWidth = weeklyWidth - weeklyPad.left - weeklyPad.right;
  const weeklySlot = weeklyChartWidth / 7;
  const weeklyBarWidth = Math.min(48, weeklySlot * .56);
  $("#weeklyPattern").innerHTML = `<svg viewBox="0 0 ${weeklyWidth} ${weeklyHeight}" preserveAspectRatio="none" role="img" aria-label="${t("weekly")} Token"><defs><linearGradient id="weeklyBarGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--chart-a)"/><stop offset="100%" stop-color="var(--chart-c)"/></linearGradient></defs>
    ${[0,.25,.5,.75,1].map((ratio) => { const y = weeklyPad.top + (1 - ratio) * (weeklyBottom - weeklyPad.top); return `<line class="grid-line" x1="${weeklyPad.left}" x2="${weeklyWidth - weeklyPad.right}" y1="${y}" y2="${y}"/><text x="${weeklyPad.left - 8}" y="${y + 4}" text-anchor="end">${formatNumber(weekdayMax * ratio)}</text>`; }).join("")}
    ${weekdayTotals.map((value, index) => { const height = value / weekdayMax * (weeklyBottom - weeklyPad.top); const x = weeklyPad.left + index * weeklySlot + (weeklySlot - weeklyBarWidth) / 2; const y = weeklyBottom - height; return `<g class="weekday-bar" tabindex="0" aria-label="${weekdays()[index]}, ${formatFull(value)} Token"><title>${weekdays()[index]} · ${formatFull(value)} Token</title><rect x="${x}" y="${y}" width="${weeklyBarWidth}" height="${Math.max(2, height)}" rx="5"/><text x="${x + weeklyBarWidth / 2}" y="${Math.max(weeklyPad.top - 7, y - 7)}" text-anchor="middle">${value ? formatNumber(value) : ""}</text><text x="${x + weeklyBarWidth / 2}" y="${weeklyHeight - 10}" text-anchor="middle">${weekdays()[index]}</text></g>`; }).join("")}
  </svg>`;
  $("#modelShare").innerHTML = data.models.length ? data.models.map((row) => {
    const cacheRate = row.cacheRate;
    const unknown = row.pricingStatus === "unpriced";
    const cost = unknown ? t("unknownModelInfo") : row.pricingStatus === "proxy" ? `≈ ${formatMoney(row.estimatedCost, row.currency)} · ${t("proxyEstimate")}` : formatMoney(row.estimatedCost, row.currency);
    const provider = unknown ? t("unknownModelInfo") : `${row.provider}${row.pricingReference ? ` · ${row.pricingReference}` : ""}`;
    const name = unknown && row.name === "Unknown model" ? t("unknownModel") : row.name;
    return `<div class="model-efficiency-row"><div class="model-efficiency-head"><div><span>${escapeHtml(name)}</span><small>${escapeHtml(provider)}</small></div><b>${cacheRate === null ? "—" : `${cacheRate.toFixed(1)}%`}</b></div><div class="rank-bar cache-rate"><span style="width:${cacheRate || 0}%"></span></div><div class="model-efficiency-meta"><span>${t("cached")} ${formatNumber(row.usage.cached)} / ${t("input")} ${formatNumber(row.usage.input)}</span><span>${formatNumber(row.usage.total)} Token</span><strong>${cost}</strong></div></div>`;
  }).join("") : `<div class="empty">${t("noModel")}</div>`;
  $("#efficiencySummary").textContent = `${t("cacheRate")} = ${t("cached")} ÷ ${t("input")} · ${state.locale === "en" ? "Average per event" : "平均每个用量事件"} ${formatNumber(data.eventCount ? data.totals.total/data.eventCount : 0)} Token`;
}

const headerElement = $(".topbar");
function measureHeader() {}
document.fonts.ready.then(scheduleScrollUpdate);
// Use the sticky header's real lower edge as the reading line.
let scrollFrame = 0;
let navigationTarget = null;
let navigationTimeout = null;
function setActiveNavigation(target) {
  let activeButton;
  $$("[data-target]").forEach((button) => {
    const active = button.dataset.target === target;
    button.classList.toggle("active", active);
    if (active) activeButton = button;
    if (active) button.setAttribute("aria-current","location");
    else button.removeAttribute("aria-current");
  });
  const indicator = $(".nav-indicator");
  if (indicator && activeButton) {
    if (window.matchMedia("(max-width: 860px)").matches) {
      indicator.style.setProperty("--nav-x", `${activeButton.offsetLeft}px`);
      indicator.style.setProperty("--nav-width", `${activeButton.offsetWidth}px`);
    } else indicator.style.setProperty("--nav-y", `${activeButton.offsetTop}px`);
  }
}
function releaseNavigation() { navigationTarget = null; clearTimeout(navigationTimeout); scheduleScrollUpdate(); }
window.addEventListener("wheel", releaseNavigation, {passive:true});
window.addEventListener("touchstart", releaseNavigation, {passive:true});
window.addEventListener("scrollend", releaseNavigation);
function updateScrollState() {
  scrollFrame = 0;
  const header = $(".topbar");
  const compact = header.classList.contains("is-compact");
  if (!compact && window.scrollY > 110) header.classList.add("is-compact");
  else if (compact && window.scrollY < 35) header.classList.remove("is-compact");
  const edge = Math.max(0, header.getBoundingClientRect().bottom) + 28;
  const offset = `${Math.ceil(edge)}px`;
  if (document.documentElement.style.getPropertyValue("--anchor-offset") !== offset) document.documentElement.style.setProperty("--anchor-offset", offset);
  const buttons = $$("[data-target]");
  let active = buttons[0];
  for (const button of buttons) {
    if (document.getElementById(button.dataset.target).getBoundingClientRect().top <= edge + 12) active = button;
  }
  if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 3) active = buttons.at(-1);
  setActiveNavigation(navigationTarget || active.dataset.target);
}
function scheduleScrollUpdate() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollState);
}
window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
new ResizeObserver(scheduleScrollUpdate).observe($(".topbar"));

function render(data) {
  state.data = data;
  const useContextTimeline = data.range === "1" && state.contextData?.daily?.length > 1;
  const timelineData = useContextTimeline ? state.contextData : data;
  $("#trendHint").textContent = useContextTimeline ? t("recentReference") + t("hoverDetail") : t("hoverDetail");
  $("#heatHint").textContent = useContextTimeline ? t("recentReference") + t("heatHint") : t("heatHint");
  $("#cacheHint").textContent = useContextTimeline ? t("recentReference") + `${t("cachedInput")} ÷ ${t("input")}` : t("cacheHint");
  $("#cumulativeHint").textContent = useContextTimeline ? t("recentReference") + t("cumulativeHint").split(" · ")[0] : t("cumulativeHint");
  renderSummary(data); renderLimits(data); renderTrend(timelineData); renderMix(data); renderHeatmap(timelineData); renderRanking(data); renderDaily(data); renderExtraAnalysis(data, timelineData); updateExports(); scheduleScrollUpdate();
  const stamp = new Date(data.scannedAt).toLocaleTimeString(state.locale === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  state.nextRefresh = Date.now() + 30_000;
  updateClock();
  $("#footerStatus").textContent = t("localFile", { time:stamp, count:data.fileCount });
  $("#sourcePath").textContent = (data.sourceDirs || [data.sessionsDir]).join(" · ");
  $("#sourcePath").title = $("#sourcePath").textContent;
  const notice = $("#notice");
  if (data.scanWarnings?.length) {
    notice.textContent = data.scanWarnings.map((warning) => t(warning.code === "zstd-unavailable" ? "zstdUnavailable" : "scanIncomplete", { n:warning.count })).join(" ");
    notice.classList.remove("hidden");
  }
  else if (!data.fileCount) { notice.textContent = t("noFiles", { path:data.sessionsDir }); notice.classList.remove("hidden"); }
  else notice.classList.add("hidden");
  animateVisuals();
}

async function refresh({ animate = false } = {}) {
  const requestId = ++state.requestId;
  if (state.controller) state.controller.abort();
  state.controller = new AbortController();
  const button = $("#refresh"); button.classList.add("loading"); button.disabled = true;
  try {
    const usageRequest = fetch(`/api/usage?range=${encodeURIComponent(state.range)}`, { cache: "no-store", signal: state.controller.signal });
    const contextRequest = state.range === "1"
      ? fetch("/api/usage?range=7", { cache: "no-store", signal: state.controller.signal })
      : Promise.resolve(null);
    const [response, contextResponse] = await Promise.all([usageRequest, contextRequest]);
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "无法读取用量数据");
    const contextData = contextResponse?.ok ? await contextResponse.json() : null;
    if (requestId === state.requestId) { state.contextData = contextData; state.motion = animate; hideTooltip(); render(data); state.motion = false; }
  } catch (error) {
    if (error.name === "AbortError" || requestId !== state.requestId) return;
    const notice = $("#notice"); notice.textContent = t("refreshFailed", { message:error.message }); notice.classList.remove("hidden");
  } finally {
    if (requestId === state.requestId) {
      button.classList.remove("loading"); button.disabled = false;
      state.nextRefresh = Date.now() + 30_000;
      clearTimeout(state.timer);
       state.timer = setTimeout(refresh, 30_000);
    }
  }
}

$("#rangeSlider").addEventListener("input", (event) => updateRangeUI(Number(event.currentTarget.value)));
$("#rangeSlider").addEventListener("change", (event) => { const range = rangeValues[Number(event.currentTarget.value)]; if (range !== state.range) { state.range = range; refresh({ animate:true }); } });
$$('[data-rank]').forEach((button) => button.addEventListener("click", () => { state.rank = button.dataset.rank; $$('[data-rank]').forEach((item) => item.classList.toggle("active", item === button)); if (state.data) renderRanking(state.data); }));
$$('[data-target]').forEach((button) => button.addEventListener("click", () => {
  navigationTarget = button.dataset.target;
  setActiveNavigation(navigationTarget);
  clearTimeout(navigationTimeout);
  navigationTimeout = setTimeout(releaseNavigation, 1400);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(button.dataset.target).scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
}));
$("#refresh").addEventListener("click", () => refresh({ animate:true }));
$("#themeToggle").addEventListener("click", () => { state.theme = state.theme === "dark" ? "light" : "dark"; localStorage.setItem("follow-your-codex:theme", state.theme); applyPreferences({ rerender:true }); });
$("#localeToggle").addEventListener("click", () => { state.locale = state.locale === "zh" ? "en" : "zh"; localStorage.setItem("follow-your-codex:locale", state.locale); applyPreferences({ rerender:true }); });
window.addEventListener("resize", () => { scheduleScrollUpdate(); clearTimeout(state.resizeTimer); state.resizeTimer = setTimeout(() => { measureHeader(); if (state.data) { const timelineData = state.data.range === "1" && state.contextData?.daily?.length > 1 ? state.contextData : state.data; renderTrend(timelineData); renderExtraAnalysis(state.data, timelineData); } }, 160); });

function updateClock() {
  if (!state.data) return;
  const stamp = new Date(state.data.scannedAt).toLocaleTimeString(state.locale === "en" ? "en-US" : "zh-CN", {hour:"2-digit",minute:"2-digit",second:"2-digit"});
  $("#headerStatus").textContent = t("autoRefresh", { time:stamp, seconds:Math.max(0, Math.ceil((state.nextRefresh-Date.now())/1000)) });
}

refresh({ animate:true });
setInterval(updateClock, 1000);
