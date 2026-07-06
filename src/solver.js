const DIGITS = "0123456789";

export const ALL_CODES = Array.from({ length: 10000 }, (_, index) =>
  String(index).padStart(4, "0")
);

export const DEFAULT_CONFIG = {
  leadingZeroWeight: 1,
  repeatWeights: {
    allUnique: 1,
    onePair: 0.25,
    twoPairs: 0.08,
    threeSame: 0.03,
    fourSame: 0.005
  },
  consecutiveStraightWeight: 0.08,
  strictMonotonicWeight: 0.25,
  zigzagMultiplier: 1.45,
  highLowAlternatingMultiplier: 1.25,
  humanPriorStrength: 0.75,
  mode: "entropy",
  hitThreshold: 0.6,
  allowProbeGuess: true,
  nonCandidatePenalty: 0.985,
  preferCandidateOnTie: true,
  maxFeedbackErrors: 0
};

export const PRESETS = {
  default: {
    label: "普通人默认局",
    patch: {
      leadingZeroWeight: 1,
      repeatWeights: {
        allUnique: 1,
        onePair: 0.25,
        twoPairs: 0.08,
        threeSame: 0.03,
        fourSame: 0.005
      },
      consecutiveStraightWeight: 0.08,
      strictMonotonicWeight: 0.25,
      zigzagMultiplier: 1.45,
      highLowAlternatingMultiplier: 1.25,
      humanPriorStrength: 0.75,
      mode: "entropy",
      hitThreshold: 0.6
    }
  },
  defensive: {
    label: "防反套路局",
    patch: {
      leadingZeroWeight: 1,
      repeatWeights: {
        allUnique: 1,
        onePair: 0.5,
        twoPairs: 0.25,
        threeSame: 0.12,
        fourSame: 0.05
      },
      consecutiveStraightWeight: 0.3,
      strictMonotonicWeight: 0.6,
      zigzagMultiplier: 1.15,
      highLowAlternatingMultiplier: 1.1,
      humanPriorStrength: 0.35,
      mode: "minimax",
      hitThreshold: 0.8
    }
  },
  "strong-human": {
    label: "强赌人性局",
    patch: {
      leadingZeroWeight: 1,
      repeatWeights: {
        allUnique: 1,
        onePair: 0.12,
        twoPairs: 0.03,
        threeSame: 0.01,
        fourSame: 0.001
      },
      consecutiveStraightWeight: 0.03,
      strictMonotonicWeight: 0.12,
      zigzagMultiplier: 1.8,
      highLowAlternatingMultiplier: 1.5,
      humanPriorStrength: 0.9,
      mode: "expected",
      hitThreshold: 0.45
    }
  }
};

export function cloneConfig(config = DEFAULT_CONFIG) {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    repeatWeights: {
      ...DEFAULT_CONFIG.repeatWeights,
      ...(config.repeatWeights ?? {})
    }
  };
}

export function updateConfigFromPreset(config, presetKey) {
  const preset = PRESETS[presetKey] ?? PRESETS.default;
  return cloneConfig({
    ...config,
    ...preset.patch,
    repeatWeights: {
      ...config.repeatWeights,
      ...(preset.patch.repeatWeights ?? {})
    }
  });
}

export function createInitialState(config = DEFAULT_CONFIG) {
  return {
    config: cloneConfig(config),
    history: [],
    candidates: ALL_CODES
  };
}

export function scoreFeedback(guess, answer) {
  let score = 0;
  for (let index = 0; index < 4; index += 1) {
    if (guess[index] === answer[index]) {
      score += 1;
    }
  }
  return score;
}

export function applyFeedback(state, guess, feedback) {
  const normalizedGuess = String(guess).padStart(4, "0").slice(-4);
  const normalizedFeedback = Number(feedback);
  const history = [
    ...state.history,
    { guess: normalizedGuess, feedback: normalizedFeedback }
  ];
  const config = cloneConfig(state.config);
  const maxErrors = clampNumber(config.maxFeedbackErrors ?? 0, 0, 1);

  const candidates = ALL_CODES.filter((candidate) => {
    let errors = 0;
    for (const item of history) {
      if (scoreFeedback(item.guess, candidate) !== item.feedback) {
        errors += 1;
        if (errors > maxErrors) {
          return false;
        }
      }
    }
    return true;
  });

  return {
    config,
    history,
    candidates
  };
}

export function rewindState(state) {
  const config = cloneConfig(state.config);
  const previousHistory = state.history.slice(0, -1);
  return rebuildState(config, previousHistory);
}

export function rebuildState(config, history = []) {
  let state = createInitialState(config);
  for (const item of history) {
    state = applyFeedback(state, item.guess, item.feedback);
  }
  return state;
}

export function computePrior(code, config = DEFAULT_CONFIG) {
  const normalized = String(code).padStart(4, "0").slice(-4);
  const safeConfig = cloneConfig(config);
  const humanWeight = computeHumanWeight(normalized, safeConfig);
  const alpha = clampNumber(safeConfig.humanPriorStrength, 0, 1);
  return (1 - alpha) + alpha * humanWeight;
}

