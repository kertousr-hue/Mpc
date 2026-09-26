# Audit 5 Hardening — Design

Date: 2026-09-26  
Branch: `fix/audit5-hardening`  
Base: `main` @ `17ec7b21aab08888f252b2ab160440b833773a91`

## Goal

Corriger les défauts détectés par l’Audit 5 sans casser les projets MPC existants ni les 128 `factoryIndex` déjà publiés. La production reste hébergée sur Vercel. Les fonctions Supabase/Sonilo restent derrière authentification JWT et RLS.

## Scope

Cette correction couvre cinq zones liées :

1. cohérence des kits/banques raï et de Beat Auto ;
2. parité audio entre lecture live et export WAV/stems/song ;
3. sécurité et cycle de vie Sonilo/Supabase ;
4. compatibilité VST Bridge avec HTTPS/PWA ;
5. CI et déploiement, avec Vercel comme unique cible de production.

Les 128 slots Factory restent inchangés en nombre et en index. Les projets V6/V7 existants restent lisibles.

## 1. Kits et banques raï

### Problème

Les kits actuels utilisent un simple `offset` puis chargent 16 sons contigus. Cela ne correspond pas toujours au nom du kit. Les banques B/C/D affichent des noms mais peuvent être vides, et Beat Auto peut donc créer un pattern visuellement rempli mais silencieux.

### Design

`rai-factory.js` devient la source de vérité pour les kits et les banques.

Chaque kit utilise une liste explicite de 16 `factoryIndex` :

- **A — RAÏ LIVE** : kick, snare, shaker, darbuka, guellal, bendir, riq, clap, bass, gasba, accordéon, trompette, guitare, synth, vox, FX.
- **B — PERCUSSIONS RAÏ** : kick/snare/clap/shaker/riq/darbuka/guellal/bendir/tbal/tambourin/cymbal.
- **C — BASS & MÉLODIES** : basses raï, gasba, accordéon, trompette, guitare, synth lead, strings/stab.
- **D — LEADS & FX** : variantes mélodiques, basses synth, vox et FX.

Les objets `RAI_KITS` exposent `indices: number[16]` au lieu de `offset`. `loadFactoryKit` accepte une liste d’indices.

L’initialisation crée un vrai sample Factory pour les 64 pads A/B/C/D. Les noms des pads sont dérivés de leur sample réel.

`createRaiBeat()` reste une définition de groove par slots 0..15. Beat Auto vérifie que les pads de la banque sélectionnée ont un sample ; si une banque a été vidée manuellement, il recharge uniquement les slots nécessaires avec les instruments raï par défaut de cette banque avant d’écrire le pattern.

### Compatibilité

Les anciens projets sauvegardés continuent à utiliser leurs `factoryIndex`. Aucun index existant n’est déplacé.

## 2. Moteur audio et export

### Problèmes

- les Parameter Locks peuvent persister dans un export offline ;
- l’export master/stems couvre le pattern courant, pas l’arrangement complet ;
- les buffers de bruit sont recréés pour chaque hit ;
- la Factory peut varier entre live et export à cause du bruit aléatoire.

### Design

#### 2.1 Bruit déterministe et cache

`app.js` utilise un `WeakMap<AudioContext, AudioBuffer>` pour conserver un buffer de bruit blanc de 2 secondes par contexte. Le buffer est généré avec un PRNG déterministe, identique pour AudioContext et OfflineAudioContext.

`noiseHit` réutilise ce buffer. Les différences de timbre continuent à venir des filtres, enveloppes et paramètres de variante.

Objectifs :
- moins d’allocations sur Android ;
- rendu live/export reproductible ;
- pas de création d’AudioBuffer à chaque clap/shaker/cymbale.

#### 2.2 Parité automation/locks

L’export importe aussi `automation-core.js`.

Pour chaque piste et chaque step, l’OfflineAudioContext programme d’abord les valeurs de base/automation au début du step. Lorsqu’un événement contient des locks, il applique l’overlay au temps de l’événement puis programme un retour aux valeurs calculées du step suivant à `restoreTime`.

Les paramètres concernés sont : gain, pan, cutoff, sendA, sendB. Le pitch reste porté par l’événement, comme en live.

Un test de régression vérifie qu’un cutoff lock au step N n’affecte pas le step N+1.

#### 2.3 Export Song

Ajouter un rendu d’arrangement :

- si `songArrangement` existe : respecter `patternIndex` et `repeats` ;
- sinon : utiliser uniquement les patterns non vides, dans l’ordre ;
- chaque pattern conserve son nombre de mesures, swing et automation ;
- le rendu master Song concatène les événements dans un seul OfflineAudioContext ;
- les stems Song utilisent la même timeline et les mêmes règles mute/solo.

L’UI conserve l’export Pattern existant et ajoute des actions explicites **MASTER SONG** et **STEMS SONG**.

## 3. Supabase / Sonilo

### 3.1 Ownership des tâches

Ajouter `public.sonilo_tasks` :

- `task_id text primary key`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `kind text not null`
- `created_at timestamptz default now()`

RLS :
- SELECT/INSERT uniquement lorsque `auth.uid() = user_id` ;
- aucune lecture anonyme.

Après une génération Sonilo acceptée par l’upstream, `sonilo-generate` enregistre `task_id + user_id` avec le JWT de l’utilisateur.

`sonilo-task` vérifie l’existence du `task_id` pour l’utilisateur courant avant d’appeler Sonilo. Un task inconnu ou appartenant à un autre utilisateur renvoie `404 task_not_found`.

### 3.2 Quota sans pénaliser les échecs upstream

`reserve_sonilo_generation` continue à réserver atomiquement une place et renvoie aussi `reservationId`.

