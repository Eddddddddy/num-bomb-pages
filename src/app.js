import {
  DEFAULT_CONFIG,
  PRESETS,
  applyFeedback,
  createInitialState,
  getTopCandidates,
  modeLabel,
  rebuildState,
  recommendGuessWithProgress,
  rewindState,
  summarizeState,
  updateConfigFromPreset
} from "./solver.js";
import { getHelpItem } from "./help-content.js";

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
  statusText: document.querySelector("#statusText"),
  calculationProgress: document.querySelector("#calculationProgress"),
  progressFill: document.querySelector("#progressFill"),
  progressText: document.querySelector("#progressText"),
  progressCount: document.querySelector("#progressCount"),
  buildVersion: document.querySelector("#buildVersion"),
  buildTime: document.querySelector("#buildTime"),
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
  roundText: document.querySelector("#roundText"),
  helpDialog: document.querySelector("#helpDialog"),
  helpTitle: document.querySelector("#helpTitle"),
  helpBody: document.querySelector("#helpBody"),
  helpCloseButton: document.querySelector("#helpCloseButton")
};

let presetKey = "default";
let state = restoreState();
let currentRecommendation = createPlaceholderRecommendation("computing");
let solverWorker = null;
let recommendationJobId = 0;
let isComputing = false;
let calculationProgress = { completed: 0, total: 1, percent: 0 };

renderSliderControls(elements.commonSliders, commonControls);
renderSliderControls(elements.advancedSliders, advancedControls);
bindEvents();
renderBuildInfo();
render();
requestRecommendation();
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
      (control) => {
        const inputId = `slider-${control.id.replace(/[^a-z0-9]+/gi, "-")}`;
        return `
        <div class="slider-row" data-control="${control.id}">
          <span class="label-line slider-label">
            <label for="${inputId}">${control.label}</label>
            <button class="help-button" type="button" data-help-id="${control.id}" aria-label="查看${control.label}说明">?</button>
          </span>
          <input
            id="${inputId}"
            type="range"
            min="${control.min}"
            max="${control.max}"
            step="${control.step}"
            data-slider="${control.id}"
          >
          <output data-output="${control.id}"></output>
        </div>
      `;
      }
    )
    .join("");
}

