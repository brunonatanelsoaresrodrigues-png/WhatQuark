const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { buildSync } = require("esbuild");

const compiled = buildSync({
  entryPoints: [path.join(__dirname, "../src/services/api.js")],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  define: { "import.meta.env": "{}" },
  logLevel: "silent",
}).outputFiles[0].text;

let api, session;
beforeEach(() => {
  const storage = new Map();
  global.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  global.window = new EventTarget();
  window.location = { origin: "http://frontend.test" };
  window.ENV = { VITE_BACKEND_URL: "http://backend.test" };
  const loaded = new Module(__filename, module);
  loaded._compile(compiled, __filename);
  session = loaded.exports;
  api = session.default;
  localStorage.setItem("token", JSON.stringify("old-token"));
});

const denied = (config, status) =>
  Promise.reject({ config, response: { status } });

test("registers one interceptor pair and sends authenticated media requests", async () => {
  assert.equal(api.interceptors.request.handlers.length, 1);
  assert.equal(api.interceptors.response.handlers.length, 1);
  api.defaults.adapter = async (config) => {
    assert.equal(config.headers.Authorization, "Bearer old-token");
    assert.equal(config.responseType, "blob");
    return { data: "media", config };
  };
  await api.get("/public/test.pdf", { responseType: "blob" });
});

test("does not retry permission failures", async () => {
  let calls = 0;
  api.defaults.adapter = (config) => {
    calls += 1;
    return denied(config, 403);
  };
  await assert.rejects(api.get("/tickets/9"));
  assert.equal(calls, 1);
});

test("shares one token refresh across concurrent unauthorized requests", async () => {
  let refreshes = 0;
  let deliveries = 0;
  api.defaults.adapter = async (config) => {
    if (config.url === "/auth/refresh_token") {
      refreshes += 1;
      await new Promise((resolve) => setImmediate(resolve));
      return { config, data: { token: "new-token", user: { id: 1 } } };
    }
    if (!config._retry) return denied(config, 401);
    assert.equal(config.headers.Authorization, "Bearer new-token");
    deliveries += 1;
    return { config, data: [] };
  };
  await Promise.all([api.get("/tickets"), api.get("/messages/1")]);
  assert.equal(refreshes, 1);
  assert.equal(deliveries, 2);
});

test("does not restore a session cleared during an in-flight refresh", async () => {
  let finish;
  api.defaults.adapter = (config) =>
    new Promise((resolve) => {
      finish = () =>
        resolve({ config, data: { token: "stale", user: { id: 1 } } });
    });
  const refreshing = session.refreshSession();
  await new Promise((resolve) => setImmediate(resolve));
  session.clearSession();
  finish();
  await assert.rejects(refreshing);
  assert.equal(session.getAccessToken(), null);
});

test("refuses to send authorization to another origin", async () => {
  let called = false;
  api.defaults.adapter = async () => {
    called = true;
    return { data: null };
  };
  await assert.rejects(
    api.get("https://external.test/file"),
    /Unexpected API origin/
  );
  assert.equal(called, false);
});

test("does not recursively refresh failed credentials", async () => {
  let calls = 0;
  api.defaults.adapter = (config) => {
    calls += 1;
    return denied(config, 401);
  };
  await assert.rejects(session.refreshSession());
  assert.equal(calls, 1);
  assert.equal(session.getAccessToken(), null);
});