La table `sonilo_generation_log` autorise DELETE sur ses propres lignes. Si l’appel Sonilo échoue avant création du `task_id`, l’Edge Function supprime la réservation correspondante. Une génération acceptée conserve la ligne et compte dans le quota.

Les limites restent :
- 10 générations / heure / utilisateur ;
- 50 générations / 24 h / utilisateur.

### 3.3 Sauvegarde Cloud

Le client garde `activeCloudProjectId`.

- nouveau projet sans ID : INSERT une fois puis mémorise l’ID ;
- projet chargé du cloud : UPDATE de la même ligne ;
- `cloudSave` ne crée plus une ligne à chaque sauvegarde ;
- les samples restent stockés sous `user_id/project_id/pad.ext` avec `upsert:true`.

Lors d’un import local ou d’un nouveau projet, `activeCloudProjectId` est remis à `null`.

## 4. VST Bridge et contexte sécurisé

### Problème

Une page Vercel HTTPS ne peut pas appeler un bridge LAN HTTP. Servir toute l’app en HTTP depuis le bridge contourne le mixed content mais fait perdre des capacités Secure Context (Service Worker/PWA, certaines API média/MIDI).

### Design

Le bridge Python supporte deux transports :

1. **HTTP same-origin** : mode de secours actuel, lorsque l’utilisateur ouvre l’app directement depuis le PC Bridge ;
2. **HTTPS LAN** : nouveau mode recommandé, activé avec `--certfile` et `--keyfile` ou variables `MPC_VST_CERT` / `MPC_VST_KEY`.

En HTTPS :
- le bridge sert l’app et l’API VST sur la même origine HTTPS ;
- `vst-bridge.js` accepte `https://` sur localhost/IP privée ;
- depuis la version Vercel HTTPS, un bridge HTTPS privé est autorisé ;
- un bridge HTTP privé reste refusé depuis une page HTTPS.

Le bridge ne génère pas de certificat lui-même. La documentation explique qu’un certificat doit être approuvé sur les appareils qui l’utilisent. Le token long de session, la limitation de tentatives et la non-exposition des chemins Windows restent inchangés.

## 5. PWA, CI et déploiement

### Vercel

Vercel reste l’unique déploiement production.

Supprimer `.github/workflows/pages.yml` car :
- GitHub Pages n’est pas utilisé comme production ;
- le workflow échoue actuellement faute d’autorisation Pages ;
- maintenir deux pipelines statiques crée des états contradictoires.

Aucun changement de domaine Vercel n’est requis.

### PWA

Incrémenter la version de cache après les corrections. Tous les nouveaux modules nécessaires au démarrage offline restent dans `SHELL`.

### Tests navigateur

Ajouter un smoke test Playwright Chromium, exécuté après les tests Node :

- chargement sans exception JS ;
- Factory raï disponible ;
- banques A/B/C/D ont 16 pads sonores ;
- Beat Auto crée des steps sur chaque banque ;
- ouverture des vues Grid/Mixer/FX/MIDI ;
- ouverture des dialogues Sonilo et VST ;
- viewport mobile type Pixel : contrôles principaux accessibles et pas de crash.

Le test ne déclenche aucune génération Sonilo payante et n’exécute aucun VST.

## 6. Tests unitaires et migrations

Tests attendus avant fusion :

- 128 Factory slots stables ;
- quatre banques de 16 indices valides ;
- chaque kit contient exactement 16 indices valides ;
- Beat Auto ne cible pas une banque silencieuse ;
- buffer de bruit réutilisé dans un même contexte ;
- export : lock restauré au step suivant ;
- export Song : répétitions et patterns vides gérés correctement ;
- ownership Sonilo : task d’un autre utilisateur non lisible ;
- réservation Sonilo libérée sur échec upstream ;
- Cloud Save : INSERT initial puis UPDATE ;
- VST policy : HTTPS privé accepté, HTTPS→HTTP privé refusé ;
- PWA shell contient tous les modules requis ;
- Playwright smoke desktop + mobile.

Les migrations Supabase doivent être idempotentes et conserver les tables existantes.

## 7. Ordre d’implémentation

1. tests + modèle explicite kits/banques ;
2. initialisation des 64 pads + Beat Auto ;
3. cache de bruit déterministe ;
4. parité locks/automation export ;
5. export Song master/stems ;
6. migrations Sonilo ownership/quota ;
7. Edge Functions Sonilo + redéploiement ;
8. Cloud Save update/upsert ;
9. VST HTTPS optionnel + documentation ;
10. suppression GitHub Pages ;
11. Playwright smoke + CI ;
12. vérification complète, PR, puis déploiement Vercel après validation.

## Non-goals

Cette passe ne :
- remplace pas les synthèses Factory par une banque commerciale de samples ;
- n’installe aucun VST sur le PC de l’utilisateur ;
- ne génère pas automatiquement de certificat TLS ;
- ne modifie pas les limites Sonilo 10/h et 50/24 h ;
- ne change pas les 128 `factoryIndex` existants ;
- ne supprime pas les anciens projets locaux/cloud.

## Critères de sortie

La correction est prête à fusionner seulement si :

1. la suite Node est verte ;
2. les nouveaux tests Playwright desktop/mobile sont verts ;
3. l’audit sécurité Supabase renvoie 0 alerte ;
4. les Edge Functions Sonilo sont ACTIVE avec JWT ;
5. aucune clé secrète n’est commise ;
6. Vercel Preview est en succès ;
7. une vérification manuelle minimale confirme lecture raï, Beat Auto, export Pattern/Song et sauvegarde Cloud sans erreur visible.
