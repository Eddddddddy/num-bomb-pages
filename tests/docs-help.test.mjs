import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HELP_ITEMS } from "../src/help-content.js";

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runTest("README explains the game rules in detail", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  for (const phrase of [
    "## 游戏规则",
    "答案由 4 个数字组成",
    "`0000` 到 `9999`",
    "允许重复数字",
    "只反馈位置正确的个数",
    "`6248`",
    "`0` 到 `4`"
  ]) {
    assert.ok(readme.includes(phrase), `README missing: ${phrase}`);
  }
});

runTest("help content covers every user-facing mode and parameter", () => {
  const requiredIds = [
    "preset",
    "humanPriorStrength",
    "repeatWeights.onePair",
    "consecutiveStraightWeight",
    "zigzagMultiplier",
    "hitThreshold",
    "mode",
    "leadingZeroWeight",
    "repeatWeights.twoPairs",
    "repeatWeights.threeSame",
    "repeatWeights.fourSame",
    "strictMonotonicWeight",
    "highLowAlternatingMultiplier",
    "nonCandidatePenalty",
    "allowProbeGuess",
    "maxFeedbackErrors"
  ];

  for (const id of requiredIds) {
    assert.ok(HELP_ITEMS[id], `missing help item ${id}`);
    assert.ok(HELP_ITEMS[id].title.length >= 2, `${id} title too short`);
    assert.ok(HELP_ITEMS[id].body.length >= 30, `${id} body too short`);
  }
});
