"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { estimateCost, isExcludedExternalModel, resolvePrice } = require("./pricing");

const TOKEN_FIELDS = ["input", "cached", "output", "reasoning", "total"];

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function emptyUsage() {
  return { input: 0, cached: 0, output: 0, reasoning: 0, total: 0 };
}

function readUsage(value) {
  if (!value || typeof value !== "object") return null;
  // Codex has historically written flat *_tokens fields. The public usage
  // shape also permits nested cache/reasoning details, so retain both forms.
  const input = finiteNumber(value.input_tokens);
  const output = finiteNumber(value.output_tokens);
  const cached = finiteNumber(value.cached_input_tokens ?? value.input_tokens_details?.cached_tokens);
  const reasoning = finiteNumber(value.reasoning_output_tokens ?? value.output_tokens_details?.reasoning_tokens);
  const declaredTotal = Number(value.total_tokens);
  const usage = {
    input,
    cached,
    output,
    reasoning,
    total: Number.isFinite(declaredTotal) && declaredTotal >= 0 ? declaredTotal : input + output,
  };
  return Object.values(usage).some(Boolean) ? usage : null;
}

function addUsage(target, value) {
  for (const field of TOKEN_FIELDS) target[field] += finiteNumber(value[field]);
  return target;
}

function usageDelta(current, previous) {
  const delta = emptyUsage();
  for (const field of TOKEN_FIELDS) {
    delta[field] = Math.max(0, finiteNumber(current[field]) - finiteNumber(previous[field]));
  }
  return delta;
}

function hasUsage(value) {
  return value && TOKEN_FIELDS.some((field) => finiteNumber(value[field]) > 0);
}

function parseTimestamp(value, fallbackMs) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : fallbackMs;
}

function parseRateWindow(value) {
  if (!value || typeof value !== "object") return null;
  const usedPercent = Number(value.used_percent);
  const windowMinutes = Number(value.window_minutes);
  const resetsAt = Number(value.resets_at);
  if (!Number.isFinite(usedPercent)) return null;
  return {
    usedPercent: Math.min(100, Math.max(0, usedPercent)),
    windowMinutes: Number.isFinite(windowMinutes) ? windowMinutes : null,
    resetsAt: Number.isFinite(resetsAt) ? resetsAt * 1000 : null,
  };
}

function safeBasename(value) {
  if (!value || typeof value !== "string") return "Unknown project";
  const normalized = value.replace(/[\\/]+$/, "");
  return path.basename(normalized) || "Unknown project";
}

/**
 * Read only the metadata records needed for accounting. Prompt, response,
 * tool output and file content events are deliberately ignored.
 */
