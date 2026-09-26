# MPC Studio — Groovebox V2 Design

Date: 2026-09-26  
Branch: `feat/groovebox-v2`

## 1. Goal

Evolve MPC Studio from a 16-step drum machine into a touch-first groovebox inspired by the workflow depth of G-Stomper Rhythm, while keeping MPC Studio's own visual identity, 64-pad bank model, sampling workflow, PWA support, DJ modules, Supabase projects, and existing project compatibility.

The upgrade must improve actual music-making capability rather than only adding more controls.

Success means a user can build a multi-bar groove, shape individual steps, mix tracks, automate parameters, perform live, export stems/MIDI, and optionally generate licensed source material through Sonilo without exposing any secret in the browser.

## 2. Scope

### In scope

1. Sequencer V2
   - 1 to 8 bars per pattern.
   - 16 steps per bar as the base grid.
   - Per-pattern time signature metadata.
   - Quantize choices: 1/8, 1/16, 1/32, 1/8T, 1/16T.
   - Global swing plus selectable swing lanes.
   - Step properties:
     - enabled
     - velocity
     - probability
     - micro-timing
     - pitch offset
     - ratchet count
     - accent
   - Track overview / grid view for multiple pads at once.
   - Copy/paste bars and patterns.

2. Mixer V2
   - Per-pad/track gain and pan.
   - 3-band EQ.
   - Filter cutoff/resonance.
   - Mute/solo.
   - FX sends.
   - Master compressor/limiter.

3. FX Rack
   - Delay synced to BPM.
   - Reverb.
   - Distortion.
   - Bit crusher.
   - Chorus/flanger.
   - Filter.
   - Two send buses plus master processing.
   - Web Audio implementation, no copyrighted DSP assets.

4. Automation
   - Parameter locks per step for gain, pan, pitch, filter, FX send.
   - Live automation recording during playback.
   - Automation lanes stored with the project.

5. Performance
   - Improved Note Repeat.
   - Roll/ratchet.
   - Flam.
   - Stutter.
   - Accent.
   - Full Level.
   - Live recording into the step grid with quantize.

6. Pattern / Song
   - Pattern chaining.
   - Song arrangement with explicit order, repeat count, and optional mute states.
   - Existing "song mode" migration to the new arrangement structure.

7. MIDI
   - Web MIDI input where supported.
   - MIDI Learn for pad triggering and selected mixer controls.
   - Export current pattern and song as Standard MIDI File.
   - MIDI is optional at runtime; the app remains fully functional without it.

8. Export
   - Master WAV.
   - Per-track WAV stems.
   - MIDI export.
   - Existing JSON project export remains available.

9. Sonilo integration
   - New "SONILO AI" creation panel.
   - Generate music or sound effects from text through authenticated Supabase Edge Functions.
   - Poll asynchronous Sonilo tasks and import the resulting audio into the selected pad.
   - No Sonilo API key, password, token, or secret is ever stored in browser code, localStorage, IndexedDB, exported project JSON, Supabase project_data, or GitHub.
   - Server reads `SONILO_API_KEY` from Supabase Edge Function project secrets.
   - Validate request size, duration, text length, and allowed generation type before sending to Sonilo.
   - UI clearly marks generation as an external service operation.

10. Compatibility
   - Existing v6 projects must load automatically.
   - Old Boolean step arrays are converted to the new step-event format.
   - Existing factory sounds, imported samples, oriental kit metadata, Supabase sample paths, DJ modules, and PWA installation continue to work.

## 3. Non-goals for V2

- No attempt to clone G-Stomper's branding or exact visual design.
- No full DAW audio timeline.
- No VST/AU plugin hosting.
- No arbitrary third-party JavaScript DSP plugins.
- No collaborative realtime editing in the first V2 implementation.
- No secret API keys entered into the client UI.

## 4. Data model

Project schema increases from version 6 to version 7.

### Pattern

A pattern stores:
- `bars`: integer 1..8
- `stepsPerBar`: 16
- `timeSignature`: initially `{ numerator: 4, denominator: 4 }`
- `tracks`: map keyed by pad id
- `automation`: automation lanes
- `swing`: pattern-level swing settings

### Step event

Each step is an object:

```js
{
  on: false,
  velocity: 1,
  probability: 1,
  micro: 0,
  pitch: 0,
  ratchet: 1,
  accent: false,
  locks: {}
}
```

Ranges:
- velocity: 0..1
- probability: 0..1
- micro: -0.49..0.49 of one grid step
- pitch: -24..24 semitones
- ratchet: 1..8

A disabled step can keep its edited values so re-enabling it restores the user's settings.

### Track mixer state

Each pad receives:

```js
mixer: {
  pan: 0,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  cutoff: 1,
  resonance: 0,
  sendA: 0,
  sendB: 0
}
```

The existing `gain`, `pitch`, `muted`, and loop/sample fields remain compatible.

## 5. Scheduling architecture

The current look-ahead scheduler remains the timing foundation because it already schedules Web Audio events ahead of playback.

