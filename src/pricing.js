"use strict";

// OpenAI standard, short-context reference prices per million tokens.
// These are API-equivalent estimates, never ChatGPT/Codex subscription bills.
// Verified 2026-10-03. Source: OpenAI pricing.
const PROVIDERS = {
  openai: { label: "GPT / Codex", currency: "USD", source: "https://developers.openai.com/api/docs/pricing" },
};

// [uncached input, cached input, output]
const RULES = [
  // OpenAI standard, short-context reference prices per 1M tokens.
  // A Codex/ChatGPT plan is not billed as an API invoice, so these values are
  // intentionally displayed as an API-equivalent estimate only.
  { provider: "openai", models: ["gpt-6-astra"], rates: [10, 1, 50] },
  { provider: "openai", models: ["gpt-6.1-sol"], rates: [2, .1, 10] },
  { provider: "openai", models: ["gpt-6-sol"], rates: [2, .2, 10] },
  { provider: "openai", models: ["gpt-6-luna"], rates: [.1, .01, .5] },
  { provider: "openai", models: ["gpt-5.6-sol"], rates: [4, .4, 20] },
  { provider: "openai", models: ["gpt-5.6-terra"], rates: [2, .2, 12] },
  { provider: "openai", models: ["gpt-5.6-luna"], rates: [.2, .02, 1.2] },
  { provider: "openai", models: ["gpt-5.5"], rates: [5, .5, 30] },
  { provider: "openai", models: ["gpt-5.4"], rates: [2.5, .25, 15] },
  // Codex auto review has no published route-specific rate. This clearly
  // labelled proxy uses GPT-5.3-Codex standard API reference pricing.
  { provider: "openai", models: ["codex-auto-review"], rates: [1.75, .175, 14], billing: "proxy", referenceModel: "gpt-5.3-codex" },
];

const EXCLUDED_EXTERNAL_MODEL = /(?:deepseek|mimo|glm|qwen)/i;

function normalizedModel(model) {
  const raw = String(model || "").trim().toLowerCase();
  const bare = raw.split("/").at(-1);
  return bare.replace(/-\d{4}-\d{2}-\d{2}$/, "");
}

function isExcludedExternalModel(model) {
  return EXCLUDED_EXTERNAL_MODEL.test(String(model || ""));
}

function resolvePrice(model) {
  const key = normalizedModel(model);
  const rule = RULES.find((candidate) => candidate.models.includes(key));
  return rule ? { ...rule, ...PROVIDERS[rule.provider], key } : null;
}

function emptyBucket(provider) {
  const meta = PROVIDERS[provider];
  return { provider, label: meta.label, currency: meta.currency, amount: 0, input: 0, cached: 0, output: 0, pricedTokens: 0, models: [] };
}

function applyCost(bucket, usage, rates) {
  const cached = Math.min(Number(usage.input) || 0, Number(usage.cached) || 0);
  const input = Math.max(0, (Number(usage.input) || 0) - cached) * rates[0] / 1e6;
  const cachedCost = cached * rates[1] / 1e6;
  const output = (Number(usage.output) || 0) * rates[2] / 1e6;
  bucket.input += input;
  bucket.cached += cachedCost;
  bucket.output += output;
  bucket.amount += input + cachedCost + output;
  bucket.pricedTokens += Number(usage.total) || 0;
}

function estimateCost(events) {
  const providers = Object.fromEntries(Object.keys(PROVIDERS).map((provider) => [provider, emptyBucket(provider)]));
  const modelBuckets = new Map();
  const unknown = new Set();
  let pricedTokens = 0;
  let unpricedTokens = 0;

  for (const { model, usage } of events) {
    if (isExcludedExternalModel(model)) continue;
    const price = resolvePrice(model);
    if (!price) {
      unpricedTokens += Number(usage.total) || 0;
      unknown.add(model);
      continue;
    }
    if (!modelBuckets.has(model)) modelBuckets.set(model, {
      ...emptyBucket(price.provider), model, billing: price.billing || "metered", referenceModel: price.referenceModel || null,
    });
    if (price.rates) {
      applyCost(providers[price.provider], usage, price.rates);
      applyCost(modelBuckets.get(model), usage, price.rates);
      pricedTokens += Number(usage.total) || 0;
    } else {
      modelBuckets.get(model).pricedTokens += Number(usage.total) || 0;
    }
  }

  for (const bucket of Object.values(providers)) {
    bucket.models = [...new Set([...modelBuckets.values()].filter((row) => row.provider === bucket.provider).map((row) => row.model))];
  }
  const openai = providers.openai;
  return {
    // Keep legacy fields GPT-only: the main USD estimate never mixes currencies.
    usd: openai.amount,
    inputUsd: openai.input,
    cachedUsd: openai.cached,
    outputUsd: openai.output,
    pricedTokens,
    unpricedTokens,
    unknownModels: [...unknown],
    currency: "USD",
    basis: "openai-standard-short-context",
    verifiedAt: "2026-10-03",
    source: PROVIDERS.openai.source,
    providers,
    models: [...modelBuckets.values()].sort((a, b) => b.pricedTokens - a.pricedTokens),
  };
}

module.exports = { estimateCost, isExcludedExternalModel, resolvePrice, normalizedModel, PROVIDERS };