function parseSessionText(text, filePath = "session.jsonl", fallbackMs = Date.now()) {
  let sessionId = path.basename(filePath, path.extname(filePath));
  let project = "Unknown project";
  let model = "Unknown model";
  let previousTotal = null;
  let latestContext = null;
  let latestLimits = null;
  let latestLimitsAt = 0;
  const events = [];

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      // Codex may be appending the final line while we scan it.
      continue;
    }

    const payload = record && typeof record.payload === "object" ? record.payload : {};
    if (record.type === "session_meta") {
      if (typeof payload.id === "string" && payload.id) sessionId = payload.id;
      if (typeof payload.cwd === "string" && payload.cwd) project = safeBasename(payload.cwd);
      continue;
    }
    if (record.type === "turn_context") {
      if (typeof payload.model === "string" && payload.model) model = payload.model;
      if (typeof payload.cwd === "string" && payload.cwd) project = safeBasename(payload.cwd);
      continue;
    }
    if (record.type !== "event_msg" || payload.type !== "token_count") continue;

    // Retain compatibility if a newer Codex log supplies the model directly
    // on the usage event rather than only in a preceding turn context record.
    if (typeof payload.model === "string" && payload.model) model = payload.model;

    const timestamp = parseTimestamp(record.timestamp, fallbackMs);
    const info = payload.info && typeof payload.info === "object" ? payload.info : {};
    const currentTotal = readUsage(info.total_token_usage);
    const lastUsage = readUsage(info.last_token_usage);
    let usage = null;

    if (currentTotal && previousTotal) {
      usage = usageDelta(currentTotal, previousTotal);
      // Equal cumulative snapshots are duplicates, not additional requests.
      if (currentTotal.total < previousTotal.total && hasUsage(lastUsage)) usage = lastUsage;
    } else if (lastUsage) {
      usage = lastUsage;
    } else if (currentTotal) {
      usage = currentTotal;
    }
    if (currentTotal) previousTotal = currentTotal;

    if (hasUsage(usage)) {
      events.push({ timestamp, model, project, sessionId, usage });
    }

    const contextWindow = Number(info.model_context_window);
    const contextUsage = lastUsage || currentTotal;
    if (contextUsage && Number.isFinite(contextWindow) && contextWindow > 0) {
      latestContext = {
        timestamp,
        used: contextUsage.total,
        limit: contextWindow,
        percent: Math.min(100, (contextUsage.total / contextWindow) * 100),
      };
    }

    const limits = payload.rate_limits;
    if (limits && typeof limits === "object" && timestamp >= latestLimitsAt) {
      const primary = parseRateWindow(limits.primary);
      const secondary = parseRateWindow(limits.secondary);
      if (primary || secondary) {
        latestLimits = {
          timestamp,
          planType: typeof limits.plan_type === "string" ? limits.plan_type : null,
          primary,
          secondary,
        };
        latestLimitsAt = timestamp;
      }
    }
  }

  const total = events.reduce((sum, event) => addUsage(sum, event.usage), emptyUsage());
  const updatedAt = events.reduce((latest, event) => Math.max(latest, event.timestamp), 0);
  return { filePath, sessionId, project, model, events, total, updatedAt, latestContext, latestLimits };
}

function discoverCodexHome(override) {
  if (override) return path.resolve(override);
  if (process.env.CODEX_HOME) return path.resolve(process.env.CODEX_HOME);
  return path.join(os.homedir(), ".codex");
}

function listJsonlFiles(root) {
  const files = [];
  if (!fs.existsSync(root)) return files;
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(fullPath);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".jsonl")) files.push(fullPath);
    }
  }
  return files;
}

class CodexScanner {
  constructor(options = {}) {
    this.codexHome = discoverCodexHome(options.codexHome);
    this.sessionsDir = path.join(this.codexHome, "sessions");
    this.cache = new Map();
  }

  scan() {
    const files = listJsonlFiles(this.sessionsDir);
    const seen = new Set(files);
    for (const filePath of files) {
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }
      const cached = this.cache.get(filePath);
      if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) continue;
      try {
        const text = fs.readFileSync(filePath, "utf8");
        const parsed = parseSessionText(text, filePath, stat.mtimeMs);
        this.cache.set(filePath, { size: stat.size, mtimeMs: stat.mtimeMs, parsed });
      } catch {
        // A transiently locked file remains eligible for the next refresh.
      }
    }
    for (const cachedPath of this.cache.keys()) {
      if (!seen.has(cachedPath)) this.cache.delete(cachedPath);
    }
    return aggregate([...this.cache.values()].map((item) => item.parsed), this.codexHome);
  }
}

