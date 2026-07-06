# Num Bomb Pages Design

## Goal

Build a mobile-first GitHub Pages/PWA version of the 4-digit number bomb decoder. The app must run as a static site, require no Apple Developer Program, and work well from iPhone Safari.

## Core Rules

- Answers are `0000` through `9999`.
- Repeated digits are allowed.
- The only feedback input is the count of digits in the correct position, from `0` to `4`.
- Feedback is treated as exact by default. A future-tolerant mode can allow one feedback error, but the first implementation only exposes `0` and `1`.

## Solver Model

The solver keeps all 10,000 four-digit codes in memory and filters candidates after each feedback entry. It does not precompute a 100 MB feedback matrix; all feedback scores are calculated on demand so the app stays suitable for mobile browsers.

The prior probability is a blend:

```text
P = alpha * P_human + (1 - alpha) * P_uniform
```

For defensive play, the app can use a contrarian preset that weakens the human prior by raising repeated and obvious-pattern weights instead of forbidding them.

## Parameters

Common controls:

- Preset: default human, anti-counterplay, strong human read, custom.
- Human prior strength.
- One-pair weight.
- Consecutive straight weight.
- Zigzag multiplier.
- Hit threshold.
- Strategy mode: entropy, expected, minimax.

Advanced controls:

- Leading zero weight.
- Two-pair weight.
- Three-same weight.
- Four-same weight.
- Strict monotonic weight.
- High/low alternating multiplier.
- Allow probe guesses.
- Non-candidate penalty.
- Max feedback errors: `0` or `1`.

Settings are saved in `localStorage` and recalculated immediately when changed.

## Interface

The first mobile viewport is the usable decoder, not a landing page. It includes:

- Current recommended guess as the primary visual element.
- Five large feedback buttons for `0` to `4`.
- Candidate count, entropy/score hint, and top likely answers.
- A compact history with undo and reset.
- A collapsible parameters panel with common controls first and advanced controls behind a disclosure.

The UI uses native HTML controls, large tap targets, high contrast text, and stable dimensions to avoid layout shifts while playing.

## Deployment

The project is a plain static site:

- `index.html`
- `src/solver.js`
- `src/app.js`
- `src/styles.css`
- `manifest.webmanifest`
- `sw.js`

GitHub Pages serves the repository root from the default branch. No build step is required.
