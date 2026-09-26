# Groovebox V2 Core Sequencer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace MPC Studio's fixed Boolean 16-step sequencer with a backward-compatible multi-bar sequencer that supports rich per-step performance data and a touch-friendly multi-track grid.

**Architecture:** Keep the existing static/PWA architecture. Add a pure sequencer core module for model/migration/timing math, then a browser adapter that integrates it with `app.js` and the current Web Audio scheduler. Existing V6 projects migrate in memory to V7 on load.

**Tech Stack:** Vanilla JavaScript, Web Audio API, Node 22 built-in test runner, existing HTML/CSS/PWA.

**Spec:** `docs/superpowers/specs/2026-09-26-groovebox-v2-design.md`

## Global Constraints

- Project schema becomes version 7.
- Patterns support 1..8 bars with 16 base steps per bar.
- Step fields are exactly: `on`, `velocity`, `probability`, `micro`, `pitch`, `ratchet`, `accent`, `locks`.
- Ranges: velocity/probability 0..1, micro -0.49..0.49, pitch -24..24, ratchet 1..8.
- Old V6 Boolean steps must migrate without destroying project data.
- Existing pads, factory sounds, samples, oriental kit, DJ modules, Supabase save/load, PWA, and current 1-bar workflow must keep working.
- DOM rendering must not be the authoritative timing state.

## Review Focus

- A V6 project with mixed true/false steps must load as one-bar V7 and sound the same.
- A malformed imported project with out-of-range step values must be clamped rather than crash playback.
- Changing bars while playing must not index outside the track step array.
- Swing plus negative micro-timing must never schedule an event before the current safe audio window.
- Probability and ratchet must not create duplicate events within one scheduler cycle.

---

### Task 1: Testable sequencer core and V7 model

**Files:**
- Create: `sequencer-core.js`
- Create: `tests/sequencer-core.test.js`
- Create: `package.json`
- Modify: `.github/workflows/check.yml`

**Interfaces:**
- Produces: `MPCSequencerCore.createDefaultStep(on)`, `normalizeStep(value)`, `createPattern(options)`, `migrateLegacyPatterns(patterns)`, `resizePattern(pattern,bars)`.
- Consumes: none.

- [ ] **Step 1: Write failing model and migration tests**

Tests assert exact defaults, clamping, V6 Boolean migration to one bar, and 1..8 bar resizing while preserving existing step content.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test`  
Expected: FAIL because `sequencer-core.js` does not exist.

- [ ] **Step 3: Implement the pure core API**

Use a browser/Node compatible UMD-style export so the same file exposes `window.MPCSequencerCore` in the app and `module.exports` in Node tests.

- [ ] **Step 4: Run tests**

Run: `npm test`  
Expected: PASS.

- [ ] **Step 5: Extend CI**

Add `node --check sequencer-core.js` and `npm test` to `.github/workflows/check.yml`.

- [ ] **Step 6: Commit**

`git commit -m "feat: add groovebox v7 sequencer core"`

### Task 2: Deterministic timing/event expansion

**Files:**
- Modify: `sequencer-core.js`
- Modify: `tests/sequencer-core.test.js`

**Interfaces:**
- Consumes: V7 step/pattern structures from Task 1.
- Produces: `expandStepEvents({step, stepIndex, baseTime, stepDuration, swing, swingLane, cycleSeed}) -> Array<{time,velocity,pitch,locks,accent,ratchetIndex}>`.

- [ ] **Step 1: Write failing timing tests**

Cover swing, negative/positive micro timing, probability 0/1, deterministic probability for a cycle seed, ratchet 1/2/8, and no event before the supplied safe base time.

- [ ] **Step 2: Run focused test**

Run: `node --test tests/sequencer-core.test.js`  
Expected: FAIL on missing `expandStepEvents`.

- [ ] **Step 3: Implement event expansion**

Apply swing, then micro timing, then probability, then ratchet subdivision. Clamp event time to the safe scheduler boundary.

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add deterministic groove timing"`

### Task 3: Browser sequencer adapter and multi-bar transport

**Files:**
- Create: `sequencer-v2.js`
- Modify: `app.js`
- Modify: `index.html`
- Modify: `sw.js`

