"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { aggregate, buildView, CodexScanner, parseSessionText, readUsage, usageDelta } = require("../src/codex-scanner");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");

function jsonl(records) {
  return records.map((record) => JSON.stringify(record)).join("\n");
}

test("compressed September history and archive copies retain original dates without double counting", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-zstd-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "sessions", "2026", "09"), { recursive: true });
  fs.mkdirSync(path.join(root, "archived_sessions"));
  const text = jsonl([
    { type: "session_meta", payload: { id: "september-session" } },
    { type: "turn_context", payload: { model: "gpt-6.1-sol" } },
    { type: "event_msg", timestamp: "2026-09-21T12:00:00Z", payload: {
      type: "token_count", info: { last_token_usage: { input_tokens: 1000, output_tokens: 100, total_tokens: 1100 } },
    } },
  ]);
  fs.writeFileSync(path.join(root, "sessions", "2026", "09", "rollout.jsonl.zst"), zlib.zstdCompressSync(text));
  fs.writeFileSync(path.join(root, "archived_sessions", "copy.jsonl"), text);
  const scanner = new CodexScanner({ codexHome: root });
  const view = buildView(scanner.scan(), "all", new Date("2026-10-15T12:00:00Z"));
  assert.equal(view.totals.total, 1100);
  assert.equal(view.daily.find((day) => day.date === "2026-09-21").usage.total, 1100);
  assert.equal(view.daily.find((day) => day.date === "2026-10-15").usage.total, 0);
  assert.equal(view.eventCount, 1);
  assert.equal(view.compressedFileCount, 1);
  assert.deepEqual(view.scanWarnings, []);
  assert.equal(buildView(scanner.scan(), "all").totals.total, 1100);
  fs.writeFileSync(path.join(root, "archived_sessions", "corrupt.jsonl.zst"), "corrupt");
  const partial = buildView(scanner.scan(), "all");
  assert.equal(partial.totals.total, 1100);
  assert.deepEqual(partial.scanWarnings, [{ code: "read-failed", count: 1 }]);
  assert.equal(partial.discoveredFileCount, 3);
});

test("persistent cache reuses metadata across starts and refreshes changed or removed logs", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-cache-test-"));
  t.after(() => fs.rmSync(root, { recursive:true, force:true }));
  const home = path.join(root, "home"), cacheDir = path.join(root, "cache");
  fs.mkdirSync(path.join(home, "sessions"), { recursive:true });
  const source = path.join(home, "sessions", "history.jsonl");
  const log = (total) => jsonl([
    { timestamp:"2026-10-26T10:00:00Z", type:"response_item", payload:{ content:"private-prompt-example" } },
    { type:"session_meta", payload:{ id:"cache-session" } },
    { type:"turn_context", payload:{ model:"gpt-6.1-terra" } },
    { type:"token_usage_record", timestamp:"2026-10-26T10:00:00Z", payload:{ usage:{ input_tokens:total, total_tokens:total } } },
  ]);
  fs.writeFileSync(source, log(100));
  const first = new CodexScanner({ codexHome:home, persistentCacheDir:cacheDir });
  assert.equal(first.scan().events[0].usage.total, 100);
  const cachePath = first.cacheFile;
  assert.equal(fs.readFileSync(cachePath, "utf8").includes("private-prompt-example"), false);
  const second = new CodexScanner({ codexHome:home, persistentCacheDir:cacheDir });
  const originalRead = fs.readFileSync;
  let reads = 0;
  fs.readFileSync = (...args) => { if (args[0] === source) reads++; return originalRead(...args); };
  try {
    assert.equal(second.scan().events[0].usage.total, 100);
    assert.equal(reads, 0);
    fs.writeFileSync(source, log(250));
    assert.equal(second.scan().events[0].usage.total, 250);
    assert.equal(reads, 1);
    // A restarted process rejects the older disk entry even before its next write.
    assert.equal(new CodexScanner({ codexHome:home, persistentCacheDir:cacheDir }).scan().events[0].usage.total, 250);
    fs.unlinkSync(source);
    assert.equal(second.scan().events.length, 0);
    fs.writeFileSync(source, log(300));
    fs.writeFileSync(cachePath, "invalid cache");
    assert.equal(new CodexScanner({ codexHome:home, persistentCacheDir:cacheDir }).scan().events[0].usage.total, 300);
    const malformed = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    malformed.files[0].parsed.events = [null];
    fs.writeFileSync(cachePath, JSON.stringify(malformed));
    assert.equal(new CodexScanner({ codexHome:home, persistentCacheDir:cacheDir }).scan().events[0].usage.total, 300);
  } finally { fs.readFileSync = originalRead; }
});

