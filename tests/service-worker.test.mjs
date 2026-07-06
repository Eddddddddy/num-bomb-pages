import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const serviceWorker = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

runTest("service worker precaches the help content module", () => {
  assert.ok(
    serviceWorker.includes("./src/help-content.js"),
    "help-content.js must be cached for PWA/offline mode"
  );
});

runTest("service worker activates new versions immediately", () => {
  assert.ok(serviceWorker.includes("self.skipWaiting()"));
  assert.ok(serviceWorker.includes("self.clients.claim()"));
});

runTest("service worker uses network first for pages and source files", () => {
  assert.ok(serviceWorker.includes("shouldUseNetworkFirst"));
  assert.ok(serviceWorker.includes("networkFirst(event.request)"));
  assert.ok(serviceWorker.includes("async function networkFirst(request)"));
  assert.ok(serviceWorker.includes("fetch(request)"));
});
