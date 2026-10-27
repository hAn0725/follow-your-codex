"use strict";

const { parentPort, workerData } = require("node:worker_threads");
const { CodexScanner } = require("./codex-scanner");

const scanner = new CodexScanner(workerData);
parentPort.on("message", () => {
  try {
    parentPort.postMessage({ snapshot: scanner.scan() });
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  }
});