test("migrated usage records replace legacy mirrors with different cumulative baselines", () => {
  const usage = { input_tokens: 100, cached_input_tokens: 40, output_tokens: 20, total_tokens: 120 };
  const modern = { type: "token_usage_record", timestamp: "2026-10-14T12:00:00Z", payload: {
    turn_id: "new-turn", response_id: "response-1", usage,
    thread_token_usage: { input_tokens: 10000, output_tokens: 2000, total_tokens: 12000 },
  } };
  const parsed = parseSessionText(jsonl([
    null,
    { type: "turn_context", payload: { turn_id: "old-turn", model: "gpt-6.1-sol" } },
    { type: "event_msg", payload: { type: "token_count", info: { last_token_usage: usage } } },
    { type: "turn_context", payload: { turn_id: "new-turn", model: "gpt-6.1-sol" } },
    modern,
    { type: "event_msg", payload: { type: "token_count", info: { last_token_usage: usage, total_token_usage: usage } } },
    modern,
  ]));
  assert.equal(parsed.events.length, 2);
  assert.equal(parsed.total.total, 240);
  assert.equal(parsed.total.cached, 80);
});

test("desktop usage recorded early is attributed to its own turn after a model switch", () => {
  const usage = { input_tokens: 100, cached_input_tokens: 40, output_tokens: 20, total_tokens: 120 };
  const timestamp = "2026-11-24T12:00:00Z";
  const context = (turn_id, model) => ({ type: "turn_context", payload: { turn_id, model } });
  const record = (turn_id, response_id, model) => ({
    type: "token_usage_record", timestamp, payload: { turn_id, response_id, root_turn_id: turn_id, usage, model },
  });
  const early = record("sol-turn", "early");
  const parsed = parseSessionText(jsonl([
    { type: "session_meta", payload: { id: "work-thread", originator: "codex_work_desktop" } },
    context("old-turn", "gpt-6.1-terra"),
    record("old-turn", "old"),
    early,
    context("sol-turn", "gpt-6.2-sol"),
    { type: "event_msg", timestamp, payload: { type: "token_count", info: { last_token_usage: usage } } },
    early,
    context("astra-turn", "gpt-6.2-astra"),
    record("sol-turn", "late"),
    record("astra-turn", "astra"),
    record("missing-turn", "unattributed"),
    record("reported-turn", "reported", "gpt-6.2-astra"),
    context("reported-turn", "gpt-6.2-sol"),
  ]));
  assert.deepEqual(parsed.events.map((event) => event.model), [
    "gpt-6.1-terra", "gpt-6.2-sol", "gpt-6.2-sol", "gpt-6.2-astra", "Unknown model", "gpt-6.2-astra",
  ]);
  assert.equal(parsed.total.total, 720);
  assert.ok(parsed.events.every((event) => event.project === "Unknown project"));
});

test("scanner includes archives, deduplicates copies, and retains disjoint session segments", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-tracer-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "sessions"));
  fs.mkdirSync(path.join(root, "archived_sessions"));
  const makeLog = (responseId, total) => jsonl([
    { type: "session_meta", payload: { id: "same-session" } },
    { type: "turn_context", payload: { turn_id: "turn-1", model: "gpt-6.1-sol" } },
    { type: "token_usage_record", timestamp: "2026-10-14T12:00:00Z", payload: {
      response_id: responseId, usage: { input_tokens: total, total_tokens: total },
    } },
  ]);
  const active = path.join(root, "sessions", "active.jsonl");
  fs.writeFileSync(active, makeLog("response-a", 100));
  fs.writeFileSync(path.join(root, "archived_sessions", "copy.jsonl"), makeLog("response-a", 100));
  fs.writeFileSync(path.join(root, "archived_sessions", "segment.jsonl"), makeLog("response-b", 200));
  const scanner = new CodexScanner({ codexHome: root });
  const check = () => {
    const view = buildView(scanner.scan(), "all", new Date("2026-10-15T12:00:00Z"));
    assert.equal(view.totals.total, 300);
    assert.equal(view.eventCount, 2);
    assert.equal(view.sessionCount, 1);
    assert.equal(view.sourceDirs.length, 2);
  };
  check();
  check(); // Cached scans preserve the same accounting.
  fs.unlinkSync(active);
  check(); // Moving an active log to archive cannot lose history.
});

