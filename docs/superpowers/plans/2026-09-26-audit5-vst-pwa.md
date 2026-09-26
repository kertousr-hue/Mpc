# Audit 5 — VST Bridge HTTPS & PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Permettre l’usage VST3 sur le LAN sans forcer MPC Studio à quitter un contexte HTTPS sécurisé, tout en conservant un mode HTTP same-origin de secours.

**Architecture:** \`vst_bridge.py\` peut envelopper son serveur dans TLS si un certificat et une clé sont fournis. Le mode recommandé sert l’app et l’API VST depuis la même origine HTTPS LAN. \`vst-bridge.js\` accepte HTTP/HTTPS uniquement sur hôtes privés et conserve le blocage HTTPS-page → HTTP-bridge.

**Tech Stack:** Python 3 \`http.server\` + \`ssl\`, Vanilla JS URL policy, Node 22 tests, Python unittest.

**Spec:** \`docs/superpowers/specs/2026-09-26-audit5-hardening-design.md\`

## Global Constraints

- Le bridge ne génère pas de certificat lui-même.
- Le token long de session, la limitation de tentatives et la non-exposition des chemins Windows restent inchangés.
- Le mode recommandé consiste à ouvrir MPC Studio depuis l’URL HTTPS LAN du Bridge.
- Un bridge HTTP privé reste refusé depuis une page HTTPS.
- Aucun VST n’est installé ou exécuté par la PWA elle-même.

## Review Focus

- Certificat présent sans clé, ou clé sans certificat : le serveur doit refuser de démarrer avec une erreur claire.
- Une URL HTTPS publique ne doit jamais être acceptée comme bridge même si le certificat est valide.
- Une page Vercel HTTPS vers bridge HTTP privé doit rester bloquée.
- Une requête OPTIONS cross-origin depuis une origine non autorisée ne doit pas recevoir CORS permissif.
- Le mode HTTP local existant doit continuer à fonctionner sur localhost/LAN quand la page est elle-même en HTTP.

---

### Task 1: Politique URL HTTPS privée côté navigateur

**Files:**
- Modify: \`vst-bridge.js\`
- Modify: \`tests/vst-bridge.test.js\`

**Interfaces:**
- \`normalizeBridgeUrl(value:string) -> origin string\` accepte \`http:\` ou \`https:\` uniquement si host privé.
- \`bridgeRequestPolicy(pageUrl,targetUrl) -> {allowed:boolean,reason:string}\`.

- [ ] **Step 1: Write the failing tests**
  - HTTPS private accepted: \`https://192.168.1.10:8766\`.
  - HTTPS localhost accepted.
  - HTTPS public rejected.
  - HTTPS page -> HTTP private = \`mixed_content\`.
  - HTTPS page -> HTTPS private = allowed.
  - HTTP local -> HTTP local = allowed.

- [ ] **Step 2: Run tests**
  - Run: \`node --test tests/vst-bridge.test.js\`
  - Expected: FAIL on private HTTPS.

- [ ] **Step 3: Modify URL policy**
  - Allow only \`http:\` and \`https:\`.
  - Require private/localhost host for both.
  - Preserve mixed-content rejection.

- [ ] **Step 4: Update UI copy**
  - Label: \`Adresse du pont (HTTPS recommandé)\`.
  - Mixed-content message directs the user to the HTTPS LAN URL served by the bridge.

- [ ] **Step 5: Run tests**
  - Expected: PASS.

- [ ] **Step 6: Commit**
  - \`git add vst-bridge.js tests/vst-bridge.test.js && git commit -m "fix: allow secure private VST bridge URLs"\`

### Task 2: TLS optionnel dans le bridge Python

**Files:**
- Modify: \`vst_bridge.py\`
- Create: \`tests/test_vst_bridge.py\`

**Interfaces:**
- Produces \`resolve_tls(certfile,keyfile) -> tuple[Path|None,Path|None]\`.
- Produces \`wrap_server_tls(server,certfile,keyfile) -> None\`.

- [ ] **Step 1: Write the failing Python tests**
  - no files -> HTTP mode;
  - cert without key -> ValueError;
  - key without cert -> ValueError;
  - nonexistent path -> ValueError;
  - CLI values override environment values.

- [ ] **Step 2: Run tests**
  - Run: \`python -m unittest tests.test_vst_bridge -v\`
  - Expected: FAIL helpers absent.

- [ ] **Step 3: Implement TLS helpers**
  - Use \`ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)\`.
  - Load certificate chain.
  - Wrap \`server.socket\` server-side.

- [ ] **Step 4: Add CLI/env**
  - \`--certfile\`, \`--keyfile\`.
  - Defaults: \`MPC_VST_CERT\`, \`MPC_VST_KEY\`.
  - Print HTTPS URLs when TLS active, HTTP otherwise.

- [ ] **Step 5: Verify**
  - Run: \`python -m unittest tests.test_vst_bridge -v\`
  - Expected: PASS.
  - Run: \`python -m py_compile vst_bridge.py\`
  - Expected: exit 0.

- [ ] **Step 6: Commit**
  - \`git add vst_bridge.py tests/test_vst_bridge.py && git commit -m "feat: add HTTPS mode to VST bridge"\`

### Task 3: CORS/PNA allowlist pour le mode cross-origin optionnel

**Files:**
- Modify: \`vst_bridge.py\`
- Modify: \`tests/test_vst_bridge.py\`

**Interfaces:**
- Server field \`allowed_origins:set[str]\`.
- Produces \`origin_headers(origin,private_network_requested) -> dict[str,str]\`.

- [ ] **Step 1: Write failing tests**
  - Same-origin/no Origin -> no CORS headers needed.
  - Allowed origin -> exact \`Access-Control-Allow-Origin\`.
  - Disallowed origin -> no ACAO.
  - Allowed origin + PNA preflight -> \`Access-Control-Allow-Private-Network:true\`.

- [ ] **Step 2: Run tests**
  - Expected: FAIL.

- [ ] **Step 3: Implement origin allowlist**
  - CLI repeatable \`--allow-origin\`.
  - Env \`MPC_VST_ALLOWED_ORIGINS\`, comma-separated.
  - Reject wildcard \`*\`.

- [ ] **Step 4: Apply to OPTIONS and API responses**
  - GET/POST still require the token.
  - Preflight does not authenticate but grants browser headers only to approved origins.

- [ ] **Step 5: Run tests**
  - Expected: PASS.

- [ ] **Step 6: Commit**
  - \`git add vst_bridge.py tests/test_vst_bridge.py && git commit -m "security: restrict VST bridge browser origins"\`

### Task 4: Documentation Windows/LAN et PWA

**Files:**
- Modify: \`VST_PC.md\`
- Modify: \`start_vst_bridge.bat\` only if environment forwarding requires it.

**Interfaces:** none.

- [ ] **Step 1: Document recommended HTTPS LAN mode**
  - Trust certificate on PC and phone.
  - Configure \`MPC_VST_CERT\` and \`MPC_VST_KEY\`.
  - Open the HTTPS LAN URL printed by the bridge.
  - Explain preservation of Secure Context features.

- [ ] **Step 2: Document HTTP fallback**
  - Same-origin local only.
  - Vercel HTTPS -> bridge HTTP remains blocked.

- [ ] **Step 3: Document optional cross-origin mode**
  - Configure \`MPC_VST_ALLOWED_ORIGINS\`.
  - Note browser may request local-network permission.

- [ ] **Step 4: Verify documentation**
  - No 6-digit PIN wording.
  - No advice to disable browser security.

- [ ] **Step 5: Commit**
  - \`git add VST_PC.md start_vst_bridge.bat && git commit -m "docs: explain secure VST LAN mode"\`
