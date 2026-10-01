"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
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