**Interfaces:**
- Consumes: `window.MPCSequencerCore`.
- Produces: `window.MPCSequencerV2` with `getPattern()`, `setBars(n)`, `getStep(padId,index)`, `toggleStep(padId,index)`, `scheduleWindow(now,horizon)`, `serialize()`.
- Existing `playPad(id,time,dest,velocity)` remains the audio trigger.

- [ ] **Step 1: Add an integration smoke test fixture**

Add a Node test that constructs a V7 pattern, toggles steps across bar boundaries, serializes, and reloads it through the core.

- [ ] **Step 2: Add scripts in load order**

Load `sequencer-core.js` before `app.js`, then `sequencer-v2.js` after `app.js`. Add both to the service-worker shell.

- [ ] **Step 3: Replace the current scheduler's Boolean lookup**

The adapter must ask the core for current step events and call `playPad` at absolute Web Audio times with expanded velocity/pitch data.

- [ ] **Step 4: Preserve current one-bar behavior**

On an untouched project at 92 BPM, the default Kick/Snare/Hi-Hat pattern must still play on the same base grid positions.

- [ ] **Step 5: Verify syntax and tests**

Run: `npm test && node --check app.js && node --check sequencer-v2.js`  
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat: integrate multi-bar sequencer transport"`

### Task 4: GRID and STEP editor UI

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `sequencer-v2.js`

**Interfaces:**
- Consumes: browser adapter from Task 3.
- Produces: Sequencing subviews `GRID` and `STEP`, bar navigation, and controls for velocity/probability/micro/pitch/ratchet/accent.

- [ ] **Step 1: Add DOM-state tests for generated control metadata**

Test pure helper output for bar labels and step editor value clamping.

- [ ] **Step 2: Build GRID**

Show multiple pad tracks at once, 16 steps for the selected bar, active playhead, bar selector 1..8, and horizontal containment on mobile.

- [ ] **Step 3: Build STEP editor**

Selecting a grid cell opens the selected step properties without toggling unrelated fields.

- [ ] **Step 4: Add copy/paste bar actions**

Copy and paste preserve full step objects, not just `on`.

- [ ] **Step 5: Run tests/syntax**

Run: `npm test && node --check sequencer-v2.js`  
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat: add groovebox grid and step editor"`

### Task 5: V6/V7 project persistence and song compatibility

**Files:**
- Modify: `app.js`
- Modify: `sequencer-v2.js`
- Modify: `README.md`
- Modify: `tests/sequencer-core.test.js`

**Interfaces:**
- Consumes: V7 adapter serialization.
- Produces: V7 project JSON with backward-compatible import and explicit song order data.

- [ ] **Step 1: Write round-trip tests**

Assert V6 -> V7 -> serialize -> reload preserves enabled steps, pad ids, bars, step properties, BPM, swing, and project name.

- [ ] **Step 2: Update `serializable()` and `applyProject()`**

Write `version:7`; detect <=6 and migrate. Do not rewrite old storage until the next save.

- [ ] **Step 3: Store explicit song arrangement**

Represent entries as `{patternIndex, repeats, mutes:{}}`; migrate current filled-pattern chaining to a default arrangement.

- [ ] **Step 4: Verify local and JSON persistence**

Run tests plus syntax checks.

- [ ] **Step 5: Commit**

`git commit -m "feat: persist groovebox v7 projects"`

### Task 6: Rendered QA for core sequencer

**Files:**
- No committed QA artifacts.

**Interfaces:**
- Consumes: working app from Tasks 1-5.
- Produces: verified desktop/mobile behavior.

- [ ] **Step 1: Serve the branch locally**

Use the existing static HTTP workflow.

- [ ] **Step 2: Validate desktop**

Flow: app loads -> Sequencing -> create 2 bars -> edit velocity/probability/ratchet -> play -> bar 2 advances correctly.

- [ ] **Step 3: Validate mobile**

Check no page-level horizontal overflow, pads remain playable, grid scroll is contained, and primary touch targets remain usable.

- [ ] **Step 4: Validate console**

No relevant runtime errors or service-worker asset misses.

- [ ] **Step 5: Commit any fixes and rerun QA**

Final expected state: core sequencer V2 works without regressing Sampling/DJ/PWA.