V2 changes:
- Schedule absolute audio times from bar + step indices.
- Apply swing before micro-timing.
- Apply probability using deterministic per-cycle randomness so a cycle is internally consistent.
- Expand a ratchet into multiple sub-events inside the step.
- Step pitch is added to pad pitch.
- Step velocity is multiplied by pad gain.
- Parameter locks are scheduled at the same absolute event time.
- UI animation is separated from audio scheduling so rendering cannot affect timing.

The scheduler must never use DOM state as its authoritative musical state.

## 6. Audio graph

Per track:

```
source -> trackGain -> filter -> EQ -> pan -> dry/master
                                      \-> send A
                                      \-> send B
```

Send buses:

```
send A -> delay -> return A
send B -> reverb -> return B
```

Master:

```
dry + returns -> compressor -> limiter -> masterGain -> destination
```

Offline export recreates the same graph using `OfflineAudioContext`.

## 7. UI design

Keep the current dark MPC Studio identity, but reorganize Sequencing into four subviews:

1. GRID
   - multi-track step matrix
   - bar navigation
   - active step playhead

2. STEP
   - contextual editor for velocity, probability, micro-timing, pitch, ratchet and locks

3. MIXER
   - touch-friendly track strips
   - gain, pan, EQ, filter, sends, mute, solo

4. SONG
   - pattern arrangement and repeat counts

Creation gains:
- FX RACK
- AUTOMATION
- SONILO AI

Mobile requirements:
- no horizontal page overflow
- 44px minimum practical touch targets for primary controls
- pad playing remains one-tap
- sequencer can horizontally scroll inside its own region
- mixer uses paged or scrollable strips, not compressed unreadable controls

The visual redesign will use the available design tooling (12ui) to generate candidate directions before final CSS integration.

## 8. Sonilo security architecture

MPC Studio is currently mostly static client-side code. Sonilo requires a server boundary. Because the Sonilo key is being stored in Supabase, the V2 server boundary uses Supabase Edge Functions.

Add Supabase Edge Functions:

- `supabase/functions/sonilo-generate/index.ts`
  - POST
  - authenticated user access only
  - accepts a narrow allow-listed payload for `music` or `sfx`
  - validates prompt/duration/options
  - sends request to Sonilo using `Deno.env.get('SONILO_API_KEY')`

- `supabase/functions/sonilo-task/index.ts`
  - POST with task id
  - authenticated user access only
  - returns normalized task state and only the fields required by the client

Optional future function:
- `supabase/functions/sonilo-usage/index.ts` for account usage display

Security:
- secret only in Supabase Edge Function project secrets
- never echo the API key
- browser invokes the function through the signed-in Supabase session
- no client-provided upstream URL
- strict allow-list of Sonilo operations and parameters
- response normalization
- reasonable per-request size limits
- no logging of Authorization headers or Sonilo credentials
- no secret in service worker cache, localStorage, IndexedDB, project JSON, or database project_data
- deploy only to the Supabase project that owns MPC Studio; do not silently reuse an unrelated application project

If the currently exposed key was shared in chat or screenshots, it must be revoked and replaced before production use.

## 9. Migration

`applyProject` detects versions <= 6.

For every old Boolean step:
- false -> default step object with `on:false`
- true -> default step object with `on:true`

Old 16-step patterns become one-bar V7 patterns.

The migration is in memory; the project becomes V7 on the next save/export. No destructive rewrite occurs during load.

## 10. File boundaries

Expected changes:
- `app.js`: migration wiring, transport compatibility, top-level integration
- new `sequencer-v2.js`: step model, scheduling, pattern/bar operations
- new `mixer-v2.js`: audio graph and mixer state
- new `fx-rack.js`: FX nodes and parameter controls
- new `automation.js`: parameter locks and live automation
- new `midi.js`: Web MIDI and MIDI export
- new `sonilo.js`: client UI and calls to same-origin Vercel functions
- new `supabase/functions/sonilo-generate/index.ts`
- new `supabase/functions/sonilo-task/index.ts`
- `index.html`: new controls/subviews
- `styles.css`: new responsive UI
- `sw.js`: cache new local static modules, never cache Sonilo API responses
- `README.md`: V2 capabilities and secure Sonilo setup

Existing DJ modules should remain isolated and should not be rewritten unless a compatibility issue is found.

## 11. Testing

Automated / code-level:
- project v6 -> v7 migration
- bar length changes
- step property clamping
- probability determinism
- ratchet event expansion
- swing + micro timing boundaries
- MIDI file generation
- serialization round-trip
- Sonilo endpoint validation and secret absence from responses

Rendered QA:
- desktop and mobile load
- pads still trigger audio
- 1-bar and multi-bar playback
- step editor changes audible behavior
- mixer mute/solo/gain/filter
- FX send behavior
- song chaining
- local save/load
- PWA offline shell
- Sonilo UI error states without leaking credentials

## 12. Rollout

Phase 1: core sequencer data model + migration + multi-bar playback.  
Phase 2: per-step performance parameters + track grid.  
Phase 3: mixer + FX.  
Phase 4: automation + song arrangement.  
Phase 5: MIDI + stems.  
Phase 6: secure Supabase Edge Function Sonilo backend + creation UI.  
Phase 7: mobile/desktop visual polish with 12ui and full QA.

Each phase must leave the app usable and backward compatible.
