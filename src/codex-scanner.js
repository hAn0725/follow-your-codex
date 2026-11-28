"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const { version } = require("../package.json");
const { estimateCost, isExcludedModel, resolvePrice } = require("./pricing");

const TOKEN_FIELDS = ["input", "cached", "output", "reasoning", "total"];
const CACHE_VERSION = 2;

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
  let sessionId = path.basename(filePath).replace(/\.jsonl(?:\.zst)?$/i, "");
  let project = "Unknown project";
  let model = "Unknown model";
  let previousTotal = null;
  let latestContext = null;
  let latestLimits = null;
  let latestLimitsAt = 0;
  const events = [];
  const responseIds = new Set();
  let turnId = "unknown-turn";
  const modernTurns = new Set();
  const turnContexts = new Map();
  const pendingTurnUsage = new Map();

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    // Response items hold conversation/tool content rather than usage metadata.
    // Skip only when the top-level type is unambiguous; otherwise parse normally.
    if (/^\s*\{\s*(?:"timestamp"\s*:\s*"(?:[^"\\]|\\.)*"\s*,\s*)?"type"\s*:\s*"response_item"\s*[,}]/.test(line)) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      // Codex may be appending the final line while we scan it.
      continue;
    }

    if (!record || typeof record !== "object") continue;
    const payload = record.payload && typeof record.payload === "object" ? record.payload : {};
    if (record.type === "session_meta") {
      if (typeof payload.id === "string" && payload.id) sessionId = payload.id;
      if (typeof payload.cwd === "string" && payload.cwd) project = safeBasename(payload.cwd);
      continue;
    }
    if (record.type === "turn_context") {
      if (typeof payload.turn_id === "string" && payload.turn_id) turnId = payload.turn_id;
      if (typeof payload.model === "string" && payload.model) model = payload.model;
      if (typeof payload.cwd === "string" && payload.cwd) project = safeBasename(payload.cwd);
      if (typeof payload.turn_id === "string" && payload.turn_id) {
        const context = {
          model: typeof payload.model === "string" && payload.model ? payload.model : "Unknown model",
          project,
        };
        turnContexts.set(turnId, context);
        // The desktop can persist a usage record before its turn context.
        for (const event of pendingTurnUsage.get(turnId) || []) {
          if (event.model === "Unknown model") event.model = context.model;
          event.project = context.project;
        }
        pendingTurnUsage.delete(turnId);
      }
      continue;
    }
    const modernUsage = record.type === "token_usage_record";
    if (!modernUsage && (record.type !== "event_msg" || payload.type !== "token_count")) continue;

    // Retain compatibility if a newer Codex log supplies the model directly
    // on the usage event rather than only in a preceding turn context record.
    const reportedModel = typeof payload.model === "string" && payload.model ? payload.model : null;

    const timestamp = parseTimestamp(record.timestamp, fallbackMs);
    const info = payload.info && typeof payload.info === "object" ? payload.info : {};
    // Modern thread totals and legacy totals can use different baselines.
    // Prefer per-response records for each migrated turn instead of mixing them.
    const responseId = modernUsage && typeof payload.response_id === "string" ? payload.response_id : null;
    if (modernUsage) {
      const usage = readUsage(payload.usage);
      if (hasUsage(usage)) {
        if (responseId && responseIds.has(responseId)) continue;
        if (responseId) responseIds.add(responseId);
        const explicitTurn = typeof payload.turn_id === "string" && payload.turn_id ? payload.turn_id : null;
        const key = explicitTurn || turnId;
        const context = explicitTurn && turnContexts.get(explicitTurn);
        modernTurns.add(key);
        const event = {
          timestamp,
          model: reportedModel || context?.model || (explicitTurn ? "Unknown model" : model),
          project: context?.project || project,
          sessionId, usage, turnId: key, modern: true,
          ...(responseId ? { responseId } : {}),
        };
        events.push(event);
        if (explicitTurn && !context) {
          if (!pendingTurnUsage.has(key)) pendingTurnUsage.set(key, []);
          pendingTurnUsage.get(key).push(event);
        }
      }
      continue;
    }
    if (reportedModel) model = reportedModel;
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
      events.push({ timestamp, model, project, sessionId, usage, turnId });
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

  const selectedEvents = events.filter((event) => event.modern || !modernTurns.has(event.turnId));
  const total = selectedEvents.reduce((sum, event) => addUsage(sum, event.usage), emptyUsage());
  const updatedAt = selectedEvents.reduce((latest, event) => Math.max(latest, event.timestamp), 0);
  return { filePath, sessionId, project, model, events: selectedEvents, total, updatedAt, latestContext, latestLimits };
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
      else if (entry.isFile() && /\.jsonl(?:\.zst)?$/i.test(entry.name)) files.push(fullPath);
    }
  }
  return files;
}

