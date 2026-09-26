# Audit 5 — CI, Browser Smoke & Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Faire de Vercel l’unique canal de production, supprimer le pipeline GitHub Pages cassé et ajouter des tests navigateur desktop/mobile qui couvrent les régressions que \`node:test\` ne voit pas.

**Architecture:** La CI conserve les tests Node/Python actuels puis lance Playwright Chromium contre un serveur statique local. GitHub Pages est supprimé. Le service worker est versionné une dernière fois après intégration de tous les nouveaux modules.

**Tech Stack:** GitHub Actions, Node 22, Playwright Chromium, Python 3, Vercel Git integration.

**Spec:** \`docs/superpowers/specs/2026-09-26-audit5-hardening-design.md\`

## Global Constraints

- Vercel reste l’unique déploiement production.
- Supprimer \`.github/workflows/pages.yml\`.
- Le test navigateur ne déclenche aucune génération Sonilo payante et n’exécute aucun VST.
- Tous les nouveaux modules nécessaires au démarrage offline restent dans \`SHELL\`.
- La correction n’est prête à fusionner que si Node, Playwright desktop/mobile, Supabase sécurité et Vercel Preview sont verts.

## Review Focus

- Le smoke test ne doit pas dépendre du CDN Supabase ou d’un réseau externe pour réussir.
- Le viewport mobile doit tester un vrai chemin d’interaction, pas seulement un screenshot.
- Les dialogues Sonilo/VST peuvent s’ouvrir sans appeler leurs backends.
- Une PWA déjà installée doit obtenir le nouveau cache après activation du service worker.
- La CI doit échouer si un module requis par \`index.html\` manque du shell offline.

---

### Task 1: Ajouter Playwright sans dépendance réseau applicative

**Files:**
- Modify: \`package.json\`
- Create: \`playwright.config.js\`
- Create: \`tests/browser-smoke.spec.js\`

**Interfaces:**
- Script \`test:browser\` -> \`playwright test\`.
- Playwright webServer -> \`python -m http.server 4173\`.
- Projects: \`chromium-desktop\`, \`chromium-mobile\`.

- [ ] **Step 1: Add dependencies and scripts**
  - Add \`@playwright/test\` as devDependency.
  - Add \`test:unit\` and \`test:browser\`.
  - Keep \`npm test\` running the Node test suite.

- [ ] **Step 2: Create Playwright config**
  - baseURL: \`http://127.0.0.1:4173\`.
  - desktop viewport: 1440x900.
  - mobile viewport: 412x915, touch enabled.
  - Avoid parallel shared-storage interference.

- [ ] **Step 3: Write browser smoke tests**
  - Capture \`pageerror\`; assert none.
  - Stub/block external Supabase CDN if necessary so local startup is deterministic.
  - Assert 16 visible pads in A.
  - Switch B/C/D; assert 16 pads with non-empty names.
  - Run Beat Auto on each bank; assert at least one active step.
  - Open Grid, Mixer, FX, MIDI views.
  - Open/close Sonilo and VST dialogs without triggering generation or VST processing.
  - On mobile, assert Play, banks and mode controls are clickable.

- [ ] **Step 4: Run browser tests**
  - Run: \`npx playwright test tests/browser-smoke.spec.js\`.
  - Expected: PASS after owning-plan fixes are integrated.

- [ ] **Step 5: Commit**
  - \`git add package.json package-lock.json playwright.config.js tests/browser-smoke.spec.js && git commit -m "test: add desktop and mobile browser smoke"\`

### Task 2: Vérifier l’intégrité du shell PWA

**Files:**
- Create: \`tests/pwa-shell.test.js\`
- Modify: \`sw.js\`

**Interfaces:**
- Test extracts local startup \`script src\` and stylesheet paths from \`index.html\` and compares them against \`SHELL\`.

- [ ] **Step 1: Write the failing test**
  - Every local startup script/style must be in \`SHELL\`.
  - External Supabase CDN is ignored.
  - Assert \`cloud-project-core.js\` and all new Audit 5 startup modules are cached.

- [ ] **Step 2: Run the test**
  - Run: \`node --test tests/pwa-shell.test.js\`
  - Expected: FAIL until shell is updated.

- [ ] **Step 3: Update \`sw.js\`**
  - Cache key: \`mpc-studio-v30-audit5\`.
  - Add all required local modules.
  - Preserve Sonilo traffic bypass.

- [ ] **Step 4: Run the test**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - \`git add sw.js tests/pwa-shell.test.js && git commit -m "pwa: version Audit 5 offline shell"\`

### Task 3: Supprimer GitHub Pages

**Files:**
- Delete: \`.github/workflows/pages.yml\`
- Modify: \`README.md\` only if it presents Pages as active deployment.

**Interfaces:** none.

- [ ] **Step 1: Delete the workflow**
  - No replacement GitHub Pages workflow.

- [ ] **Step 2: Search for stale Pages references**
  - Run: \`grep -R -n "GitHub Pages\\|pages.yml" README.md docs .github || true\`.
  - Update only statements that claim Pages is an active deployment target.

- [ ] **Step 3: Commit**
  - \`git add -A .github/workflows/pages.yml README.md docs && git commit -m "ci: use Vercel as sole production deploy"\`

### Task 4: Étendre la CI GitHub Actions

**Files:**
- Modify: \`.github/workflows/check.yml\`

**Interfaces:** job \`check\` remains the primary merge gate.

- [ ] **Step 1: Ensure working-branch coverage**
  - Keep \`main\`.
  - Include \`fix/audit5-hardening\` during implementation.
  - Keep \`pull_request\`.

- [ ] **Step 2: Install project dependencies**
  - Add \`npm ci\`.
  - Add \`npx playwright install --with-deps chromium\`.

- [ ] **Step 3: Run Python unit tests**
  - Add \`python -m unittest tests.test_vst_bridge -v\`.
  - Keep all current \`py_compile\` checks.

- [ ] **Step 4: Run browser tests**
  - Add \`npm run test:browser\`.
  - Preserve Node suite, manifest validation and secret scan.

- [ ] **Step 5: Verify on branch push**
  - Expected: JS syntax, Node tests, Python tests, manifest, secret scan, Playwright desktop/mobile all green.

- [ ] **Step 6: Commit**
  - \`git add .github/workflows/check.yml && git commit -m "ci: run Audit 5 browser and bridge tests"\`

### Task 5: Vérification globale et PR

**Files:** none unless verification finds a defect.

- [ ] **Step 1: Run Node suite**
  - Run: \`npm test\`.
  - Expected: 0 failures.

- [ ] **Step 2: Run browser suite**
  - Run: \`npm run test:browser\`.
  - Expected: desktop + mobile PASS.

- [ ] **Step 3: Run Python suite**
  - Run: \`python -m unittest tests.test_vst_bridge -v && python -m py_compile vst_bridge.py virtualdj_bridge.py virtualdj_bridge_v2.py\`.
  - Expected: exit 0.

- [ ] **Step 4: Verify Supabase**
  - Security advisor: 0 lint.
  - \`sonilo-generate\` and \`sonilo-task\`: ACTIVE + \`verify_jwt:true\`.

- [ ] **Step 5: Open PR \`fix/audit5-hardening -> main\`**
  - Include checklist for all four Audit 5 plans and fresh test results.
  - Wait for green \`pull_request\` CI.

- [ ] **Step 6: Merge only after user validation**
  - Squash recommended.
  - Verify \`main\` CI and Vercel status after merge.

- [ ] **Step 7: Production check**
  - Vercel status must be \`success\`.
  - \`main\` commit must match the deployed commit.