function localDateKey(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function aggregate(parsedFiles, codexHome) {
  const events = parsedFiles.flatMap((session) => session.events);
  events.sort((a, b) => a.timestamp - b.timestamp);

  let latestLimits = null;
  let latestContext = null;
  for (const session of parsedFiles) {
    if (session.latestLimits && (!latestLimits || session.latestLimits.timestamp > latestLimits.timestamp)) {
      latestLimits = session.latestLimits;
    }
    if (session.latestContext && (!latestContext || session.latestContext.timestamp > latestContext.timestamp)) {
      latestContext = session.latestContext;
    }
  }

  const sessions = parsedFiles
    .filter((session) => hasUsage(session.total))
    .map((session) => ({
      id: session.sessionId,
      project: session.project,
      model: session.model,
      firstAt: session.events.length ? session.events[0].timestamp : session.updatedAt,
      updatedAt: session.updatedAt,
      eventCount: session.events.length,
      durationMs: session.events.length > 1
        ? session.events.at(-1).timestamp - session.events[0].timestamp
        : 0,
      usage: session.total,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return {
    codexHome,
    sessionsDir: path.join(codexHome, "sessions"),
    scannedAt: Date.now(),
    fileCount: parsedFiles.length,
    events,
    sessions,
    latestLimits,
    latestContext,
  };
}

function rangeStart(range, now = new Date()) {
  if (range === "all") return 0;
  const days = Math.max(1, Number.parseInt(range, 10) || 30);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  return start.getTime();
}

function dateKeysForRange(range, events, now = new Date()) {
  if (range === "all") {
    if (!events.length) return [localDateKey(now.getTime())];
    const first = new Date(events[0].timestamp);
    const keys = [];
    for (let cursor = new Date(first.getFullYear(), first.getMonth(), first.getDate()); cursor <= now; cursor.setDate(cursor.getDate() + 1)) {
      keys.push(localDateKey(cursor.getTime()));
    }
    return keys;
  }
  const days = Math.max(1, Number.parseInt(range, 10) || 30);
  const keys = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    keys.push(localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset).getTime()));
  }
  return keys;
}

function buildView(snapshot, range = "30", now = new Date()) {
  const start = rangeStart(range, now);
  const selected = snapshot.events.filter((event) => (
    event.timestamp >= start && event.timestamp <= now.getTime() && !isExcludedExternalModel(event.model)
  ));
  const totals = selected.reduce((sum, event) => addUsage(sum, event.usage), emptyUsage());
  const todayKey = localDateKey(now.getTime());
  const today = selected
    .filter((event) => localDateKey(event.timestamp) === todayKey)
    .reduce((sum, event) => addUsage(sum, event.usage), emptyUsage());

  const dayMap = new Map();
  const dayEvents = new Map();
  for (const key of dateKeysForRange(range, selected, now)) {
    dayMap.set(key, emptyUsage());
    dayEvents.set(key, 0);
  }
  for (const event of selected) {
    const key = localDateKey(event.timestamp);
    if (!dayMap.has(key)) dayMap.set(key, emptyUsage());
    addUsage(dayMap.get(key), event.usage);
    dayEvents.set(key, (dayEvents.get(key) || 0) + 1);
  }

  const modelMap = new Map();
  const projectMap = new Map();
  for (const event of selected) {
    const model = event.model || "Unknown model";
    const project = event.project || "Unknown project";
    if (!modelMap.has(model)) modelMap.set(model, emptyUsage());
    if (!projectMap.has(project)) projectMap.set(project, emptyUsage());
    addUsage(modelMap.get(model), event.usage);
    addUsage(projectMap.get(project), event.usage);
  }

  const rank = (map) => [...map.entries()]
    .map(([name, usage]) => ({ name, usage }))
    .sort((a, b) => b.usage.total - a.usage.total);

  const selectedSessions = snapshot.sessions
    .map((session) => {
      const sessionEvents = selected.filter((event) => event.sessionId === session.id);
      const usage = sessionEvents.reduce((sum, event) => addUsage(sum, event.usage), emptyUsage());
      return {
        ...session,
        firstAt: sessionEvents.length ? sessionEvents[0].timestamp : session.firstAt,
        updatedAt: sessionEvents.length ? sessionEvents.at(-1).timestamp : session.updatedAt,
        eventCount: sessionEvents.length,
        durationMs: sessionEvents.length > 1
          ? sessionEvents.at(-1).timestamp - sessionEvents[0].timestamp
          : 0,
        usage,
      };
    })
    .filter((session) => hasUsage(session.usage))
    .sort((a, b) => b.usage.total - a.usage.total);

  const daily = [...dayMap.entries()].map(([date, usage]) => ({
    date,
    usage,
    events: dayEvents.get(date) || 0,
  }));
  const activeRows = daily.filter((item) => item.usage.total > 0);
  const peakDay = activeRows.reduce((peak, item) => !peak || item.usage.total > peak.usage.total ? item : peak, null);
  const daysInRange = Math.max(1, daily.length);
  const averagePerDay = totals.total / daysInRange;
  const recentRows = daily.slice(-Math.min(7, daily.length));
  const recentAverage = recentRows.reduce((sum, item) => sum + item.usage.total, 0) / Math.max(1, recentRows.length);

  const numericDays = range === "all" ? null : Math.max(1, Number.parseInt(range, 10) || 30);
  let comparison = null;
  if (numericDays) {
    const previousStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - numericDays * 2 + 1).getTime();
    const previousEnd = start;
    const previousTotal = snapshot.events
      .filter((event) => event.timestamp >= previousStart && event.timestamp < previousEnd)
      .reduce((sum, event) => sum + event.usage.total, 0);
    comparison = {
      previousTotal,
      percent: previousTotal > 0 ? ((totals.total - previousTotal) / previousTotal) * 100 : null,
    };
  }

  const hourMap = Array.from({ length: 24 }, (_, hour) => ({ hour, total: 0, events: 0 }));
  const weekdayMap = Array.from({ length: 7 }, (_, weekday) => ({ weekday, total: 0, events: 0 }));
  const heatmap = Array.from({ length: 7 }, (_, weekday) => (
    Array.from({ length: 24 }, (_, hour) => ({ weekday, hour, total: 0, events: 0 }))
  ));
  for (const event of selected) {
    const date = new Date(event.timestamp);
    const hour = date.getHours();
    const weekday = (date.getDay() + 6) % 7;
    hourMap[hour].total += event.usage.total;
    hourMap[hour].events += 1;
    weekdayMap[weekday].total += event.usage.total;
    weekdayMap[weekday].events += 1;
    heatmap[weekday][hour].total += event.usage.total;
    heatmap[weekday][hour].events += 1;
  }
  const busiestHour = hourMap.reduce((peak, item) => item.total > peak.total ? item : peak, hourMap[0]);
  const busiestWeekday = weekdayMap.reduce((peak, item) => item.total > peak.total ? item : peak, weekdayMap[0]);

  let streak = 0;
  const activeDates = new Set(activeRows.map((item) => item.date));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!activeDates.has(localDateKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  while (activeDates.has(localDateKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const cost = estimateCost(selected);
  const costByModel = new Map(cost.models.map((row) => [row.model, row]));
  const models = rank(modelMap).map((row) => {
    const modelCost = costByModel.get(row.name);
    const price = resolvePrice(row.name);
    return {
      ...row,
      provider: modelCost?.label || price?.label || "未配置价格",
      currency: modelCost?.currency || price?.currency || null,
      estimatedCost: modelCost?.amount ?? null,
      pricingStatus: modelCost?.billing || (price ? "metered" : "unpriced"),
      pricingReference: modelCost?.referenceModel || null,
      cacheRate: row.usage.input ? Math.min(100, row.usage.cached / row.usage.input * 100) : null,
    };
  });

  return {
    app: { name: "follow your codex", version: "0.4.0" },
    range,
    codexHome: snapshot.codexHome,
    sessionsDir: snapshot.sessionsDir,
    scannedAt: snapshot.scannedAt,
    fileCount: snapshot.fileCount,
    eventCount: selected.length,
    totals,
    today,
    cost,
    todayCost: estimateCost(selected.filter((event) => localDateKey(event.timestamp) === todayKey)),
    daily,
    hourly: hourMap,
    weekdays: weekdayMap,
    heatmap: heatmap.flat(),
    models,
    projects: rank(projectMap),
    sessions: selectedSessions.slice(0, 20),
    sessionCount: selectedSessions.length,
    insights: {
      activeDays: activeRows.length,
      averagePerDay,
      recentAverage,
      projected30Days: recentAverage * 30,
      peakDay,
      busiestHour,
      busiestWeekday,
      streak,
      comparison,
    },
    latestLimits: snapshot.latestLimits,
    latestContext: snapshot.latestContext,
  };
}

module.exports = {
  CodexScanner,
  aggregate,
  buildView,
  discoverCodexHome,
  emptyUsage,
  parseSessionText,
  readUsage,
  usageDelta,
};
