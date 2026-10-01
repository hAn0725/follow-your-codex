"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildCsv, buildMarkdown } = require("../server");
const { estimateCost } = require("../src/pricing");

test("pricing separates cached input, includes reasoning only once, and exposes unknown prices", () => {
  const usage = { input: 1000000, cached: 400000, output: 100000, reasoning: 50000, total: 1100000 };
  const cost = estimateCost([{ model: "gpt-5.5", usage }, { model: "unknown", usage }]);
  assert.ok(Math.abs(cost.usd - 6.2) < 1e-9);
  assert.equal(cost.unpricedTokens, 1100000);
  assert.deepEqual(cost.unknownModels, ["unknown"]);
});

test("pricing keeps GPT, DeepSeek, Qwen, and GLM in separate provider buckets", () => {
  const usage = { input: 1000000, cached: 500000, output: 1000000, reasoning: 0, total: 2000000 };
  const cost = estimateCost([
    { model: "gpt-5.5", usage },
    { model: "deepseek-cloud/deepseek-v4.1-flash", usage },
    { model: "qwen-cloud/qwen3.8-flash", usage },
    { model: "glm-cloud/glm-4.7", usage },
  ]);
  assert.equal(cost.providers.openai.currency, "USD");
  assert.equal(cost.providers.qwen.currency, "CNY");
  assert.ok(Math.abs(cost.providers.openai.amount - 32.75) < 1e-9);
  assert.ok(Math.abs(cost.providers.deepseek.amount - 1.353) < 1e-9);
  assert.ok(Math.abs(cost.providers.qwen.amount - 3.15) < 1e-9);
  assert.ok(Math.abs(cost.providers.glm.amount - 9.2) < 1e-9);
  assert.equal(cost.usd, cost.providers.openai.amount);
});

test("pricing recognizes all current GPT-6 Codex model ids", () => {
  const usage = { input: 1000000, cached: 500000, output: 1000000, reasoning: 0, total: 2000000 };
  const cost = estimateCost([
    { model: "gpt-6.1-sol", usage },
    { model: "gpt-6-sol", usage },
    { model: "gpt-6-luna", usage },
    { model: "gpt-6-astra", usage },
  ]);
  const models = Object.fromEntries(cost.models.map((model) => [model.model, model.amount]));
  assert.deepEqual(models, {
    "gpt-6.1-sol": 11.05,
    "gpt-6-sol": 11.1,
    "gpt-6-luna": 0.555,
    "gpt-6-astra": 55.5,
  });
  assert.equal(cost.unpricedTokens, 0);
});

test("codex auto review is identified as internal usage without inventing an API price", () => {
  const usage = { input: 1000, cached: 800, output: 100, reasoning: 0, total: 1100 };
  const cost = estimateCost([{ model: "codex-auto-review", usage }]);
  assert.equal(cost.unpricedTokens, 0);
  assert.equal(cost.models[0].billing, "internal");
  assert.equal(cost.models[0].pricedTokens, 1100);
  assert.equal(cost.models[0].currency, null);
});

const view = {
  range: "7",
  totals: { total: 120 },
  today: { total: 120 },
  insights: { activeDays: 1 },
  sessionCount: 1,
  daily: [{
    date: "2026-09-08",
    usage: { total: 120, input: 100, cached: 25, output: 20, reasoning: 5 },
    events: 1,
  }],
  projects: [{ name: "alpha, beta", usage: { total: 120, input: 100, cached: 25, output: 20 } }],
};

test("CSV export is UTF-8 BOM encoded and safely quotes project names", () => {
  const csv = buildCsv(view);
  assert.ok(csv.startsWith("\uFEFF日期,总 Token"));
  assert.match(csv, /"alpha, beta",120/);
});

test("Markdown export includes daily and project sections", () => {
  const markdown = buildMarkdown(view);
  assert.match(markdown, /# follow your codex 用量报告/);
  assert.match(markdown, /\| 2026-09-08 \| 120 \|/);
  assert.match(markdown, /\| alpha, beta \| 120 \|/);
});
