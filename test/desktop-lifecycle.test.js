"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { startServer } = require("../server");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve,ms));
test("desktop survives refresh and additional tabs, then closes after last tab", async () => {
  const server = startServer({port:0,noOpen:true,desktop:true,closeGraceMs:150,startupGraceMs:3000});
  await once(server,"listening");
  const connect = () => new Promise((resolve,reject) => {
    const req = http.get({host:"127.0.0.1",port:server.address().port,path:"/api/page-lifetime"},(res) => {
      res.on("data",()=>{});
      resolve(req);
    });
    req.on("error",reject);
  });
  try {
    const first = await connect();
    first.destroy();
    await delay(30);
    const refreshed = await connect();
    const second = await connect();
    refreshed.destroy();
    await delay(250);
    assert.equal(server.listening,true);
    const closed = once(server,"close");
    second.destroy();
    await closed;
    assert.equal(server.listening,false);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test("background scanner serves concurrent usage and static requests", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-worker-test-"));
  t.after(() => fs.rmSync(root, { recursive:true, force:true }));
  fs.mkdirSync(path.join(root, "sessions"));
  const records = [
    { type:"session_meta", payload:{ id:"worker-test" } },
    { type:"turn_context", payload:{ model:"gpt-6.1-terra" } },
    { type:"token_usage_record", timestamp:new Date().toISOString(), payload:{ usage:{ input_tokens:1000, cached_input_tokens:500, output_tokens:100, total_tokens:1100 } } },
  ];
  fs.writeFileSync(path.join(root, "sessions", "test.jsonl"), records.map(JSON.stringify).join("\n"));
  const server = startServer({ port:0, noOpen:true, codexHome:root, persistentCacheDir:path.join(root, "cache") });
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const [a,b,page] = await Promise.all([
      fetch(`${base}/api/usage?range=1`).then((res) => res.json()),
      fetch(`${base}/api/usage?range=all`).then((res) => res.json()),
      fetch(base).then((res) => res.text()),
    ]);
    assert.equal(a.totals.total, 1100);
    assert.equal(b.totals.total, 1100);
    assert.equal(a.timeline.buckets.length, 24);
    assert.equal(a.models[0].pricingStatus, "metered");
    assert.match(page, /Codex Meter/);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