function validCachedSession(value, filePath) {
  return value && value.filePath === filePath && typeof value.sessionId === "string"
    && typeof value.model === "string" && typeof value.project === "string" && Array.isArray(value.events)
    && value.events.every((event) => event && Number.isFinite(event.timestamp)
      && typeof event.sessionId === "string" && typeof event.model === "string" && typeof event.project === "string"
      && event.usage && TOKEN_FIELDS.every((field) => Number.isFinite(event.usage[field]) && event.usage[field] >= 0))
    && [value.latestContext, value.latestLimits].every((item) => item == null || Number.isFinite(item.timestamp));
}

class CodexScanner {
  constructor(options = {}) {
    this.codexHome = discoverCodexHome(options.codexHome);
    this.sessionsDir = path.join(this.codexHome, "sessions");
    this.archivedSessionsDir = path.join(this.codexHome, "archived_sessions");
    this.cache = new Map();
    this.cacheFile = options.persistentCacheDir
      ? path.join(options.persistentCacheDir, `scan-${crypto.createHash("sha256").update(this.codexHome).digest("hex")}.json`)
      : null;
    this.lastSavedAt = 0;
    this.cacheDirty = false;
    this.loadCache();
  }

  loadCache() {
    if (!this.cacheFile) return;
    try {
      const saved = JSON.parse(fs.readFileSync(this.cacheFile, "utf8"));
      if (saved.version !== CACHE_VERSION || saved.codexHome !== this.codexHome || !Array.isArray(saved.files)) return;
      for (const item of saved.files) {
        if (typeof item.path === "string" && Number.isFinite(item.size) && Number.isFinite(item.mtimeMs)
            && Number.isFinite(item.ctimeMs) && validCachedSession(item.parsed, item.path)) {
          this.cache.set(item.path, { size:item.size, mtimeMs:item.mtimeMs, ctimeMs:item.ctimeMs, parsed:item.parsed });
        }
      }
      this.lastSavedAt = Date.now();
    } catch {
      // An absent, unreadable, or invalid cache always falls back to source logs.
    }
  }

