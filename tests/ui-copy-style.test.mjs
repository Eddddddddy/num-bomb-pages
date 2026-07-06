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
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

runTest("settings summary does not show explicit help instruction copy", () => {
  assert.ok(!indexHtml.includes("点 ? 看说明"));
  assert.ok(!indexHtml.includes("点？看说明"));
});

runTest("help buttons use a subtle treatment instead of a filled accent button", () => {
  const match = styles.match(/\.help-button\s*\{(?<body>[^}]+)\}/);
  assert.ok(match, "missing .help-button CSS block");
  const body = match.groups.body;

  assert.ok(!body.includes("background: var(--accent)"));
  assert.ok(!body.includes("color: #ffffff"));
  assert.ok(body.includes("color: var(--muted)"));
});
