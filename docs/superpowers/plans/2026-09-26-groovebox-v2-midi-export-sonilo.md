# Groovebox V2 MIDI, Export & Sonilo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Groovebox V2 with optional Web MIDI, professional WAV stem/MIDI export, performance tools, and a secure Sonilo AI creation workflow backed by authenticated Supabase Edge Functions.

**Architecture:** MIDI encoding, performance-event expansion, and export decisions live in pure browser/Node-compatible modules. Sonilo credentials remain exclusively in Supabase Edge Function secrets; the browser invokes authenticated functions, polls normalized task state, downloads generated audio, and imports it through MPC Studio's existing sample pipeline. The app never receives the Sonilo API key.

**Tech Stack:** Vanilla JavaScript, Web MIDI API, Web Audio API, OfflineAudioContext, Standard MIDI File format, Supabase Edge Functions (Deno/TypeScript), Sonilo HTTPS API, Node 22 built-in tests.

**Spec:** `docs/superpowers/specs/2026-09-26-groovebox-v2-design.md`

## Global Constraints

- App remains fully usable when Web MIDI is unavailable or permission is denied.
- MIDI Learn maps pad triggers and selected mixer controls only.
- Export supports current pattern and explicit song arrangement.
- Master WAV export remains available.
- Stem export produces one file per audible track using the same mixer state as live playback.
- Sonilo key is read only from `Deno.env.get('SONILO_API_KEY')` inside Supabase Edge Functions.
- Sonilo runtime API base is exactly `https://api.sonilo.com`.
- Music generation uses `POST /v1/text-to-music` with `mode=async`.
- Sound-effect generation uses `POST /v1/text-to-sfx`.
- Async polling uses `GET /v1/tasks/{task_id}`.
- Sonilo credentials must never enter browser JavaScript, localStorage, IndexedDB, project JSON, service-worker cache, Supabase `project_data`, logs, or GitHub.
- Edge Functions must require an authenticated Supabase user.
- Do not deploy Sonilo functions to an unrelated Supabase project without explicit project confirmation.

## Review Focus

- Browsers without `navigator.requestMIDIAccess` must not throw during startup.
- Reconnecting a MIDI device must not duplicate message listeners.
- Empty patterns must still export valid MIDI files and valid silent WAV stems when explicitly requested.
- Sonilo 401/402/403/429 responses must be normalized and must never leak Authorization headers.
- A generated Sonilo URL that fails to download or decode must not overwrite the selected pad.

---

### Task 1: Standard MIDI File encoder

**Files:**
- Create: `midi-core.js`
- Create: `tests/midi-core.test.js`
- Modify: `.github/workflows/check.yml`
- Modify: `sw.js`

**Interfaces:**
- Consumes: normalized V7 patterns, song arrangement and BPM.
- Produces: `MPCMIDI.encodePattern(options) -> Uint8Array`, `encodeSong(options) -> Uint8Array`, `toDownloadBlob(bytes) -> Blob`.

- [ ] **Step 1: Write failing MIDI-format tests**

Assert `MThd`/`MTrk` headers, tempo event, note-on/note-off ordering, variable-length quantities, end-of-track, empty-pattern validity and multi-pattern song duration.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test`  
Expected: FAIL because `midi-core.js` is missing.

- [ ] **Step 3: Implement the encoder**

Use fixed PPQ 480. Map 16th-note grid steps to 120 ticks. Velocity uses step velocity/accent. Ratchets create sub-notes within the step. Pitch uses a stable per-pad default note plus step pitch offset.

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Add CI syntax coverage and commit**

`git commit -m "feat: add groovebox midi export core"`

### Task 2: Optional Web MIDI and MIDI Learn

**Files:**
- Create: `midi.js`
- Create: `tests/midi-mapping.test.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `pwa.js`
- Modify: `sw.js`

**Interfaces:**
- Consumes: `MPCMIDI`, `playPad`, mixer setter API.
- Produces: `window.MPCMIDIController.init()`, `learn(target)`, `clearMapping(target)`, `exportPattern()`, `exportSong()`.

- [ ] **Step 1: Write mapping tests**

Test MIDI note/CC normalization, duplicate mapping replacement and serialization of mappings.

- [ ] **Step 2: Feature-detect Web MIDI**

If unavailable, show a non-blocking "MIDI non disponible" state and do not request permission automatically.

