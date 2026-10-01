"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { CodexScanner, buildView } = require("./src/codex-scanner");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const HOST = "127.0.0.1";
const DEFAULT_PORT = 17321;
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildCsv(view) {
  const rows = [["日期", "总 Token", "输入", "缓存输入", "输出", "推理输出", "用量事件"]];
  for (const item of view.daily) {
    rows.push([
      item.date, item.usage.total, item.usage.input, item.usage.cached,
      item.usage.output, item.usage.reasoning, item.events,
    ]);
  }
  rows.push([], ["项目", "总 Token", "输入", "缓存输入", "输出"]);
  for (const item of view.projects) {
    rows.push([item.name, item.usage.total, item.usage.input, item.usage.cached, item.usage.output]);
  }
  if (view.cost) rows.push([], ["API 等值估算 USD", view.cost.pricedTokens || !view.cost.unpricedTokens ? view.cost.usd : "未计价"], ["未计价 Token", view.cost.unpricedTokens], ["计价依据", "标准短上下文参考单价；非订阅实付账单"]);
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

function buildMarkdown(view) {
  const lines = [
    "# follow your codex 用量报告",
    "",
    `- 统计范围：${view.range === "all" ? "全部" : `${view.range} 天`}`,
    `- 总 Token：${Math.round(view.totals.total).toLocaleString("zh-CN")}`,
    `- 今日 Token：${Math.round(view.today.total).toLocaleString("zh-CN")}`,
    `- 活跃天数：${view.insights.activeDays}`,
    `- 会话数量：${view.sessionCount}`,
    "",
    "## 每日明细",
    "",
    "| 日期 | 总 Token | 输入 | 缓存输入 | 输出 | 用量事件 |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const item of view.daily) {
    lines.push(`| ${item.date} | ${item.usage.total} | ${item.usage.input} | ${item.usage.cached} | ${item.usage.output} | ${item.events} |`);
  }
  lines.push("", "## 项目排行", "", "| 项目 | 总 Token |", "| --- | ---: |");
  for (const item of view.projects) lines.push(`| ${item.name.replaceAll("|", "\\|")} | ${item.usage.total} |`);
  lines.push("", "> 数据来自本机 Codex 会话元数据；不包含提示词、回复正文或工具输出。", "");
  if (view.cost) lines.push(`API 等值估算：${view.cost.pricedTokens || !view.cost.unpricedTokens ? "$" + view.cost.usd.toFixed(2) : "未计价"} USD；未计价 Token：${view.cost.unpricedTokens}。标准短上下文参考价，非订阅实付账单。`);
  return lines.join("\n");
}

function sendDownload(response, type, filename, content) {
  response.writeHead(200, {
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(content);
}

function parseArgs(argv) {
  const result = { port: DEFAULT_PORT, noOpen: false, codexHome: null, desktop: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--no-open") result.noOpen = true;
    else if (arg === "--desktop") result.desktop = true;
    else if (arg === "--port") result.port = Number(argv[index += 1]) || DEFAULT_PORT;
    else if (arg === "--codex-home") result.codexHome = argv[index += 1];
  }
  return result;
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": MIME_TYPES[".json"],
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(data));
}

function serveFile(response, requestedPath) {
  const relative = requestedPath === "/" ? "index.html" : requestedPath.replace(/^\/+/, "");
  const resolved = path.resolve(PUBLIC_DIR, relative);
  if (!resolved.startsWith(path.resolve(PUBLIC_DIR) + path.sep) && resolved !== path.join(PUBLIC_DIR, "index.html")) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  fs.readFile(resolved, (error, content) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(error.code === "ENOENT" ? "Not found" : "Unable to read file");
      return;
    }
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(resolved)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'",
    });
    response.end(content);
  });
}

function openBrowser(url) {
  const platform = process.platform;
  const command = platform === "win32" ? "cmd" : platform === "darwin" ? "open" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

function startServer(options = parseArgs(process.argv.slice(2))) {
  const scanner = new CodexScanner({ codexHome: options.codexHome });
  let latestSnapshot = null;
  let scanPromise = null;
  const pages = new Set();
  let exitTimer = null;
  const graceMs = options.closeGraceMs ?? 8000;
  function scheduleExit(delay) {
    clearTimeout(exitTimer);
    exitTimer = setTimeout(() => {
      if (pages.size) return;
      server.close();
      server.closeAllConnections?.();
    }, delay);
  }

  async function getSnapshot() {
    if (scanPromise) return scanPromise;
    scanPromise = Promise.resolve().then(() => scanner.scan()).then((snapshot) => {
      latestSnapshot = snapshot;
      return snapshot;
    }).finally(() => {
      scanPromise = null;
    });
    return scanPromise;
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${HOST}`);
    if (request.method === "GET" && url.pathname === "/api/page-lifetime") {
      if (!options.desktop) { response.writeHead(204); response.end(); return; }
      clearTimeout(exitTimer);
      pages.add(response);
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        "Connection": "keep-alive",
      });
      response.write("data: connected\n\n");
      // An open connection, rather than a browser timer, keeps background tabs alive.
      const heartbeat = setInterval(() => response.write(": keepalive\n\n"), 15000);
      response.on("close", () => {
        clearInterval(heartbeat);
        pages.delete(response);
        if (!pages.size) scheduleExit(graceMs);
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/usage") {
      try {
        const snapshot = await getSnapshot();
        sendJson(response, 200, buildView(snapshot, url.searchParams.get("range") || "30"));
      } catch (error) {
        sendJson(response, 500, { error: error.message, hasSnapshot: Boolean(latestSnapshot) });
      }
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/export") {
      try {
        const range = url.searchParams.get("range") || "30";
        const format = url.searchParams.get("format") || "csv";
        const view = buildView(await getSnapshot(), range);
        const stamp = new Date().toISOString().slice(0, 10);
        if (format === "json") {
          sendDownload(response, MIME_TYPES[".json"], `follow-your-codex-${stamp}.json`, JSON.stringify(view, null, 2));
        } else if (format === "md") {
          sendDownload(response, "text/markdown; charset=utf-8", `follow-your-codex-${stamp}.md`, buildMarkdown(view));
        } else {
          sendDownload(response, "text/csv; charset=utf-8", `follow-your-codex-${stamp}.csv`, buildCsv(view));
        }
      } catch (error) {
        sendJson(response, 500, { error: error.message });
      }
      return;
    }
    if (request.method !== "GET") {
      response.writeHead(405);
      response.end("Method not allowed");
      return;
    }
    serveFile(response, decodeURIComponent(url.pathname));
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      const nextOptions = { ...options, port: options.port + 1 };
      startServer(nextOptions);
      return;
    }
    throw error;
  });

  server.listen(options.port, HOST, () => {
    const url = `http://${HOST}:${options.port}`;
    console.log(`follow your codex is running at ${url}`);
    console.log(`Reading Codex metadata from ${scanner.sessionsDir}`);
    console.log("Press Ctrl+C to stop.");
    if (!options.noOpen) openBrowser(url);
    if (options.desktop) scheduleExit(options.startupGraceMs ?? 120000);
  });
  server.on("close", () => clearTimeout(exitTimer));

  return server;
}

if (require.main === module) startServer();

module.exports = { buildCsv, buildMarkdown, parseArgs, startServer };
