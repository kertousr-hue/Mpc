# Audit 5 — Sonilo & Cloud Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Lier chaque tâche Sonilo à son utilisateur, ne pas consommer le quota sur un échec upstream et transformer la sauvegarde Cloud en mise à jour du projet courant au lieu de créer des doublons.

**Architecture:** Supabase ajoute \`sonilo_tasks\` avec RLS propriétaire et enrichit \`sonilo_generation_log\` pour libérer une réservation échouée. Les Edge Functions utilisent le JWT appelant pour réserver, enregistrer et vérifier les tâches. Le client garde un \`activeCloudProjectId\` explicite pour choisir INSERT ou UPDATE.

**Tech Stack:** Supabase Postgres/RLS/RPC, Deno Edge Functions, supabase-js, Node 22 static/unit tests.

**Spec:** \`docs/superpowers/specs/2026-09-26-audit5-hardening-design.md\`

## Global Constraints

- Les fonctions Supabase/Sonilo restent derrière authentification JWT et RLS.
- Les limites restent 10 générations / heure / utilisateur et 50 générations / 24 h / utilisateur.
- Les migrations Supabase doivent être idempotentes et conserver les tables existantes.
- Aucune clé secrète Sonilo ne doit être commise.
- Les projets V6/V7 existants restent lisibles.

## Review Focus

- Un \`taskId\` valide appartenant à un autre utilisateur doit se comporter comme introuvable.
- Une erreur réseau ou 5xx Sonilo après réservation doit rendre la place de quota.
- Une réponse Sonilo sans \`task_id\` doit libérer la réservation.
- Charger un projet Cloud puis le sauvegarder deux fois doit modifier une seule ligne.
- Importer un projet local après avoir chargé un projet Cloud doit remettre l’ID Cloud actif à null pour ne pas écraser le mauvais projet.

---

### Task 1: Schéma ownership Sonilo et réservations annulables

**Files:**
- Modify: \`supabase-schema.sql\`
- Modify: \`tests/sonilo-edge-static.test.js\`

**Interfaces:**
- Produces table \`public.sonilo_tasks(task_id text primary key, user_id uuid, kind text, created_at timestamptz)\`.
- Produces RPC \`reserve_sonilo_generation(p_kind text) -> jsonb\` incluant \`reservationId\`.
- Produces RLS DELETE own row on \`sonilo_generation_log\`.

- [ ] **Step 1: Write the failing schema assertions**
  - Assert \`create table if not exists public.sonilo_tasks\`.
  - Assert RLS on \`sonilo_tasks\`.
  - Assert SELECT/INSERT owner-only policies.
  - Assert \`reserve_sonilo_generation\` returns \`reservationId\`.
  - Assert DELETE-own policy on \`sonilo_generation_log\`.

- [ ] **Step 2: Run the test**
  - Run: \`node --test tests/sonilo-edge-static.test.js\`
  - Expected: FAIL.

- [ ] **Step 3: Implement the idempotent schema changes**
  - Add table + index \`sonilo_tasks_user_created_idx\`.
  - Add grants and policies with drop/create where required.
  - Return the inserted generation-log ID as \`reservationId\`.
  - Grant DELETE on own quota rows only.

- [ ] **Step 4: Run the test**
  - Expected: PASS.

- [ ] **Step 5: Apply migration**
  - Project: \`ehoxpawqsggqmdrywini\`.
  - Migration name: \`audit5_sonilo_task_ownership\`.

- [ ] **Step 6: Commit**
  - \`git add supabase-schema.sql tests/sonilo-edge-static.test.js && git commit -m "security: bind Sonilo tasks to users"\`

### Task 2: Génération Sonilo avec rollback de quota

**Files:**
- Modify: \`supabase/functions/sonilo-generate/index.ts\`
- Modify: \`tests/sonilo-edge-static.test.js\`

**Interfaces:**
- Consumes RPC result \`{allowed,reservationId,retryAfter?}\`.
- Produces helper interne \`releaseReservation(req,reservationId)\`.
- Produces helper interne \`recordTask(req,taskId,kind)\`.

- [ ] **Step 1: Write the failing static tests**
  - Assert handling of \`reservationId\`.
  - Assert cleanup path exists for network error, upstream non-ok, invalid JSON and missing task ID.
  - Assert successful generation records the task in \`sonilo_tasks\`.

- [ ] **Step 2: Run the test**
  - Run: \`node --test tests/sonilo-edge-static.test.js\`
  - Expected: FAIL.

- [ ] **Step 3: Implement \`releaseReservation\`**
  - Use caller Authorization + project publishable key.
  - DELETE only the specific reservation ID; RLS enforces ownership.

- [ ] **Step 4: Implement \`recordTask\`**
  - Record \`task_id\` and \`kind\` in the authenticated DB context.
  - Determine \`user_id\` from \`auth.uid()\` server-side, never from untrusted request JSON.

- [ ] **Step 5: Add cleanup to all pre-task failure exits**
  - upstream unreachable;
  - non-success upstream status;
  - invalid JSON;
  - missing task ID;
  - ownership-record failure.

- [ ] **Step 6: Run the test**
  - Expected: PASS.

- [ ] **Step 7: Redeploy \`sonilo-generate\`**
  - Project: \`ehoxpawqsggqmdrywini\`.
  - \`verify_jwt:true\`.
  - Confirm ACTIVE and version increment.

- [ ] **Step 8: Commit**
  - \`git add supabase/functions/sonilo-generate/index.ts tests/sonilo-edge-static.test.js && git commit -m "fix: rollback failed Sonilo reservations"\`

### Task 3: Vérifier ownership avant polling

**Files:**
- Modify: \`supabase/functions/sonilo-task/index.ts\`
- Modify: \`tests/sonilo-edge-static.test.js\`

**Interfaces:**
- Produces helper interne \`ownsTask(req,taskId) -> Promise<boolean>\`.

- [ ] **Step 1: Write the failing static tests**
  - Assert \`sonilo_tasks\` is queried before the upstream \`/tasks/\` call.
  - Assert unknown/foreign task returns HTTP 404 with \`task_not_found\`.

- [ ] **Step 2: Run the test**
  - Expected: FAIL.

- [ ] **Step 3: Implement \`ownsTask\`**
  - Query Supabase REST using caller JWT.
  - RLS naturally hides another user’s row.
  - Zero visible rows => 404 before Sonilo upstream.

- [ ] **Step 4: Run the test**
  - Expected: PASS.

- [ ] **Step 5: Redeploy \`sonilo-task\`**
  - Project: \`ehoxpawqsggqmdrywini\`.
  - \`verify_jwt:true\`.

- [ ] **Step 6: Commit**
  - \`git add supabase/functions/sonilo-task/index.ts tests/sonilo-edge-static.test.js && git commit -m "security: enforce Sonilo task ownership"\`

### Task 4: Sauvegarde Cloud INSERT puis UPDATE

**Files:**
- Create: \`cloud-project-core.js\`
- Create: \`tests/cloud-project-core.test.js\`
- Modify: \`index.html\`
- Modify: \`sw.js\`
- Modify: \`app.js\`

**Interfaces:**
- Produces \`createCloudProjectState() -> {activeProjectId:null}\`.
- Produces \`saveOperation(activeProjectId) -> 'insert'|'update'\`.
- Produces \`setLoadedProject(state,id)\`.
- Produces \`resetActiveProject(state)\`.

- [ ] **Step 1: Write the failing unit tests**
  - Initial state -> insert.
  - Loaded project ID -> update.
  - Reset -> insert.
  - Empty/invalid ID never yields update.

- [ ] **Step 2: Run the test**
  - Run: \`node --test tests/cloud-project-core.test.js\`
  - Expected: FAIL module absent.

- [ ] **Step 3: Implement the pure module**
  - No DOM or Supabase calls in this file.

- [ ] **Step 4: Integrate script and PWA shell**
  - Load before \`app.js\`.
  - Add to \`sw.js::SHELL\`.

- [ ] **Step 5: Modify \`app.js::cloudSave()\`**
  - If no active ID: INSERT once, remember returned ID.
  - Else UPDATE \`music_projects\` filtered by both ID and current user ID.
  - Keep sample paths under current \`projectId\`; use \`upsert:true\`.
  - Final \`project_data\` update targets the same row.

- [ ] **Step 6: Manage active ID lifecycle**
  - Cloud load -> set loaded ID.
  - Import/local new project -> reset.
  - Logout -> reset.
  - Any explicit “new project” path -> reset.

- [ ] **Step 7: Run full Node suite**
  - Run: \`npm test\`
  - Expected: PASS.

- [ ] **Step 8: Commit**
  - \`git add cloud-project-core.js tests/cloud-project-core.test.js index.html sw.js app.js && git commit -m "fix: update existing cloud projects"\`

### Task 5: Audit Supabase final du bloc

**Files:** none unless a lint requires a corrective migration.

- [ ] **Step 1: Verify tables**
  - \`music_projects\`, \`sonilo_generation_log\`, \`sonilo_tasks\` all have RLS enabled.

- [ ] **Step 2: Run security advisor**
  - Expected: \`lints: []\`.

- [ ] **Step 3: Run performance advisor**
  - No new WARN/ERROR. INFO unused-index notices are acceptable immediately after creation.

- [ ] **Step 4: Verify functions**
  - \`sonilo-generate\`: ACTIVE + JWT.
  - \`sonilo-task\`: ACTIVE + JWT.