test("repeated cumulative snapshots do not inflate usage or estimated cost", () => {
  const record = { type: "event_msg", payload: { type: "token_count", info: {
    total_token_usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
    last_token_usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
  } } };
  const parsed = parseSessionText(jsonl([record, record]));
  assert.equal(parsed.total.total, 120);
  assert.equal(parsed.events.length, 1);
});

test("usageDelta clamps counter resets", () => {
  assert.deepEqual(
    usageDelta(
      { input: 5, cached: 2, output: 4, reasoning: 1, total: 9 },
      { input: 10, cached: 6, output: 3, reasoning: 2, total: 13 },
    ),
    { input: 0, cached: 0, output: 1, reasoning: 0, total: 0 },
  );
});

test("readUsage supports current nested cache and reasoning fields", () => {
  assert.deepEqual(
    readUsage({
      input_tokens: 100,
      input_tokens_details: { cached_tokens: 70 },
      output_tokens: 25,
      output_tokens_details: { reasoning_tokens: 9 },
    }),
    { input: 100, cached: 70, output: 25, reasoning: 9, total: 125 },
  );
});

test("parser uses per-turn usage first, then cumulative deltas", () => {
  const parsed = parseSessionText(jsonl([
    { type: "session_meta", payload: { id: "session-1", cwd: "C:\\work\\alpha" } },
    { type: "turn_context", payload: { model: "gpt-test" } },
    {
      type: "event_msg", timestamp: "2026-09-07T10:00:00Z",
      payload: { type: "token_count", info: {
        last_token_usage: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 20, reasoning_output_tokens: 5, total_tokens: 120 },
        total_token_usage: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 20, reasoning_output_tokens: 5, total_tokens: 120 },
        model_context_window: 1000,
      }, rate_limits: {
        primary: { used_percent: 12.5, window_minutes: 300, resets_at: 1788782400 },
        secondary: { used_percent: 25, window_minutes: 10080, resets_at: 1789387200 },
      } },
    },
    {
      type: "event_msg", timestamp: "2026-09-07T10:01:00Z",
      payload: { type: "token_count", info: {
        last_token_usage: { input_tokens: 60, cached_input_tokens: 10, output_tokens: 30, reasoning_output_tokens: 10, total_tokens: 90 },
        total_token_usage: { input_tokens: 160, cached_input_tokens: 50, output_tokens: 50, reasoning_output_tokens: 15, total_tokens: 210 },
        model_context_window: 1000,
      } },
    },
    { type: "event_msg", payload: { type: "agent_message", message: "must not be parsed" } },
    "{partial",
  ]), "rollout.jsonl");

  assert.equal(parsed.sessionId, "session-1");
  assert.equal(parsed.project, "alpha");
  assert.equal(parsed.model, "gpt-test");
  assert.equal(parsed.events.length, 2);
  assert.deepEqual(parsed.total, { input: 160, cached: 50, output: 50, reasoning: 15, total: 210 });
  assert.equal(parsed.latestLimits.primary.usedPercent, 12.5);
  assert.equal(parsed.latestContext.percent, 9);
});

test("buildView aggregates days, models, sessions, and today", () => {
  const parsed = parseSessionText(jsonl([
    { type: "session_meta", payload: { id: "s2", cwd: "C:\\work\\beta" } },
    { type: "turn_context", payload: { model: "gpt-demo" } },
    { type: "event_msg", timestamp: "2026-09-07T03:00:00Z", payload: { type: "token_count", info: { last_token_usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 } } } },
    { type: "event_msg", timestamp: "2026-09-08T03:00:00Z", payload: { type: "token_count", info: { last_token_usage: { input_tokens: 200, output_tokens: 40, total_tokens: 240 } } } },
  ]), "rollout.jsonl");
  const snapshot = aggregate([parsed], "C:\\Users\\demo\\.codex");
  const view = buildView(snapshot, "7", new Date("2026-09-08T12:00:00Z"));

  assert.equal(view.totals.total, 360);
  assert.equal(view.sessionCount, 1);
  assert.equal(view.models[0].name, "gpt-demo");
  assert.equal(view.projects[0].name, "beta");
  assert.equal(view.daily.length, 7);
  assert.equal(view.daily.reduce((sum, item) => sum + item.events, 0), 2);
  assert.equal(view.hourly.reduce((sum, item) => sum + item.total, 0), 360);
  assert.equal(view.heatmap.length, 168);
  assert.equal(view.insights.activeDays, 2);
  assert.equal(view.insights.peakDay.usage.total, 240);
  assert.equal(view.sessions[0].eventCount, 2);
});

