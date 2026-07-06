import {
  DEFAULT_CONFIG,
  PRESETS,
  applyFeedback,
  createInitialState,
  getTopCandidates,
  modeLabel,
  rebuildState,
  recommendGuess,
  rewindState,
  summarizeState,
  updateConfigFromPreset
} from "./solver.js";

const STORAGE_KEY = "num-bomb-pages-state-v1";

const commonControls = [
  {
    id: "humanPriorStrength",
    label: "人类先验强度",
    min: 0,
    max: 1,
    step: 0.01,
    format: (value) => `${Math.round(value * 100)}%`
  },
  {
    id: "repeatWeights.onePair",
    label: "一个对子权重",
    min: 0.01,
    max: 0.8,
    step: 0.01
  },
  {
    id: "consecutiveStraightWeight",
    label: "顺子惩罚",
    min: 0.01,
    max: 0.5,
    step: 0.01
  },
  {
    id: "zigzagMultiplier",
    label: "大小交叉奖励",
    min: 1,
    max: 2.2,
    step: 0.01
  },
  {
    id: "hitThreshold",
    label: "直接猜中阈值",
    min: 0.35,
    max: 0.95,
    step: 0.01,
    format: (value) => `${Math.round(value * 100)}%`
  }
];

const advancedControls = [
  {
    id: "leadingZeroWeight",
    label: "首位 0 权重",
    min: 0.1,
    max: 1.2,
    step: 0.01
  },
  {
    id: "repeatWeights.twoPairs",
    label: "两个对子权重",
    min: 0.005,
    max: 0.5,
    step: 0.005
  },
  {
    id: "repeatWeights.threeSame",
    label: "三个相同权重",
    min: 0.001,
    max: 0.2,
    step: 0.001
  },
  {
    id: "repeatWeights.fourSame",
    label: "四个相同权重",
    min: 0.001,
    max: 0.1,
    step: 0.001
  },
  {
    id: "strictMonotonicWeight",
    label: "单调数字惩罚",
    min: 0.05,
    max: 0.9,
    step: 0.01
  },
  {
    id: "highLowAlternatingMultiplier",
    label: "高低交叉奖励",
    min: 1,
    max: 1.9,
    step: 0.01
  },
  {
    id: "nonCandidatePenalty",
    label: "非候选探针惩罚",
    min: 0.85,
    max: 1,
    step: 0.005
  }
];

const elements = {
  guessDisplay: document.querySelector("#guessDisplay"),
  candidateCount: document.querySelector("#candidateCount"),
  confidenceText: document.querySelector("#confidenceText"),
  reasonText: document.querySelector("#reasonText"),
  strategyChip: document.querySelector("#strategyChip"),
  statusPill: document.querySelector("#statusPill"),
  feedbackButtons: document.querySelector("#feedbackButtons"),
  undoButton: document.querySelector("#undoButton"),
  resetButton: document.querySelector("#resetButton"),
  presetSelect: document.querySelector("#presetSelect"),
  modeControl: document.querySelector("#modeControl"),
  commonSliders: document.querySelector("#commonSliders"),
  advancedSliders: document.querySelector("#advancedSliders"),
  allowProbeGuess: document.querySelector("#allowProbeGuess"),
  maxFeedbackErrors: document.querySelector("#maxFeedbackErrors"),
  candidateTable: document.querySelector("#candidateTable"),
  historyList: document.querySelector("#historyList"),
  roundText: document.querySelector("#roundText")
};

let presetKey = "default";
let state = restoreState();
let currentRecommendation = recommendGuess(state);

renderSliderControls(elements.commonSliders, commonControls);
renderSliderControls(elements.advancedSliders, advancedControls);
bindEvents();
render();
registerServiceWorker();

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!saved) {
      return createInitialState(DEFAULT_CONFIG);
    }
    presetKey = saved.presetKey ?? "custom";
    let restored = createInitialState(saved.config ?? DEFAULT_CONFIG);
    for (const item of saved.history ?? []) {
      restored = applyFeedback(restored, item.guess, item.feedback);
    }
    return restored;
  } catch {
    return createInitialState(DEFAULT_CONFIG);
  }
}

function persistState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      presetKey,
      config: state.config,
      history: state.history
    })
  );
}

function renderSliderControls(container, controls) {
  container.innerHTML = controls
    .map(
      (control) => `
        <label class="slider-row" data-control="${control.id}">
          <span class="slider-label">${control.label}</span>
          <input
            type="range"
            min="${control.min}"
            max="${control.max}"
            step="${control.step}"
            data-slider="${control.id}"
          >
          <output data-output="${control.id}"></output>
        </label>
      `
    )
    .join("");
}

