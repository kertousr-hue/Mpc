# Groovebox V2 Mixer FX Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-track mixing, synchronized FX, master dynamics, parameter locks, and live automation to the working Groovebox V2 sequencer.

**Architecture:** Insert a reusable Web Audio track graph between every pad source and the master output. Keep DSP state in plain serializable objects, with a pure automation core for tests. The current pad trigger functions continue creating sources; only their destination changes from the master directly to a track input.

**Tech Stack:** Vanilla JavaScript, Web Audio API, OfflineAudioContext, Node 22 built-in tests, existing HTML/CSS/PWA.

**Spec:** `docs/superpowers/specs/2026-09-26-groovebox-v2-design.md`

## Global Constraints

- Existing sampling, pads, sequencer, DJ modules and PWA must remain operational.
- Mixer state is per pad/track and includes pan, 3-band EQ, filter cutoff/resonance, send A/B, mute and solo.
- FX include BPM-synced delay, reverb, distortion, bit crusher, chorus/flanger and filter.
- Two send buses plus master compressor/limiter.
- Step locks may control gain, pan, pitch, filter and FX sends.
- Offline export must recreate the same audible routing.
- No third-party copyrighted DSP assets.

## Review Focus

- A muted track must produce no dry or send-bus audio.
- Solo must isolate only soloed tracks without corrupting their saved mute state.
- Repeated graph creation must not double-connect nodes and increase volume.
- Automation written while transport loops must remain bounded to the intended pattern/bar position.
- Offline rendering must use the same mixer values as live playback.

---

### Task 1: Track mixer state and pure validation

**Files:**
- Create: `mixer-core.js`
- Create: `tests/mixer-core.test.js`
- Modify: `package.json`
- Modify: `.github/workflows/check.yml`

**Interfaces:**
- Consumes: pad ids and V7 project serialization.
- Produces: `createMixerState()`, `normalizeMixerState(value)`, `effectiveTrackGain({gain,muted,soloed,anySolo})`.

- [ ] **Step 1: Write failing mixer-state tests**

Assert exact defaults and clamping for pan -1..1, EQ -12..12 dB, cutoff 0..1, resonance 0..20, sends 0..1, plus mute/solo gain behavior.

- [ ] **Step 2: Run test and confirm failure**

Run: `npm test`  
Expected: FAIL on missing mixer core.

- [ ] **Step 3: Implement the pure mixer core**

Export for both Node and browser via `window.MPCMixerCore`.

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Add CI syntax coverage and commit**

`git commit -m "feat: add mixer state core"`

### Task 2: Live Web Audio track graph

**Files:**
- Create: `audio-engine-v2.js`
- Modify: `app.js`
- Modify: `index.html`
- Modify: `sw.js`

**Interfaces:**
- Consumes: `MPCMixerCore`, global AudioContext, current pad state.
- Produces: `window.MPCAudioEngineV2.ensure(context,masterDestination)`, `getTrackInput(padId)`, `setTrackState(padId,state)`, `setSoloSet(ids)`, `setMaster(value)`.

- [ ] **Step 1: Write graph-construction helper tests**

Test that repeated `ensureTrackDescriptor(padId)` returns one logical track descriptor and never duplicates state.

- [ ] **Step 2: Build each track chain**

Use gain -> low shelf -> peaking EQ -> high shelf -> low-pass filter -> stereo panner -> dry/master, with send taps feeding shared FX buses.

- [ ] **Step 3: Route pad playback through track input**

Modify `playPad` so factory and user samples use the track destination rather than `masterGain` directly; preserve explicitly supplied offline destinations.

- [ ] **Step 4: Verify mute/solo**

Muted tracks silence both dry and sends. Solo selection is applied at the audio graph without overwriting stored mute flags.

- [ ] **Step 5: Run syntax/tests and commit**

`git commit -m "feat: route pads through per-track mixer"`

### Task 3: BPM-synced FX rack and master dynamics

**Files:**
- Create: `fx-rack.js`
- Create: `tests/fx-rack.test.js`
- Modify: `audio-engine-v2.js`
- Modify: `sw.js`

**Interfaces:**
- Consumes: AudioContext, current BPM.
- Produces: `MPCFXRack.create(context,destination)`, `setBpm(bpm)`, `setDelayDivision(value)`, `setEffectState(name,state)`, `getSendAInput()`, `getSendBInput()`.

- [ ] **Step 1: Write pure timing/parameter tests**

Test BPM-to-delay conversion at 60, 92, 120 BPM and clamp all effect controls.

- [ ] **Step 2: Implement send A synchronized delay**

Support musical divisions without rescheduling existing sample sources.

- [ ] **Step 3: Implement send B reverb**