- [ ] **Step 3: Implement MIDI Learn**

User explicitly arms Learn, then the next supported Note/CC message binds to the chosen pad or selected mixer control.

- [ ] **Step 4: Prevent listener duplication**

Track connected inputs by id and detach old handlers when device topology changes.

- [ ] **Step 5: Add MIDI export controls**

Expose current pattern and song export without requiring MIDI hardware.

- [ ] **Step 6: Run tests/syntax and commit**

`git commit -m "feat: add web midi and midi learn"`

### Task 3: Performance extensions

**Files:**
- Create: `performance-v2.js`
- Create: `tests/performance-v2.test.js`
- Modify: `sequencer-v2.js`
- Modify: `index.html`
- Modify: `styles.css`

**Interfaces:**
- Consumes: selected step, pad trigger API and transport clock.
- Produces: `MPCPerformanceV2.expandFlam(step,amount)`, `triggerStutter(options)`, `setAccent(value)`, `setRepeatDivision(value)`.

- [ ] **Step 1: Write failing performance tests**

Cover flam double-hit spacing, ratchet/repeat divisions, accent velocity multiplication and bounded stutter event counts.

- [ ] **Step 2: Implement Flam**

Flam schedules a second hit inside the same step without changing the stored ratchet count.

- [ ] **Step 3: Implement Stutter**

Stutter repeats the currently selected pad or step over a bounded 1/8..1/32 window and stops cleanly on pointer release/transport stop.

- [ ] **Step 4: Integrate Accent and Full Level**

Accent remains per-step; Full Level remains live-performance global behavior.

- [ ] **Step 5: Run tests and commit**

`git commit -m "feat: add groovebox performance tools"`

### Task 4: Per-track WAV stem export

**Files:**
- Create: `export-v2.js`
- Create: `tests/export-v2.test.js`
- Modify: `app.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: V7 sequence state, offline audio graph builder, mixer/FX state.
- Produces: `MPCExportV2.renderMaster(options)`, `renderStem(padId,options)`, `renderAllStems(options)`.

- [ ] **Step 1: Write export-selection tests**

Assert selected pad inclusion, mute/solo rules, duration calculation across bars/song entries and safe filenames.

- [ ] **Step 2: Refactor current WAV export through shared renderer**

Existing master WAV button uses `renderMaster`.

- [ ] **Step 3: Implement individual stem rendering**

Render one audible pad/track at a time through its own mixer state. Send/master FX policy must be explicit: default stem export includes track inserts and sends rendered as heard for that soloed track.

- [ ] **Step 4: Add "EXPORT STEMS" UI**

Download sequentially with clear progress; do not start dozens of OfflineAudioContexts simultaneously.

- [ ] **Step 5: Run tests and commit**

`git commit -m "feat: add per-track wav stem export"`

### Task 5: Supabase Sonilo Edge Function client contract

**Files:**
- Create: `sonilo-core.js`
- Create: `tests/sonilo-core.test.js`
- Create: `supabase/functions/sonilo-generate/index.ts`
- Create: `supabase/functions/sonilo-task/index.ts`
- Create: `supabase/functions/sonilo-generate/deno.json`
- Create: `supabase/functions/sonilo-task/deno.json`

**Interfaces:**
- Browser consumes:
  - `POST /functions/v1/sonilo-generate` body `{type:"music"|"sfx",prompt,duration,format?}`
  - `POST /functions/v1/sonilo-task` body `{taskId}`
- Edge generate produces: normalized `{taskId,status:"processing"}`.
- Edge task produces normalized terminal/processing result with only `taskId`, `status`, `type`, `audio`, `error`, `retryAfter`.
- Pure client core produces `normalizeGenerateRequest`, `normalizeTaskResponse`.

- [ ] **Step 1: Write failing client-contract tests**

Validate prompt trimming/length, music duration 5..360 seconds, SFX duration 0.5..180 seconds, allow-listed formats, task-id syntax and normalized upstream errors.

- [ ] **Step 2: Implement browser-side validation helpers**

Reject invalid input before any generation request.

- [ ] **Step 3: Implement `sonilo-generate` Edge Function**

Require authenticated user. Read `SONILO_API_KEY` from Edge Function secrets. Build `FormData`. For music call `https://api.sonilo.com/v1/text-to-music` with `mode=async`; for SFX call `https://api.sonilo.com/v1/text-to-sfx`. Forward no client Authorization header upstream. Normalize 401/402/403/429/422/5xx without returning upstream headers or credentials.