export function getTopCandidates(state, limit = 8) {
  const config = cloneConfig(state.config);
  const weighted = state.candidates.map((code) => ({
    code,
    weight: computePrior(code, config)
  }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0) || 1;

  return weighted
    .sort((a, b) => b.weight - a.weight || a.code.localeCompare(b.code))
    .slice(0, limit)
    .map((item) => ({
      code: item.code,
      weight: item.weight,
      probability: item.weight / total
    }));
}

export function summarizeState(state) {
  const top = getTopCandidates(state, 10);
  const totalMass = state.candidates.reduce(
    (sum, code) => sum + computePrior(code, state.config),
    0
  );
  return {
    candidateCount: state.candidates.length,
    historyCount: state.history.length,
    totalMass,
    top
  };
}

export function recommendGuess(state, options = {}) {
  if (state.candidates.length === 0) {
    return {
      guess: "----",
      score: 0,
      reason: "no-candidates",
      candidate: false
    };
  }

  const config = cloneConfig(state.config);
  const top = getTopCandidates(state, 1)[0];
  if (top && top.probability >= config.hitThreshold) {
    return {
      guess: top.code,
      score: top.probability,
      reason: "hit-threshold",
      candidate: true
    };
  }

  const context = createSearchContext(state, config);
  const pool = buildGuessPool(state, options);
  let best = null;

  for (const guess of pool) {
    const challenger = evaluateGuess(guess, context, config);
    if (isBetterGuess(challenger, best, config)) {
      best = challenger;
    }
  }

  return best ?? {
    guess: top?.code ?? state.candidates[0],
    score: top?.probability ?? 0,
    reason: "fallback",
    candidate: true
  };
}

export async function recommendGuessWithProgress(state, options = {}) {
  const onProgress = typeof options.onProgress === "function"
    ? options.onProgress
    : () => {};

  if (state.candidates.length === 0) {
    onProgress({ completed: 1, total: 1, percent: 1 });
    return {
      guess: "----",
      score: 0,
      reason: "no-candidates",
      candidate: false
    };
  }

  const config = cloneConfig(state.config);
  const top = getTopCandidates(state, 1)[0];
  if (top && top.probability >= config.hitThreshold) {
    onProgress({ completed: 1, total: 1, percent: 1 });
    return {
      guess: top.code,
      score: top.probability,
      reason: "hit-threshold",
      candidate: true
    };
  }

  const context = createSearchContext(state, config);
  const pool = buildGuessPool(state, options);
  const total = pool.length || 1;
  const chunkSize = Math.max(1, options.chunkSize ?? 160);
  let best = null;

  for (let start = 0; start < pool.length; start += chunkSize) {
    const end = Math.min(pool.length, start + chunkSize);
    for (let index = start; index < end; index += 1) {
      const challenger = evaluateGuess(pool[index], context, config);
      if (isBetterGuess(challenger, best, config)) {
        best = challenger;
      }
    }

    const completed = end;
    onProgress({
      completed,
      total,
      percent: completed / total
    });
    await yieldToEventLoop();
  }

  return best ?? {
    guess: top?.code ?? state.candidates[0],
    score: top?.probability ?? 0,
    reason: "fallback",
    candidate: true
  };
}

function createSearchContext(state, config) {
  const candidateSet = new Set(state.candidates);
  const candidateWeights = state.candidates.map((code) => ({
    code,
    weight: computePrior(code, config)
  }));
  const totalMass =
    candidateWeights.reduce((sum, item) => sum + item.weight, 0) || 1;

  return {
    candidateSet,
    candidateWeights,
    totalMass
  };
}

function evaluateGuess(guess, context, config) {
  const bins = [0, 0, 0, 0, 0];
  for (const item of context.candidateWeights) {
    bins[scoreFeedback(guess, item.code)] += item.weight;
  }

  const rawScore = scoreBins(bins, context.totalMass, config.mode);
  const isCandidate = context.candidateSet.has(guess);
  const penalty = isCandidate ? 1 : config.nonCandidatePenalty;
  const score = rawScore * penalty;
  return {
    guess,
    score,
    rawScore,
    reason: config.mode,
    candidate: isCandidate,
    bins: bins.map((mass) => mass / context.totalMass)
  };
}

function yieldToEventLoop() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function computeHumanWeight(code, config) {
  const digits = Array.from(code, Number);
  let weight = 1;

  if (code[0] === "0") {
    weight *= config.leadingZeroWeight;
  }

  weight *= repeatWeight(code, config.repeatWeights);

  if (isConsecutiveStraight(digits)) {
    weight *= config.consecutiveStraightWeight;
  } else if (isStrictMonotonic(digits)) {
    weight *= config.strictMonotonicWeight;
  }

  if (isZigzag(digits)) {
    weight *= config.zigzagMultiplier;
  }

  if (isHighLowAlternating(digits)) {
    weight *= config.highLowAlternatingMultiplier;
  }

  return Math.max(weight, 0.000001);
}

function repeatWeight(code, repeatWeights) {
  const counts = new Map();
  for (const digit of code) {
    counts.set(digit, (counts.get(digit) ?? 0) + 1);
  }
  const profile = Array.from(counts.values()).sort((a, b) => b - a).join("");

  switch (profile) {
    case "1111":
      return repeatWeights.allUnique;
    case "211":
      return repeatWeights.onePair;
    case "22":
      return repeatWeights.twoPairs;
    case "31":
      return repeatWeights.threeSame;
    case "4":
      return repeatWeights.fourSame;
    default:
      return repeatWeights.allUnique;
  }
}

function isConsecutiveStraight(digits) {
  const delta = digits[1] - digits[0];
  if (delta !== 1 && delta !== -1) {
    return false;
  }
  for (let index = 2; index < digits.length; index += 1) {
    if (digits[index] - digits[index - 1] !== delta) {
      return false;
    }
  }
  return true;
}

function isStrictMonotonic(digits) {
  let increasing = true;
  let decreasing = true;
  for (let index = 1; index < digits.length; index += 1) {
    increasing = increasing && digits[index] > digits[index - 1];
    decreasing = decreasing && digits[index] < digits[index - 1];
  }
  return increasing || decreasing;
}

function isZigzag(digits) {
  return (
    (digits[0] < digits[1] &&
      digits[1] > digits[2] &&
      digits[2] < digits[3]) ||
    (digits[0] > digits[1] &&
      digits[1] < digits[2] &&
      digits[2] > digits[3])
  );
}

function isHighLowAlternating(digits) {
  const groups = digits.map((digit) => (digit >= 5 ? "H" : "L"));
  return (
    (groups[0] === "H" &&
      groups[1] === "L" &&
      groups[2] === "H" &&
      groups[3] === "L") ||
    (groups[0] === "L" &&
      groups[1] === "H" &&
      groups[2] === "L" &&
      groups[3] === "H")
  );
}

function buildGuessPool(state, options) {
  const config = cloneConfig(state.config);
  const sampleLimit = options.sampleLimit ?? ALL_CODES.length;
  const pool = new Set();

  for (const item of getTopCandidates(state, Math.min(80, state.candidates.length))) {
    pool.add(item.code);
  }

  for (const code of state.candidates.slice(0, Math.min(120, state.candidates.length))) {
    pool.add(code);
  }

  if (config.allowProbeGuess) {
    for (const code of representativeCodes(sampleLimit)) {
      pool.add(code);
    }
  }

  if (!config.allowProbeGuess && pool.size > sampleLimit) {
    return Array.from(pool).slice(0, sampleLimit);
  }

  return Array.from(pool);
}

function representativeCodes(limit) {
  if (limit >= ALL_CODES.length) {
    return ALL_CODES;
  }

  const anchors = [
    "0123",
    "0246",
    "0369",
    "0482",
    "1234",
    "1357",
    "1593",
    "2468",
    "2619",
    "3728",
    "4567",
    "4826",
    "5678",
    "6248",
    "7083",
    "7283",
    "8642",
    "8765",
    "9052",
    "9876",
    "0000",
    "1111",
    "2222",
    "9999",
    "0011",
    "0101",
    "1122",
    "9090"
  ];
  const result = new Set(anchors);
  const step = Math.max(1, Math.floor(ALL_CODES.length / Math.max(1, limit)));

  for (let index = 0; index < ALL_CODES.length && result.size < limit; index += step) {
    result.add(ALL_CODES[index]);
  }

  return Array.from(result);
}

function scoreBins(bins, totalMass, mode) {
  if (mode === "expected") {
    const expectedRemaining = bins.reduce(
      (sum, mass) => sum + (mass / totalMass) ** 2,
      0
    );
    return 1 - expectedRemaining;
  }

  if (mode === "minimax") {
    const worst = Math.max(...bins) / totalMass;
    return 1 - worst;
  }

  return bins.reduce((entropy, mass) => {
    if (mass <= 0) {
      return entropy;
    }
    const probability = mass / totalMass;
    return entropy - probability * Math.log2(probability);
  }, 0);
}

function isBetterGuess(challenger, current, config) {
  if (!current) {
    return true;
  }

  const delta = challenger.score - current.score;
  if (Math.abs(delta) > 1e-12) {
    return delta > 0;
  }

  if (config.preferCandidateOnTie && challenger.candidate !== current.candidate) {
    return challenger.candidate;
  }

  return challenger.guess.localeCompare(current.guess) < 0;
}

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return min;
  }
  return Math.min(max, Math.max(min, numeric));
}

export function isValidGuess(value) {
  return typeof value === "string" && /^\d{4}$/.test(value);
}

export function normalizeGuess(value) {
  const digitsOnly = String(value).replace(/\D/g, "").slice(0, 4);
  return digitsOnly.padStart(4, "0");
}

export function modeLabel(mode) {
  switch (mode) {
    case "expected":
      return "主动押高概率";
    case "minimax":
      return "防最坏情况";
    default:
      return "信息熵最大";
  }
}

export { DIGITS };
