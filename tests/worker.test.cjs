"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const globals = {URL,Response,Request,AbortController,TextDecoder,setTimeout,clearTimeout,fetch,console};
vm.createContext(globals);
const catalog = fs.readFileSync("functions/api/catalog.js","utf8").replace(/^export /gm,"");
vm.runInContext(catalog, globals);
const workerSource = fs.readFileSync("worker.js","utf8")
  .replace(/^import[^\n]+\n/gm,"")
  .replace("export default {","this.worker = {");
vm.runInContext(workerSource, globals);
const worker = globals.worker;
const env = { ASSETS: { fetch: async req=>new Response(
  "static asset "+new URL(req.url).pathname,
  {status:200,headers:{"Content-Type":"text/plain"}}
)}};

test("Worker GET /api/catalog reaches the real health endpoint", async()=>{
 const response = await worker.fetch(new Request("https://radar.example.com/api/catalog"),env,{});
 assert.equal(response.status,200);
 const data = await response.json();
 assert.equal(data.ok,true);
 assert.match(data.version,/^5\./);
});

test("Worker POST /api/catalog reaches real Cloudflare catalog handler", async()=>{
 const request = new Request("https://radar.example.com/api/catalog",{
  method:"POST",headers:{"Content-Type":"application/json","Origin":"https://radar.example.com"},
  body:JSON.stringify({action:"health"})
 });
 const response=await worker.fetch(request,env,{});
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.ok,true);
});

test("Worker rejects unknown API paths without returning public assets",async()=>{
 const response=await worker.fetch(new Request("https://radar.example.com/api/secrets"),env,{});
 assert.equal(response.status,404);
});

test("Worker rejects unsupported API methods",async()=>{
 const response=await worker.fetch(new Request("https://radar.example.com/api/catalog",{method:"PUT"}),env,{});
 assert.equal(response.status,405);
 assert.equal(response.headers.get("Allow"),"GET, HEAD, POST");
});

test("Worker has a fallback for the static asset binding",async()=>{
 const response=await worker.fetch(new Request("https://radar.example.com/app.js"),env,{});
 assert.equal(response.status,200);
 assert.equal(await response.text(),"static asset /app.js");
});
