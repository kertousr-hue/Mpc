# Groovebox V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver MPC Studio Groovebox V2 incrementally without breaking the existing sampler, DJ, cloud or PWA workflows.

**Architecture:** The implementation is split into three independently reviewable plans. They are executed in order because the mixer and export layers depend on the V7 sequencer model, while Sonilo and MIDI depend on the stable creation/export surfaces.

**Tech Stack:** Vanilla JavaScript, Web Audio API, OfflineAudioContext, Web MIDI, Supabase, Supabase Edge Functions, Sonilo API, PWA, Node 22 tests, 12ui design tooling.

**Spec:** `docs/superpowers/specs/2026-09-26-groovebox-v2-design.md`

## Global Constraints

- Preserve backward compatibility with V6 projects.
- Keep existing 64 pads, sampling, oriental kit, DJ modules, Supabase project workflows and PWA.
- Never expose `SONILO_API_KEY` to browser code or source control.
- Use authenticated Supabase Edge Functions for Sonilo.
- Do not deploy Sonilo functions to an unrelated Supabase project.
- Validate each phase before continuing to the next.

## Review Focus

- Existing saved V6 projects must remain usable.
- Audio scheduling must remain stable on mobile under UI load.
- Mixer/FX changes must not silently alter export semantics.
- Sonilo failures must never overwrite a pad or leak credentials.
- PWA updates must not strand clients on stale script versions.

---

### Task 1: Execute Core Sequencer Plan

**Plan:** `docs/superpowers/plans/2026-09-26-groovebox-v2-core-sequencer.md`

- [ ] Implement and verify all tasks in the core sequencer plan.
- [ ] Review compatibility before moving on.

### Task 2: Execute Mixer / FX / Automation Plan

**Plan:** `docs/superpowers/plans/2026-09-26-groovebox-v2-mixer-fx-automation.md`

- [ ] Implement and verify all tasks in the mixer/FX plan.
- [ ] Review live/offline audio parity before moving on.

### Task 3: Execute MIDI / Export / Sonilo Plan

**Plan:** `docs/superpowers/plans/2026-09-26-groovebox-v2-midi-export-sonilo.md`

- [ ] Implement MIDI, performance, stems and secure Sonilo integration.
- [ ] Deploy Sonilo Edge Functions only after confirming the MPC Studio Supabase project.
- [ ] Perform final desktop/mobile/PWA QA.
