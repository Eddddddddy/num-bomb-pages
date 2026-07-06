import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const workflowUrl = new URL("../.github/workflows/pages.yml", import.meta.url);

runTest("page footer exposes version and build time fields", () => {
  assert.ok(indexHtml.includes("buildMeta"));
  assert.ok(indexHtml.includes('id="buildVersion"'));
  assert.ok(indexHtml.includes('id="buildTime"'));
  assert.ok(indexHtml.includes("./build-info.js"));
});

runTest("app reads generated build info from window", () => {
  assert.ok(appJs.includes("window.NUM_BOMB_BUILD"));
  assert.ok(appJs.includes("renderBuildInfo"));
});

runTest("service worker caches generated build info", () => {
  assert.ok(serviceWorker.includes("./build-info.js"));
});

runTest("GitHub Pages workflow generates unique version and build time", () => {
  assert.ok(existsSync(workflowUrl), "missing pages workflow");
  const workflow = readFileSync(workflowUrl, "utf8");
  assert.ok(workflow.includes("GITHUB_RUN_NUMBER"));
  assert.ok(workflow.includes("GITHUB_SHA"));
  assert.ok(workflow.includes("date -u"));
  assert.ok(workflow.includes("build-info.js"));
  assert.ok(workflow.includes("actions/deploy-pages"));
});
