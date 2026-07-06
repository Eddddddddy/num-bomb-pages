import assert from "node:assert/strict";
import {
  ALL_CODES,
  DEFAULT_CONFIG,
  PRESETS,
  applyFeedback,
  computePrior,
  createInitialState,
  getTopCandidates,
  recommendGuess,
  recommendGuessWithProgress,
  scoreFeedback,
  updateConfigFromPreset
} from "../src/solver.js";

function approx(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runTest("scores only exact-position matches", () => {
  assert.equal(scoreFeedback("1234", "1234"), 4);
  assert.equal(scoreFeedback("1234", "1243"), 2);
  assert.equal(scoreFeedback("1234", "5678"), 0);
  assert.equal(scoreFeedback("0000", "0101"), 2);
});

runTest("generates every four-digit code including leading zeroes", () => {
  assert.equal(ALL_CODES.length, 10000);
  assert.equal(ALL_CODES[0], "0000");
  assert.equal(ALL_CODES[9999], "9999");
  assert.ok(ALL_CODES.includes("0123"));
});

runTest("filters candidates by positional feedback", () => {
  const state = createInitialState(DEFAULT_CONFIG);
  const next = applyFeedback(state, "1234", 4);
  assert.equal(next.candidates.length, 1);
  assert.equal(next.candidates[0], "1234");

  const none = applyFeedback(createInitialState(DEFAULT_CONFIG), "1234", 0);
  assert.ok(none.candidates.every((candidate) => scoreFeedback("1234", candidate) === 0));
});

runTest("human prior rewards varied zigzag codes over obvious repeated codes", () => {
  const varied = computePrior("6248", DEFAULT_CONFIG);
  const repeated = computePrior("6666", DEFAULT_CONFIG);
  assert.ok(varied > repeated);
});

runTest("prior strength zero returns uniform probabilities", () => {
  const uniformConfig = { ...DEFAULT_CONFIG, humanPriorStrength: 0 };
  approx(computePrior("6248", uniformConfig), 1);
  approx(computePrior("6666", uniformConfig), 1);
});

runTest("presets update the key tunable parameters", () => {
  const defensive = updateConfigFromPreset(DEFAULT_CONFIG, "defensive");
  assert.equal(defensive.mode, "minimax");
  assert.ok(defensive.repeatWeights.onePair > DEFAULT_CONFIG.repeatWeights.onePair);
  assert.ok(defensive.hitThreshold > DEFAULT_CONFIG.hitThreshold);

  const strong = updateConfigFromPreset(DEFAULT_CONFIG, "strong-human");
  assert.equal(strong.mode, "expected");
  assert.ok(strong.humanPriorStrength > DEFAULT_CONFIG.humanPriorStrength);
  assert.ok(strong.zigzagMultiplier > DEFAULT_CONFIG.zigzagMultiplier);

  assert.deepEqual(Object.keys(PRESETS), ["default", "defensive", "strong-human"]);
});

runTest("top candidates are sorted by posterior mass", () => {
  const state = applyFeedback(createInitialState(DEFAULT_CONFIG), "1234", 4);
  const top = getTopCandidates(state, 3);
  assert.deepEqual(top.map((item) => item.code), ["1234"]);
  approx(top[0].probability, 1);
});

runTest("recommendation switches to direct hit when confidence passes threshold", () => {
  const state = applyFeedback(createInitialState(DEFAULT_CONFIG), "1234", 4);
  const recommendation = recommendGuess(state, { sampleLimit: 200 });
  assert.equal(recommendation.guess, "1234");
  assert.equal(recommendation.reason, "hit-threshold");
});

runTest("recommendation returns a legal four-digit guess before any feedback", () => {
  const state = createInitialState(DEFAULT_CONFIG);
  const recommendation = recommendGuess(state, { sampleLimit: 120 });
  assert.match(recommendation.guess, /^\d{4}$/);
  assert.ok(recommendation.score >= 0);
});

runTest("default search uses enough probes to solve strong-human 7145 in under 10 rounds", () => {
  const target = "7145";
  const config = updateConfigFromPreset(DEFAULT_CONFIG, "strong-human");
  let state = createInitialState(config);

  for (let round = 1; round <= 9; round += 1) {
    const recommendation = recommendGuess(state);
    const feedback = scoreFeedback(recommendation.guess, target);
    if (feedback === 4) {
      assert.equal(recommendation.guess, target);
      return;
    }
    state = applyFeedback(state, recommendation.guess, feedback);
  }

  assert.fail("strong-human preset should solve 7145 within 9 rounds by default");
});

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

await runAsyncTest("progress recommendation reports chunked progress and matches sync result", async () => {
  const state = createInitialState(updateConfigFromPreset(DEFAULT_CONFIG, "strong-human"));
  const progressEvents = [];
  const asyncRecommendation = await recommendGuessWithProgress(state, {
    sampleLimit: 120,
    chunkSize: 25,
    onProgress: (progress) => progressEvents.push(progress)
  });
  const syncRecommendation = recommendGuess(state, { sampleLimit: 120 });

  assert.equal(asyncRecommendation.guess, syncRecommendation.guess);
  assert.ok(progressEvents.length >= 2, "expected multiple progress updates");
  assert.equal(progressEvents.at(-1).completed, progressEvents.at(-1).total);
  assert.equal(progressEvents.at(-1).percent, 1);
});