  saveCache() {
    if (!this.cacheFile) return false;
    const temporary = `${this.cacheFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.cacheFile), { recursive:true });
      const files = [...this.cache].map(([filePath, entry]) => ({ path:filePath, ...entry }));
      fs.writeFileSync(temporary, JSON.stringify({ version:CACHE_VERSION, codexHome:this.codexHome, files }), { mode:0o600 });
      fs.renameSync(temporary, this.cacheFile);
      return true;
    } catch {
      // Cache persistence is optional; accounting still uses the source files.
      try { fs.unlinkSync(temporary); } catch { /* no temporary file */ }
      return false;
    }
  }

  scan() {
    const files = [...listJsonlFiles(this.sessionsDir), ...listJsonlFiles(this.archivedSessionsDir)];
    const seen = new Set(files);
    const failures = new Map();
    let changed = false;
    const warn = (code) => failures.set(code, (failures.get(code) || 0) + 1);
    for (const filePath of files) {
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch {
        warn("read-failed");
        if (this.cache.delete(filePath)) changed = true;
        continue;
      }
      const cached = this.cache.get(filePath);
      if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs && cached.ctimeMs === stat.ctimeMs) continue;
      if (filePath.toLowerCase().endsWith(".zst") && typeof zlib.zstdDecompressSync !== "function") {
        warn("zstd-unavailable");
        if (this.cache.delete(filePath)) changed = true;
        continue;
      }
      try {
        const bytes = fs.readFileSync(filePath);
        const text = filePath.toLowerCase().endsWith(".zst")
          ? zlib.zstdDecompressSync(bytes).toString("utf8")
          : bytes.toString("utf8");
        const parsed = parseSessionText(text, filePath, stat.mtimeMs);
        this.cache.set(filePath, { size: stat.size, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs, parsed });
        changed = true;
      } catch {
        // A transiently locked file remains eligible for the next refresh.
        warn("read-failed");
        if (this.cache.delete(filePath)) changed = true;
      }
    }
    for (const cachedPath of this.cache.keys()) {
      if (!seen.has(cachedPath)) { this.cache.delete(cachedPath); changed = true; }
    }
    this.cacheDirty ||= changed;
    // A stale cache is safe: every file is validated again on the next start.
    // Limit whole-cache rewrites when active sessions change every refresh.
    if (this.cacheDirty && (!this.lastSavedAt || Date.now() - this.lastSavedAt >= 60_000) && this.saveCache()) {
      this.cacheDirty = false;
      this.lastSavedAt = Date.now();
    }
    const snapshot = aggregate([...this.cache.values()].map((item) => item.parsed), this.codexHome);
    snapshot.scanWarnings = [...failures].map(([code, count]) => ({ code, count }));
    snapshot.discoveredFileCount = files.length;
    snapshot.compressedFileCount = files.filter((file) => file.toLowerCase().endsWith(".zst")).length;
    return snapshot;
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
  // Archive moves and copied logs must not multiply the same session.
  const bySession = new Map();
  for (const session of parsedFiles) {
    if (!bySession.has(session.sessionId)) {
      bySession.set(session.sessionId, { ...session, events: [], eventKeys: new Set() });
    }
    const merged = bySession.get(session.sessionId);
    for (const event of session.events) {
      const key = event.responseId || JSON.stringify([event.timestamp, event.model, event.usage]);
      if (merged.eventKeys.has(key)) continue;
      merged.eventKeys.add(key);
      merged.events.push(event);
    }
    for (const field of ["latestLimits", "latestContext"]) {
      if (session[field] && (!merged[field] || session[field].timestamp > merged[field].timestamp)) merged[field] = session[field];
    }
  }
  const uniqueSessions = [...bySession.values()];
  for (const session of uniqueSessions) {
    const modernTurns = new Set(session.events.filter((event) => event.modern).map((event) => event.turnId));
    session.events = session.events.filter((event) => event.modern || !modernTurns.has(event.turnId));
    session.events.sort((a, b) => a.timestamp - b.timestamp);
    session.total = session.events.reduce((sum, event) => addUsage(sum, event.usage), emptyUsage());
    session.updatedAt = session.events.at(-1)?.timestamp || session.updatedAt;
  }
  const events = uniqueSessions.flatMap((session) => session.events);
  events.sort((a, b) => a.timestamp - b.timestamp);

  let latestLimits = null;
  let latestContext = null;
  for (const session of uniqueSessions) {
    if (session.latestLimits && (!latestLimits || session.latestLimits.timestamp > latestLimits.timestamp)) {
      latestLimits = session.latestLimits;
    }
    if (session.latestContext && (!latestContext || session.latestContext.timestamp > latestContext.timestamp)) {
      latestContext = session.latestContext;
    }
  }

  const sessions = uniqueSessions
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
    sourceDirs: [path.join(codexHome, "sessions"), path.join(codexHome, "archived_sessions")],
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
  if (range === "1") return now.getTime() - 24 * 60 * 60 * 1000;
  const days = Math.max(1, Number.parseInt(range, 10) || 30);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  return start.getTime();
}

function dateKeysForRange(range, events, now = new Date()) {
  if (range === "1") {
    const first = new Date(rangeStart(range, now));
    const keys = [];
    for (let cursor = new Date(first.getFullYear(), first.getMonth(), first.getDate()); cursor <= now; cursor.setDate(cursor.getDate() + 1)) {
      keys.push(localDateKey(cursor.getTime()));
    }
    return keys;
  }
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

function quotaPace(window, sampledAt, now) {
  if (!window || !Number.isFinite(sampledAt) || !Number.isFinite(window.resetsAt)
    || !Number.isFinite(window.windowMinutes) || window.windowMinutes <= 0
    || !Number.isFinite(window.usedPercent) || sampledAt > now || now >= window.resetsAt) return null;
  const duration = window.windowMinutes * 60_000;
  const elapsed = sampledAt - (window.resetsAt - duration);
  if (elapsed <= 0 || elapsed >= duration) return null;
  const elapsedPercent = Math.round(elapsed / duration * 1000) / 10;
  return { elapsedPercent, delta: Math.round((window.usedPercent - elapsedPercent) * 10) / 10 };
}

function priceSeriesBucket(events) {
  const { usd, pricedTokens, unpricedTokens, models } = estimateCost(events);
  return { estimatedUsd: usd, pricedTokens, unpricedTokens, models };
}

function buildView(snapshot, range = "30", now = new Date()) {
  const start = rangeStart(range, now);
  const end = now.getTime();
  const includedEvents = snapshot.events.filter((event) => !isExcludedModel(event.model));
  const selected = includedEvents.filter((event) => event.timestamp >= start && event.timestamp <= end);
  const totals = selected.reduce((sum, event) => addUsage(sum, event.usage), emptyUsage());
  const todayKey = localDateKey(now.getTime());
  const today = selected
    .filter((event) => localDateKey(event.timestamp) === todayKey)
    .reduce((sum, event) => addUsage(sum, event.usage), emptyUsage());

  const dayMap = new Map();
  const dayEvents = new Map();
  for (const key of dateKeysForRange(range, selected, now)) {
    dayMap.set(key, emptyUsage());
  }
  for (const event of selected) {
    const key = localDateKey(event.timestamp);
    if (!dayMap.has(key)) dayMap.set(key, emptyUsage());
    addUsage(dayMap.get(key), event.usage);
    if (!dayEvents.has(key)) dayEvents.set(key, []);
    dayEvents.get(key).push(event);
  }

  const modelMap = new Map();
  const projectMap = new Map();
  for (const event of selected) {
    const model = event.model;
    const project = event.project || "Unknown project";
    if (!modelMap.has(model)) modelMap.set(model, emptyUsage());
    if (!projectMap.has(project)) projectMap.set(project, emptyUsage());
    addUsage(modelMap.get(model), event.usage);
    addUsage(projectMap.get(project), event.usage);
  }

  const rank = (map) => [...map.entries()]
    .map(([name, usage]) => ({ name, usage }))
    .sort((a, b) => b.usage.total - a.usage.total);

  const eventsBySession = new Map();
  for (const event of selected) {
    if (!eventsBySession.has(event.sessionId)) eventsBySession.set(event.sessionId, []);
    eventsBySession.get(event.sessionId).push(event);
  }
  const selectedSessions = snapshot.sessions
    .map((session) => {
      const sessionEvents = eventsBySession.get(session.id) || [];
      const usage = sessionEvents.reduce((sum, event) => addUsage(sum, event.usage), emptyUsage());
      return {
        ...session,
        model: sessionEvents.at(-1)?.model ?? session.model,
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

  const daily = [...dayMap.entries()].map(([date, usage]) => {
    const events = dayEvents.get(date) || [];
    const modelUsage = new Map();
    for (const { model, usage: eventUsage } of events) {
      if (!modelUsage.has(model)) modelUsage.set(model, emptyUsage());
      addUsage(modelUsage.get(model), eventUsage);
    }
    const { models, ...price } = priceSeriesBucket(events);
    const prices = new Map(models.map((row) => [row.model, row.amount]));
    return {
      date, usage, events: events.length, ...price,
      models: rank(modelUsage).map((row) => ({ ...row, estimatedUsd: prices.get(row.name) ?? null })),
    };
  });
  const activeRows = daily.filter((item) => item.usage.total > 0);
  const peakDay = activeRows.reduce((peak, item) => !peak || item.usage.total > peak.usage.total ? item : peak, null);
  const daysInRange = range === "1" ? 1 : Math.max(1, daily.length);
  const averagePerDay = totals.total / daysInRange;
  const recentStart = rangeStart("7", now);
  const recentAverage = includedEvents
    .filter((event) => event.timestamp >= recentStart && event.timestamp <= end)
    .reduce((sum, event) => sum + event.usage.total, 0) / 7;

  const numericDays = range === "all" ? null : Math.max(1, Number.parseInt(range, 10) || 30);
  let comparison = null;
  if (numericDays) {
    const previousStart = range === "1" ? start - 24 * 60 * 60 * 1000
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - numericDays * 2 + 1).getTime();
    const previousEnd = start;
    const previousTotal = includedEvents
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
  // Equal elapsed-hour buckets keep exactly 24 hours across midnight and DST.
  // The final bucket includes the endpoint; all earlier buckets are half-open.
  const timeline = range === "1" ? {
    granularity: "hour",
    startAt: start,
    endAt: now.getTime(),
    buckets: Array.from({ length: 24 }, (_, index) => ({
      startAt: start + index * 3_600_000,
      endAt: start + (index + 1) * 3_600_000,
      usage: emptyUsage(), events: 0,
    })),
  } : null;
  if (timeline) {
    const bucketEvents = timeline.buckets.map(() => []);
    for (const event of selected) {
      const index = Math.min(23, Math.floor((event.timestamp - start) / 3_600_000));
      addUsage(timeline.buckets[index].usage, event.usage);
      timeline.buckets[index].events += 1;
      bucketEvents[index].push(event);
    }
    timeline.buckets.forEach((bucket, index) => {
      const { estimatedUsd, pricedTokens, unpricedTokens } = priceSeriesBucket(bucketEvents[index]);
      Object.assign(bucket, { estimatedUsd, pricedTokens, unpricedTokens });
    });
  }
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
    app: { name: "Codex Meter", version },
    range,
    codexHome: snapshot.codexHome,
    sessionsDir: snapshot.sessionsDir,
    sourceDirs: snapshot.sourceDirs,
    scannedAt: snapshot.scannedAt,
    fileCount: snapshot.fileCount,
    discoveredFileCount: snapshot.discoveredFileCount,
    compressedFileCount: snapshot.compressedFileCount,
    scanWarnings: snapshot.scanWarnings || [],
    eventCount: selected.length,
    totals,
    today,
    cost,
    todayCost: estimateCost(dayEvents.get(todayKey) || []),
    daily,
    timeline,
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
    quotaPace: snapshot.latestLimits ? {
      primary: quotaPace(snapshot.latestLimits.primary, snapshot.latestLimits.timestamp, end),
      secondary: quotaPace(snapshot.latestLimits.secondary, snapshot.latestLimits.timestamp, end),
    } : null,
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
