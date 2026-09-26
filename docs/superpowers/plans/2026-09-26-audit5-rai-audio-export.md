# Audit 5 — Raï Audio & Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Rendre les 64 pads A/B/C/D réellement jouables en raï et garantir que la lecture live, l’export Pattern et l’export Song produisent le même comportement musical.

**Architecture:** \`rai-factory.js\` reste la source de vérité pour les 128 slots et gagne des banques/kits explicites. \`app.js\` initialise les 64 pads depuis ces banques et réutilise un cache de bruit déterministe. \`export-v2.js\` reçoit des helpers purs de timeline afin de tester la restauration des locks et l’arrangement Song sans dépendre de WebAudio.

**Tech Stack:** Vanilla JavaScript, Web Audio API, Node 22 \`node:test\`, Playwright Chromium.

**Spec:** \`docs/superpowers/specs/2026-09-26-audit5-hardening-design.md\`

## Global Constraints

- Les 128 slots Factory restent inchangés en nombre et en index.
- Les projets V6/V7 existants restent lisibles.
- Les anciens projets sauvegardés continuent à utiliser leurs \`factoryIndex\`.
- Aucun index existant n’est déplacé.
- Les limites Sonilo restent 10/h et 50/24 h ; ce plan ne les modifie pas.
- Vercel reste l’unique déploiement production.

## Review Focus

- Une banque dont un pad a été vidé manuellement doit redevenir audible au moment de Beat Auto sans écraser les autres pads non ciblés.
- Un projet ancien avec un \`factoryIndex\` valide doit retrouver exactement le même slot après la migration des banques/kits.
- Un lock FILTER/PAN/GAIN/SEND au dernier ratchet d’un step ne doit pas fuir dans le step suivant.
- Un arrangement contenant des patterns vides ou des répétitions doit produire une timeline continue sans silence ajouté par erreur.
- Plusieurs hits bruités successifs dans le même AudioContext doivent réutiliser le même AudioBuffer sans muter son contenu.

---

### Task 1: Modèle explicite des banques et kits raï

**Files:**
- Modify: \`rai-factory.js\`
- Modify: \`tests/rai-factory.test.js\`
- Modify: \`tests/rai-integration.test.js\`

**Interfaces:**
- Consumes: \`buildFactory() -> FactorySound[]\`, les 128 \`factoryIndex\` actuels.
- Produces: \`RAI_BANKS: Record<'A'|'B'|'C'|'D', number[16]>\`, \`RAI_KITS: {name, description, indices:number[16]}[]\`, \`bankIndices(bank:string) -> number[16]\`.

- [ ] **Step 1: Write the failing tests**
  - Assert \`Object.keys(RAI_BANKS)\` = A/B/C/D.
  - Assert chaque banque contient exactement 16 entiers entre 0 et 127.
  - Assert la banque A couvre Kick, Darbuka, Guellal, Bendir, Bass, Gasba, Accordéon et au moins un lead/vox.
  - Assert chaque kit expose \`indices.length === 16\`.

- [ ] **Step 2: Run tests to verify failure**
  - Run: \`node --test tests/rai-factory.test.js tests/rai-integration.test.js\`
  - Expected: FAIL car \`RAI_BANKS\` / \`indices\` n’existent pas.

- [ ] **Step 3: Implement explicit banks and kits**
  - Ajouter \`RAI_BANKS\` et \`bankIndices(bank)\`.
  - Remplacer les \`offset\` de \`RAI_KITS\` par des \`indices\` explicites.
  - Conserver les 128 objets de \`buildFactory()\` dans le même ordre.

- [ ] **Step 4: Run tests**
  - Run: \`node --test tests/rai-factory.test.js tests/rai-integration.test.js\`
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - \`git add rai-factory.js tests/rai-factory.test.js tests/rai-integration.test.js && git commit -m "fix: define explicit rai banks and kits"\`

### Task 2: Initialiser 64 pads audibles et rendre Beat Auto auto-réparant

**Files:**
- Modify: \`app.js\`
- Modify: \`sequencer-v2.js\`
- Modify: \`tests/rai-integration.test.js\`

**Interfaces:**
- Consumes: \`RAI_FACTORY.bankIndices(bank)\`, \`RAI_FACTORY.createRaiBeat()\`.
- Produces: \`ensureRaiBeatPads(bankName:string, beat:Record<number,number[]>) -> void\`, \`loadFactoryKit(indices:number[]) -> void\`.

- [ ] **Step 1: Write the failing integration assertions**
  - Assert l’initialisation utilise \`bankIndices(b)\` pour A/B/C/D.
  - Assert \`loadFactoryKit\` reçoit \`kit.indices\`, pas \`kit.offset\`.
  - Assert Beat Auto appelle \`ensureRaiBeatPads\` avant d’activer les steps.

- [ ] **Step 2: Run the test**
  - Run: \`node --test tests/rai-integration.test.js\`
  - Expected: FAIL.

- [ ] **Step 3: Implement pad initialization**
  - Pour chaque banque A/B/C/D, assigner les 16 Factory indices prévus.
  - Dériver le nom du pad du son réellement assigné.

- [ ] **Step 4: Implement \`loadFactoryKit(indices)\`**
  - Exiger 16 indices valides.
  - Assignation Factory + nom + reset buffer/userBlob/cloudPath/externalMeta.

- [ ] **Step 5: Implement \`ensureRaiBeatPads\`**
  - Recharger uniquement les slots du beat qui sont réellement vides.
  - Ne jamais écraser un sample utilisateur ni un Factory existant.

- [ ] **Step 6: Use the helper in both Beat Auto paths**
  - \`app.js::randomBeat()\`.
  - \`sequencer-v2.js\` action \`autoBeatBtn\`.

- [ ] **Step 7: Run full Node suite**
  - Run: \`npm test\`
  - Expected: PASS.

- [ ] **Step 8: Commit**
  - \`git add app.js sequencer-v2.js tests/rai-integration.test.js && git commit -m "fix: make all rai banks audible"\`

### Task 3: Cache de bruit déterministe par AudioContext

**Files:**
- Modify: \`app.js\`
- Create: \`tests/audio-noise-browser.spec.js\`

**Interfaces:**
- Produces: \`getNoiseBuffer(ac:BaseAudioContext) -> AudioBuffer\`.

- [ ] **Step 1: Write the failing browser test**
  - Instrumenter \`createBuffer\`.
  - Jouer plusieurs Clap/Shaker dans le même contexte.
  - Assert le buffer de bruit principal n’est créé qu’une fois par contexte.
  - Créer un OfflineAudioContext distinct et vérifier qu’il reçoit son propre buffer.

- [ ] **Step 2: Run the test**
  - Run: \`npx playwright test tests/audio-noise-browser.spec.js --project=chromium-desktop\`
  - Expected: FAIL car le bruit est réalloué.

- [ ] **Step 3: Implement the WeakMap cache**
  - 2 secondes mono par contexte.
  - PRNG déterministe local à seed fixe ; ne plus utiliser \`Math.random()\` pour ce buffer.

- [ ] **Step 4: Update \`noiseHit\`**
  - Réutiliser \`getNoiseBuffer(ac)\`.
  - Garder filtres/enveloppes/durée.

- [ ] **Step 5: Run the browser test**
  - Expected: PASS.

- [ ] **Step 6: Commit**
  - \`git add app.js tests/audio-noise-browser.spec.js && git commit -m "perf: cache deterministic factory noise"\`

### Task 4: Timeline de locks/automation pour export offline

**Files:**
- Modify: \`export-v2.js\`
- Modify: \`tests/export-v2.test.js\`

**Interfaces:**
- Produces: \`stepBaseParams(pattern,padId,stepIndex,mixerState) -> {gain,pan,cutoff,sendA,sendB}\`.
- Produces: \`parameterTimeline(pattern,bpm,padId,mixerState,swingAmount) -> ParamEvent[]\`.

- [ ] **Step 1: Write the failing restoration test**
  - Step 0 : lock \`cutoff:.1\`.
  - Step 1 : actif sans lock.
  - Assert la timeline restaure le cutoff de base/automation au début du step 1.
  - Couvrir aussi gain, pan, sendA, sendB.

- [ ] **Step 2: Run the test**
  - Run: \`node --test tests/export-v2.test.js\`
  - Expected: FAIL.

- [ ] **Step 3: Implement the pure helpers**
  - Lire les lanes via \`automation-core.sampleLane\`.
  - Revenir au mixer si aucune lane n’existe.
  - Garder le pitch dans \`eventSchedule\`.

- [ ] **Step 4: Apply the timeline in \`renderTracks\`**
  - Programmer la base à chaque step.
  - Programmer les locks au temps de l’événement.
  - Ne laisser aucun lock survivre au step suivant.

- [ ] **Step 5: Run the test**
  - Expected: PASS.

- [ ] **Step 6: Commit**
  - \`git add export-v2.js tests/export-v2.test.js && git commit -m "fix: restore export parameter locks per step"\`

### Task 5: Export Song master et stems

**Files:**
- Modify: \`export-v2.js\`
- Modify: \`tests/export-v2.test.js\`
- Modify: \`styles.css\` only if spacing is required.

**Interfaces:**
- Produces: \`defaultSongArrangement(patterns) -> {patternIndex,repeats}[]\`.
- Produces: \`buildSongTimeline(session,bpm,arrangement?) -> {segments,totalDuration}\`.
- Produces: \`renderSongMaster(options?) -> Promise<AudioBuffer>\`.
- Produces: \`renderSongStem(padId,options?) -> Promise<AudioBuffer>\`.

- [ ] **Step 1: Write the failing timeline tests**
  - P0 actif 1 bar, P1 vide, P2 actif 2 bars.
  - Sans arrangement : ordre [P0,P2].
  - Arrangement explicite avec répétitions : offsets et durée totale exacts.

- [ ] **Step 2: Run the tests**
  - Run: \`node --test tests/export-v2.test.js\`
  - Expected: FAIL.

- [ ] **Step 3: Implement song timeline helpers**
  - Chaque segment : \`patternIndex\`, \`offsetSeconds\`, \`durationSeconds\`.
  - Respecter bars, swing et automation.

- [ ] **Step 4: Generalize offline rendering**
  - Construire un seul OfflineAudioContext pour toute la Song.
  - Réutiliser \`eventSchedule\` + \`parameterTimeline\` avec offsets.

- [ ] **Step 5: Add explicit UI actions**
  - \`MASTER SONG\`.
  - \`STEMS SONG\`.
  - Conserver les exports Pattern existants.

- [ ] **Step 6: Run full suite**
  - Run: \`npm test\`
  - Expected: PASS.

- [ ] **Step 7: Commit**
  - \`git add export-v2.js tests/export-v2.test.js styles.css && git commit -m "feat: export complete song master and stems"\`