function bindEvents() {
  elements.feedbackButtons.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-feedback]");
    if (!button || currentRecommendation.guess === "----") {
      return;
    }
    state = applyFeedback(state, currentRecommendation.guess, button.dataset.feedback);
    presetKey = elements.presetSelect.value;
    persistState();
    render();
  });

  elements.undoButton.addEventListener("click", () => {
    if (state.history.length === 0) {
      return;
    }
    state = rewindState(state);
    persistState();
    render();
  });

  elements.resetButton.addEventListener("click", () => {
    state = createInitialState(state.config);
    persistState();
    render();
  });

  elements.presetSelect.addEventListener("change", () => {
    presetKey = elements.presetSelect.value;
    if (presetKey !== "custom") {
      state = reconfigure(updateConfigFromPreset(state.config, presetKey));
    } else {
      state = reconfigure(state.config);
    }
    persistState();
    render();
  });

  document.addEventListener("input", (event) => {
    const slider = event.target.closest("input[data-slider]");
    if (!slider) {
      return;
    }
    setConfigValue(slider.dataset.slider, Number(slider.value));
    presetKey = "custom";
    persistState();
    render();
  });

  elements.modeControl.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button) {
      return;
    }
    state = reconfigure({
      ...state.config,
      mode: button.dataset.mode
    });
    presetKey = "custom";
    persistState();
    render();
  });

  elements.allowProbeGuess.addEventListener("change", () => {
    state = reconfigure({
      ...state.config,
      allowProbeGuess: elements.allowProbeGuess.checked
    });
    presetKey = "custom";
    persistState();
    render();
  });

  elements.maxFeedbackErrors.addEventListener("change", () => {
    state = reconfigure({
      ...state.config,
      maxFeedbackErrors: Number(elements.maxFeedbackErrors.value)
    });
    presetKey = "custom";
    persistState();
    render();
  });
}

function setConfigValue(path, value) {
  const nextConfig = {
    ...state.config,
    repeatWeights: { ...state.config.repeatWeights }
  };
  const [root, leaf] = path.split(".");
  if (leaf) {
    nextConfig[root][leaf] = value;
  } else {
    nextConfig[root] = value;
  }
  state = reconfigure(nextConfig);
}

function reconfigure(nextConfig) {
  return rebuildState(nextConfig, state.history);
}

function render() {
  currentRecommendation = recommendGuess(state);
  const summary = summarizeState(state);
  const confidence = currentRecommendation.reason === "hit-threshold"
    ? currentRecommendation.score
    : summary.top[0]?.probability ?? 0;

  elements.guessDisplay.textContent = currentRecommendation.guess;
  elements.candidateCount.textContent = formatInteger(summary.candidateCount);
  elements.confidenceText.textContent = formatPercent(confidence);
  elements.strategyChip.textContent = modeLabel(state.config.mode);
  elements.reasonText.textContent = reasonText(currentRecommendation);
  elements.statusPill.classList.toggle("is-empty", summary.candidateCount === 0);
  elements.presetSelect.value = presetKey;
  elements.undoButton.disabled = state.history.length === 0;

  renderControls();
  renderCandidates(getTopCandidates(state, 10));
  renderHistory();
}

function renderControls() {
  for (const control of [...commonControls, ...advancedControls]) {
    const value = getConfigValue(control.id);
    const slider = document.querySelector(`[data-slider="${control.id}"]`);
    const output = document.querySelector(`[data-output="${control.id}"]`);
    slider.value = value;
    output.textContent = control.format ? control.format(value) : Number(value).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  }

  for (const button of elements.modeControl.querySelectorAll("button")) {
    button.classList.toggle("is-active", button.dataset.mode === state.config.mode);
  }

  elements.allowProbeGuess.checked = state.config.allowProbeGuess;
  elements.maxFeedbackErrors.value = String(state.config.maxFeedbackErrors ?? 0);
}

function getConfigValue(path) {
  const [root, leaf] = path.split(".");
  if (leaf) {
    return state.config[root][leaf];
  }
  return state.config[root];
}

function renderCandidates(topCandidates) {
  let cumulative = 0;
  elements.candidateTable.innerHTML = topCandidates
    .map((item, index) => {
      cumulative += item.probability;
      return `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${item.code}</strong></td>
          <td>${formatPercent(item.probability)}</td>
          <td>${formatPercent(cumulative)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderHistory() {
  elements.roundText.textContent = `${state.history.length} 轮`;
  if (state.history.length === 0) {
    elements.historyList.innerHTML = `<div class="empty-row">还没有输入反馈。</div>`;
    return;
  }

  elements.historyList.innerHTML = state.history
    .map(
      (item, index) => `
        <div class="history-row">
          <span>${index + 1}</span>
          <strong>${item.guess}</strong>
          <span>${item.feedback} 个位置正确</span>
        </div>
      `
    )
    .join("");
}

function reasonText(recommendation) {
  if (recommendation.reason === "hit-threshold") {
    return "最高概率已经超过阈值，建议直接猜它。";
  }
  if (recommendation.reason === "no-candidates") {
    return "没有候选答案，历史反馈可能有误。";
  }
  if (!recommendation.candidate) {
    return "这是信息探针，不一定仍可能是答案。";
  }
  return `按${modeLabel(state.config.mode)}策略选择。`;
}

function formatInteger(value) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}

window.__numBomb = {
  getState: () => state,
  getRecommendation: () => currentRecommendation,
  reset: () => {
    state = createInitialState(state.config);
    persistState();
    render();
  },
  presets: PRESETS
};