- [ ] **Step 4: Implement `sonilo-task` Edge Function**

Require authenticated user. Validate task id. Call exactly `GET https://api.sonilo.com/v1/tasks/{task_id}`. Return only normalized safe fields.

- [ ] **Step 5: Add secret-absence tests/static checks**

Repository test scans committed source for `sk_` patterns and ensures no Sonilo bearer literal or exposed secret is present.

- [ ] **Step 6: Run tests/syntax and commit**

`git commit -m "feat: add secure sonilo edge functions"`

### Task 6: SONILO AI creation UI and pad import

**Files:**
- Create: `sonilo.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `pwa.js`
- Modify: `sw.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: authenticated Supabase client, Edge Function contract from Task 5, existing `decodeBlob`/pad import pipeline.
- Produces: Creation subview `SONILO AI` with music/SFX generation and safe import into selected pad.

- [ ] **Step 1: Build Sonilo panel**

Fields: type, prompt, duration, supported output format. Button text makes clear that generation starts an external AI job.

- [ ] **Step 2: Invoke through the signed-in Supabase session**

If no authenticated Supabase user exists, show a login-required state instead of calling the Edge Function.

- [ ] **Step 3: Poll task every 3 seconds**

Stop on `succeeded`, `failed`, or after a bounded UI timeout; stopping polling never claims the Sonilo task itself was canceled.

- [ ] **Step 4: Import successful audio safely**

Fetch returned HTTPS audio URL, decode it first, then atomically replace the selected pad only after decode succeeds. Preserve provider metadata as `externalMeta.provider = "Sonilo"`.

- [ ] **Step 5: Error UX**

Differentiate authentication/setup, insufficient balance, unavailable service, rate limit and generation failure without showing secrets or raw Authorization details.

- [ ] **Step 6: Cache rules**

Service worker must never cache `/functions/v1/sonilo-*` responses or temporary Sonilo audio URLs.

- [ ] **Step 7: Run tests/syntax and commit**

`git commit -m "feat: add sonilo ai creation workflow"`

### Task 7: Deploy Sonilo functions to the correct Supabase project

**Files:**
- No GitHub source changes unless deployment config requires it.

**Interfaces:**
- Consumes: deployed function source from Task 5 and project secret `SONILO_API_KEY`.
- Produces: authenticated live function endpoints for MPC Studio.

- [ ] **Step 1: Confirm MPC Studio Supabase project identity**

Do not assume the currently visible `taxisparis` project is appropriate. The target project must be the Supabase backend used by MPC Studio.

- [ ] **Step 2: Confirm `SONILO_API_KEY` exists as an Edge Function project secret**

The secret value itself is not read back or printed.

- [ ] **Step 3: Deploy `sonilo-generate` with authentication enabled**

Use `verify_jwt: true`.

- [ ] **Step 4: Deploy `sonilo-task` with authentication enabled**

Use `verify_jwt: true`.

- [ ] **Step 5: Smoke-test without spending generation credits**

Call the authenticated function with an intentionally invalid request and confirm validation occurs before the Sonilo upstream call. Do not invoke paid generation during deployment QA unless explicitly requested.

### Task 8: End-to-end QA

**Files:**
- No committed QA artifacts.

**Interfaces:**
- Consumes: complete V2 application.
- Produces: release-ready validation evidence.

- [ ] **Step 1: MIDI fallback QA**

Load with MIDI unsupported/denied and confirm no startup regression.

- [ ] **Step 2: MIDI hardware path when available**

Learn one pad and one CC; reconnect input; verify no duplicate triggers.

- [ ] **Step 3: Export QA**

Export master WAV, one stem set, current pattern MIDI and song MIDI.

- [ ] **Step 4: Sonilo non-billable QA**

Verify login-required state, input validation, missing-secret/config error normalization and task polling UI using existing task data only when available.

- [ ] **Step 5: Sonilo generation QA only on explicit approval**

If the user explicitly requests a real generation, create one short music or SFX job and import the completed result into a pad.

- [ ] **Step 6: Desktop/mobile final smoke test**

Sampling, Sequencing, Creation, DJ, local save/load, cloud save/load and PWA shell all load without relevant console errors.