function bindEvents() {
  elements.feedbackButtons.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-feedback]");
    if (!button || isComputing || currentRecommendation.guess === "----") {
      return;
    }
    state = applyFeedback(state, currentRecommendation.guess, button.dataset.feedback);
    presetKey = elements.presetSelect.value;
    persistState();
    requestRecommendation();
  });

  elements.undoButton.addEventListener("click", () => {
    if (state.history.length === 0) {
      return;
    }
    state = rewindState(state);
    persistState();
    requestRecommendation();
  });

  elements.resetButton.addEventListener("click", () => {
    state = createInitialState(state.config);
    persistState();
    requestRecommendation();
  });

  elements.presetSelect.addEventListener("change", () => {
    presetKey = elements.presetSelect.value;
    if (presetKey !== "custom") {
      state = reconfigure(updateConfigFromPreset(state.config, presetKey));
    } else {
      state = reconfigure(state.config);
    }
    persistState();
    requestRecommendation();
  });

  document.addEventListener("input", (event) => {
    const slider = event.target.closest("input[data-slider]");
    if (!slider) {
      return;
    }
    setConfigValue(slider.dataset.slider, Number(slider.value));
    presetKey = "custom";
    persistState();
    requestRecommendation();
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
    requestRecommendation();
  });

  elements.allowProbeGuess.addEventListener("change", () => {
    state = reconfigure({
      ...state.config,
      allowProbeGuess: elements.allowProbeGuess.checked
    });
    presetKey = "custom";
    persistState();
    requestRecommendation();
  });

  elements.maxFeedbackErrors.addEventListener("change", () => {
    state = reconfigure({
      ...state.config,
      maxFeedbackErrors: Number(elements.maxFeedbackErrors.value)
    });
    presetKey = "custom";
    persistState();
    requestRecommendation();
  });

  document.addEventListener("click", (event) => {
    const helpButton = event.target.closest("button[data-help-id]");
    if (!helpButton) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    openHelp(helpButton.dataset.helpId);
  });

  elements.helpCloseButton.addEventListener("click", () => {
    elements.helpDialog.close();
  });

  elements.helpDialog.addEventListener("click", (event) => {
    if (event.target === elements.helpDialog) {
      elements.helpDialog.close();
    }
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
  document.body.classList.toggle("is-computing", isComputing);

  renderControls();
  renderCandidates(getTopCandidates(state, 10));
  renderHistory();
  renderProgress();
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

  for (const button of elements.feedbackButtons.querySelectorAll("button")) {
    button.disabled = isComputing || currentRecommendation.guess === "----";
  }
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
  if (recommendation.reason === "computing") {
    return "正在全量搜索最佳猜测。";
  }
  if (recommendation.reason === "error") {
    return "计算失败，请刷新页面后重试。";
  }
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

function requestRecommendation() {
  recommendationJobId += 1;
  const jobId = recommendationJobId;
  isComputing = true;
  calculationProgress = { completed: 0, total: 1, percent: 0 };
  currentRecommendation = createPlaceholderRecommendation("computing");
  render();

  if (solverWorker) {
    solverWorker.terminate();
  }

  solverWorker = createSolverWorker();
  if (solverWorker) {
    solverWorker.onmessage = (event) => handleWorkerMessage(event.data, jobId);
    solverWorker.postMessage({ id: jobId, state });
    return;
  }

  recommendGuessWithProgress(state, {
    onProgress: (progress) => {
      if (jobId !== recommendationJobId) {
        return;
      }
      calculationProgress = progress;
      renderProgress();
    }
  })
    .then((recommendation) => finishRecommendation(jobId, recommendation))
    .catch(() => finishRecommendation(jobId, createPlaceholderRecommendation("error")));
}

function createSolverWorker() {
  if (!("Worker" in window)) {
    return null;
  }

  try {
    return new Worker(new URL("./solver-worker.js", import.meta.url), {
      type: "module"
    });
  } catch {
    return null;
  }
}

function handleWorkerMessage(message, jobId) {
  if (message.id !== jobId || jobId !== recommendationJobId) {
    return;
  }

  if (message.type === "progress") {
    calculationProgress = message.progress;
    renderProgress();
    return;
  }

  if (message.type === "result") {
    finishRecommendation(jobId, message.recommendation);
    return;
  }

  if (message.type === "error") {
    finishRecommendation(jobId, createPlaceholderRecommendation("error"));
  }
}

function finishRecommendation(jobId, recommendation) {
  if (jobId !== recommendationJobId) {
    return;
  }

  currentRecommendation = recommendation;
  isComputing = false;
  calculationProgress = { completed: 1, total: 1, percent: 1 };
  render();
}

function renderProgress() {
  const percent = Math.max(0, Math.min(1, calculationProgress.percent || 0));
  const percentText = `${Math.round(percent * 100)}%`;
  elements.calculationProgress.hidden = !isComputing;
  elements.calculationProgress.setAttribute("aria-valuenow", String(Math.round(percent * 100)));
  elements.progressFill.style.width = percentText;
  elements.progressText.textContent = `全量搜索 ${percentText}`;
  elements.progressCount.textContent = `${formatInteger(calculationProgress.completed || 0)} / ${formatInteger(calculationProgress.total || 0)}`;
  elements.statusText.textContent = isComputing
    ? "计算中"
    : state.candidates.length === 0
      ? "异常"
      : "进行中";
}

function renderBuildInfo() {
  const buildInfo = window.NUM_BOMB_BUILD ?? {};
  const version = buildInfo.version ?? "unknown";
  const builtAt = buildInfo.builtAt ?? "unknown";

  elements.buildVersion.textContent = version;
  elements.buildTime.textContent = formatBuildTime(builtAt);
  if (builtAt !== "unknown") {
    elements.buildTime.setAttribute("datetime", builtAt);
  }
}

function formatBuildTime(value) {
  if (!value || value === "local-dev" || value === "unknown") {
    return value || "unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return value.replace("T", " ").replace("Z", " UTC");
}

function createPlaceholderRecommendation(reason) {
  return {
    guess: "----",
    score: 0,
    reason,
    candidate: false
  };
}

function openHelp(helpId) {
  const item = getHelpItem(helpId);
  elements.helpTitle.textContent = item.title;
  elements.helpBody.textContent = item.body;
  elements.helpDialog.showModal();
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
