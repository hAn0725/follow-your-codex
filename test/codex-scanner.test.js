"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { aggregate, buildView, parseSessionText, readUsage, usageDelta } = require("../src/codex-scanner");

function jsonl(records) {
  return records.map((record) => JSON.stringify(record)).join("\n");
}

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
