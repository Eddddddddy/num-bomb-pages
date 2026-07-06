# Num Bomb Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a static, mobile-first GitHub Pages/PWA number bomb decoder.

**Architecture:** Keep the solver as a pure JavaScript module with no DOM dependency, then build a small HTML/CSS/JS UI around that API. Store parameters and history in browser local storage; calculate feedback on demand instead of precomputing a large matrix.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript modules, Node-based solver tests, GitHub Pages.

---

## File Structure

- `index.html`: static app shell and semantic UI regions.
- `src/solver.js`: pure solver, priors, presets, strategy scoring, feedback filtering.
- `src/app.js`: DOM rendering, event handling, localStorage, service worker registration.
- `src/styles.css`: mobile-first visual system and responsive layout.
- `tests/solver.test.mjs`: executable Node assertions for the solver.
- `manifest.webmanifest`: PWA metadata.
- `sw.js`: small cache-first service worker.
- `README.md`: usage and publishing notes.

### Task 1: Solver Tests

**Files:**
- Create: `tests/solver.test.mjs`
- Create: `package.json`

- [ ] Write tests for feedback scoring, candidate filtering, presets, and recommendation behavior.
- [ ] Run `npm test` and verify it fails before `src/solver.js` exists.

### Task 2: Solver Core

**Files:**
- Create: `src/solver.js`

- [ ] Implement code generation, feedback scoring, human prior weights, configuration presets, candidate filtering, and recommendation.
- [ ] Run `npm test` and verify solver tests pass.

### Task 3: Static UI

**Files:**
- Create: `index.html`
- Create: `src/app.js`
- Create: `src/styles.css`
- Create: `manifest.webmanifest`
- Create: `sw.js`

- [ ] Implement first-screen decoder, feedback buttons, candidate summaries, history, reset/undo, preset selector, common sliders, advanced controls, and localStorage.
- [ ] Run syntax checks for JS files.

### Task 4: Local Browser Verification

**Files:**
- No new files.

- [ ] Start a local static server.
- [ ] Verify the page loads on a mobile-sized viewport.
- [ ] Exercise the workflow: change preset, drag sliders, enter feedback, undo, reset.

### Task 5: GitHub Pages Publication

**Files:**
- Create: `.gitignore`
- Create: `README.md`

- [ ] Initialize git, commit the project, create a new GitHub repository, push `main`, and enable GitHub Pages from the repository root.
- [ ] Verify the GitHub Pages URL is available or report that deployment is still building.
