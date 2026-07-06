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

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

runTest("page contains an accessible calculation progress bar", () => {
  assert.ok(indexHtml.includes('id="calculationProgress"'));
  assert.ok(indexHtml.includes('role="progressbar"'));
  assert.ok(indexHtml.includes('id="progressFill"'));
  assert.ok(indexHtml.includes('id="progressText"'));
});

runTest("app uses a solver worker for recommendation progress", () => {
  assert.ok(appJs.includes("new Worker"));
  assert.ok(appJs.includes("solver-worker.js"));
  assert.ok(appJs.includes("progress"));
});

runTest("progress bar has visible fill and busy states", () => {
  assert.ok(styles.includes(".progress-panel"));
  assert.ok(styles.includes(".progress-fill"));
  assert.ok(styles.includes(".is-computing"));
});

runTest("service worker precaches the solver worker", () => {
  assert.ok(serviceWorker.includes("./src/solver-worker.js"));
});