test("one-day view uses the last 24 hours with exact boundaries and hourly totals", () => {
  const now = new Date("2026-10-26T20:17:42+08:00");
  const start = now.getTime() - 86_400_000;
  const events = [
    [start - 86_400_000, 10], [start - 1, 20], [start, 30],
    [start + 3_600_000 - 1, 40], [start + 3_600_000, 50],
    [now.getTime(), 60], [now.getTime() + 1, 70],
  ].map(([timestamp, total]) => ({ timestamp, model:"gpt-6.1-sol", project:"demo", sessionId:"s", usage:{input:total,cached:0,output:0,reasoning:0,total} }));
  events.push({ ...events[2], model:"deepseek-chat", usage:{input:1000,cached:0,output:0,reasoning:0,total:1000} });
  const view = buildView({events,sessions:[]}, "1", now);
  assert.equal(view.timeline.startAt, start);
  assert.equal(view.timeline.endAt, now.getTime());
  assert.equal(view.timeline.buckets.length, 24);
  assert.equal(view.timeline.buckets[0].usage.total, 70);
  assert.equal(view.timeline.buckets[1].usage.total, 50);
  assert.equal(view.timeline.buckets[23].usage.total, 60);
  assert.equal(view.timeline.buckets.reduce((sum, row) => sum + row.usage.total, 0), 180);
  assert.ok(Math.abs(view.timeline.buckets[0].estimatedUsd - 70 * 2 / 1e6) < 1e-12);
  assert.equal(view.timeline.buckets.reduce((sum, row) => sum + row.pricedTokens, 0), 180);
  assert.equal(view.totals.total, 180);
  assert.equal(view.daily.reduce((sum, row) => sum + row.usage.total, 0), 180);
  assert.equal(view.insights.averagePerDay, 180);
  assert.equal(view.insights.comparison.previousTotal, 30);
  assert.equal(view.insights.recentAverage, 210 / 7);
  assert.equal(view.eventCount, 4);
});

test("cost series reconcile by day and hour, including cache corrections and unpriced usage", () => {
  const now = new Date("2026-10-26T20:17:42Z");
  const usage = (input, cached, output) => ({ input, cached, output, reasoning: 0, total: input + output });
  const events = [
    { model: "gpt-6.2-sol", usage: usage(100_000, 150_000, 10_000) },
    { model: "gpt-6.2-sol", usage: usage(200_000, 0, 0) },
    { model: "gpt-preview-without-rate", usage: usage(200_000, 0, 0) },
    { model: "openrouter/stealth-union-alpha", usage: usage(500_000, 0, 0) },
  ].map((event) => ({ ...event, timestamp: +now - 2000 }));
  const view = buildView({ events, sessions: [] }, "1", now);
  const day = view.daily.find((row) => row.events);
  const hour = view.timeline.buckets.at(-1);
  assert.ok(Math.abs(day.estimatedUsd - 0.51) < 1e-12);
  assert.equal(day.estimatedUsd, view.cost.usd);
  assert.equal(hour.estimatedUsd, view.cost.usd);
  assert.equal(day.unpricedTokens, 200_000);
  assert.equal(hour.pricedTokens, 310_000);
  assert.equal(day.models.length, 2);
  assert.equal(day.models.find((row) => row.name === "gpt-preview-without-rate").estimatedUsd, null);
  assert.equal(day.models.find((row) => row.name === "gpt-6.2-sol").estimatedUsd, view.cost.usd);
});

test("quota pacing uses sample time and omits reset or incomplete windows", () => {
  const sampledAt = Date.parse("2026-10-26T17:15:00Z");
  const resetsAt = Date.parse("2026-10-26T21:00:00Z");
  const latestLimits = { timestamp: sampledAt, primary: { usedPercent: 46, resetsAt, windowMinutes: 300 },
    secondary: { usedPercent: 12, resetsAt, windowMinutes: null } };
  const snapshot = { events: [], sessions: [], latestLimits };
  const view = buildView(snapshot, "7", new Date("2026-10-26T18:00:00Z"));
  assert.deepEqual(view.quotaPace, { primary: { elapsedPercent: 25, delta: 21 }, secondary: null });
  assert.equal(buildView(snapshot, "7", new Date(resetsAt)).quotaPace.primary, null);
});