Generate an original synthetic impulse response in code; no bundled copyrighted IR.

- [ ] **Step 4: Add insert/master effects**

Implement distortion waveshaper, bit crusher strategy, chorus/flanger delay modulation, compressor and limiter.

- [ ] **Step 5: Run tests/syntax and commit**

`git commit -m "feat: add groovebox fx rack"`

### Task 4: Automation and parameter-lock core

**Files:**
- Create: `automation-core.js`
- Create: `automation.js`
- Create: `tests/automation-core.test.js`
- Modify: `sequencer-v2.js`

**Interfaces:**
- Consumes: V7 step `locks`, pattern bar/step coordinates and mixer/FX setters.
- Produces: `normalizeLocks()`, `recordPoint(lane,position,value)`, `sampleLane(lane,position)`; browser API `MPCWorkflowAutomation.applyStepLocks(...)`.

- [ ] **Step 1: Write failing lock/lane tests**

Cover unsupported parameter rejection, interpolation rules, loop wrap, and bounded event count.

- [ ] **Step 2: Implement step lock normalization**

Allowed lock keys: `gain`, `pan`, `pitch`, `cutoff`, `sendA`, `sendB`.

- [ ] **Step 3: Implement live automation capture**

Record normalized pattern positions while transport is running; coalesce near-duplicate points so a long session cannot grow without bound.

- [ ] **Step 4: Integrate scheduler application**

Apply a step's locks at its absolute event time. Step pitch adds to pad pitch; other locks target track/FX nodes.

- [ ] **Step 5: Run tests and commit**

`git commit -m "feat: add parameter locks and automation"`

### Task 5: MIXER, FX RACK and AUTOMATION interface

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `audio-engine-v2.js`
- Modify: `fx-rack.js`
- Modify: `automation.js`

**Interfaces:**
- Consumes: audio/mixer/automation APIs from Tasks 1-4.
- Produces: touch UI subviews `MIXER`, `FX RACK`, `AUTOMATION`.

- [ ] **Step 1: Use 12ui design tooling to produce improvement candidates**

Base the candidates on the existing MPC Studio interface. Preserve app identity and functionality rather than copying G-Stomper artwork.

- [ ] **Step 2: Select and integrate one coherent direction**

Track strips show name, level, pan, mute, solo, filter and FX sends. Advanced EQ expands on demand instead of crowding mobile.

- [ ] **Step 3: Add FX panel**

Show two send buses, synchronized delay division, reverb amount, insert/master effect toggles, compressor and limiter state.

- [ ] **Step 4: Add automation panel**

Choose parameter, arm recording, clear lane, and show whether selected steps contain locks.

- [ ] **Step 5: Verify mobile target sizes and local scrolling**

Primary live controls should remain practically touchable (target roughly 44px) and not cause page-wide horizontal overflow.

- [ ] **Step 6: Run syntax/tests and commit**

`git commit -m "feat: add mixer fx and automation interface"`

### Task 6: Persistence and offline audio parity

**Files:**
- Modify: `app.js`
- Modify: `audio-engine-v2.js`
- Modify: `fx-rack.js`
- Modify: `README.md`
- Modify: `tests/mixer-core.test.js`
- Modify: `tests/automation-core.test.js`

**Interfaces:**
- Consumes: mixer/FX/automation states.
- Produces: V7 project serialization and an offline graph builder mirroring the live engine.

- [ ] **Step 1: Add serialization round-trip tests**

Mixer and automation state must survive save/load/export/import exactly within normalized ranges.

- [ ] **Step 2: Persist mixer and FX state**

Existing V7 projects without these fields receive safe defaults.

- [ ] **Step 3: Build offline graph parity**

`renderWav` uses the same state and routing structure through `OfflineAudioContext`.

- [ ] **Step 4: Run tests and commit**

`git commit -m "feat: persist and render groovebox mixer state"`

### Task 7: Rendered and audible QA

**Files:**
- No committed QA artifacts.

**Interfaces:**
- Consumes: completed mixer/FX/automation implementation.
- Produces: verified desktop/mobile result.

- [ ] **Step 1: Verify main flow**

Load -> Sequencing -> MIXER -> change gain/pan/filter -> play -> audible/visible state changes.

- [ ] **Step 2: Verify mute/solo/send behavior**

Exercise at least two tracks and both send buses.

- [ ] **Step 3: Verify automation loop**

Record a parameter movement across one loop and verify it repeats without event growth.

- [ ] **Step 4: Verify offline WAV**

Render a short project with mixer/FX state and ensure export completes without console errors.

- [ ] **Step 5: Mobile QA and final fixes**

Check pads, strips, dialogs, overflow, and touch interactions.