test("empty rolling day retains 24 zero buckets and longer ranges stay daily", () => {
  const snapshot = {events:[],sessions:[]};
  for (const timestamp of ["2026-10-26T00:00:00+08:00", "2026-11-01T02:30:00-05:00"]) {
    const view = buildView(snapshot, "1", new Date(timestamp));
    assert.equal(view.timeline.endAt - view.timeline.startAt, 86_400_000);
    assert.equal(view.timeline.buckets.length, 24);
    assert.equal(view.totals.total, 0);
    assert.ok(view.timeline.buckets.every((row) => row.events === 0));
  }
  const week = buildView(snapshot, "7", new Date("2026-10-26T20:17:42+08:00"));
  assert.equal(week.timeline, null);
  assert.equal(week.daily.length, 7);
});

test("buildView removes excluded external-provider events before all dashboard aggregates", () => {
  const gpt = parseSessionText(jsonl([
    { type: "session_meta", payload: { id: "gpt-session", cwd: "C:\\work\\gpt" } },
    { type: "turn_context", payload: { model: "gpt-6.1-sol" } },
    { type: "event_msg", timestamp: "2026-09-08T03:00:00Z", payload: { type: "token_count", info: { last_token_usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 } } } },
  ]), "gpt-rollout.jsonl");
  const external = parseSessionText(jsonl([
    { type: "session_meta", payload: { id: "external-session", cwd: "C:\\work\\external" } },
    { type: "turn_context", payload: { model: "deepseek/deepseek-flash" } },
    { type: "event_msg", timestamp: "2026-09-08T03:00:00Z", payload: { type: "token_count", info: { last_token_usage: { input_tokens: 900, output_tokens: 100, total_tokens: 1000 } } } },
  ]), "external-rollout.jsonl");
  const view = buildView(aggregate([gpt, external], "C:\\Users\\demo\\.codex"), "7", new Date("2026-09-08T12:00:00Z"));

  assert.equal(view.totals.total, 120);
  assert.deepEqual(view.models.map((model) => model.name), ["gpt-6.1-sol"]);
  assert.deepEqual(view.projects.map((project) => project.name), ["gpt"]);
  assert.deepEqual(view.sessions.map((session) => session.id), ["gpt-session"]);
  assert.equal(view.cost.usd > 0, true);
});

test("unidentified records and Stealth Union Alpha stay out of rolling usage and mixed-session totals", () => {
  const current = "2026-09-08T12:00:00Z";
  const previous = "2026-09-07T11:00:00Z";
  const usage = { input_tokens: 100, output_tokens: 20, total_tokens: 120 };
  const record = (timestamp, turn_id) => ({
    type: "token_usage_record", timestamp, payload: { turn_id, response_id: turn_id, usage },
  });
  const parsed = parseSessionText(jsonl([
    { type: "session_meta", payload: { id: "mixed", cwd: "C:\\work\\gpt" } },
    record(previous, "previous-missing"),
    { type: "turn_context", payload: { turn_id: "gpt", model: "gpt-6.2-sol" } },
    record(current, "gpt"),
    { type: "turn_context", payload: { turn_id: "excluded", model: "openrouter/stealth-union-alpha" } },
    record(current, "excluded"),
    record(current, "current-missing"),
  ]), "mixed-rollout.jsonl");
  const snapshot = aggregate([parsed], "C:\\Users\\demo\\.codex");
  const view = buildView(snapshot, "1", new Date("2026-09-08T15:00:00Z"));

  assert.equal(snapshot.events.length, 4);
  assert.equal(view.totals.total, 120);
  assert.equal(view.eventCount, 1);
  assert.equal(view.timeline.buckets.reduce((sum, bucket) => sum + bucket.usage.total, 0), 120);
  assert.equal(view.insights.comparison.previousTotal, 0);
  assert.equal(view.insights.recentAverage, 120 / 7);
  assert.deepEqual(view.models.map((model) => model.name), ["gpt-6.2-sol"]);
  assert.equal(view.sessions[0].model, "gpt-6.2-sol");
  assert.equal(view.cost.unpricedTokens, 0);
});
