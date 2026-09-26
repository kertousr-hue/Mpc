# Audit 5 — Corrections post-fusion

Date: 2026-09-26  
Branche: `fix/audit5-corrections`  
Base: `main@17ec7b21aab08888f252b2ab160440b833773a91`

## Objectif

Stabiliser la version fusionnée de MPC Studio après l’audit post-production, en corrigeant les incohérences fonctionnelles relevées dans les kits raï, l’export audio, Sonilo/Supabase, le VST Bridge et le déploiement.

Le résultat attendu est une application cohérente de bout en bout : les kits annoncés correspondent réellement aux instruments chargés, les banques et Beat Auto restent audibles, les exports sonnent comme la lecture live, les tâches Sonilo restent privées à leur propriétaire, les sauvegardes cloud ne créent pas de doublons inutiles, et Vercel reste l’unique canal de production.

## Contraintes

- Préserver la compatibilité des 128 slots Factory existants et leurs `factoryIndex`.
- Ne pas casser les projets sauvegardés en version 6/7.
- Conserver Supabase comme backend et Vercel comme hébergement principal.
- Ne jamais exposer la clé Sonilo au navigateur.
- Garder le fonctionnement VST3 Windows via le bridge local.
- Toute correction fonctionnelle doit avoir un test automatisé avant implémentation.
- Ne pas introduire de dépendance lourde côté navigateur sans nécessité.

## 1. Kits raï et banques

### Problème

Les kits factory sont actuellement définis par un simple `offset`, puis l’application charge les 16 sons suivants. La Factory n’est pourtant pas organisée en blocs de 16 correspondant aux noms de kits affichés.

Exemple : `KIT RAÏ DRUMS` à offset 0 charge 16 kicks uniquement, et `KIT RAÏ PERCUS` ne garantit pas Bendir/Tbal dans les 16 slots.

Les banques B/C/D peuvent également afficher des noms raï alors qu’aucun sample n’est chargé, et Beat Auto peut donc créer un pattern visuellement rempli mais silencieux.

### Conception

Remplacer les offsets par des listes explicites de 16 `factoryIndex`.

Chaque kit expose :

```js
{
  id,
  name,
  description,
  slots: [16 factoryIndex exacts]
}
```

Les kits seront :

- Kit Raï Complet : Kick, Snare/Rim, Clap, Shaker, Riq, Darbuka Doum, Darbuka Tek, Guellal, Bendir, Tbal, Tambourin, Bass, Gasba, Accordéon, Trompette, Synth/Vox.
- Kit Raï Drums : batterie et percussions rythmiques.
- Kit Raï Percus : Darbuka, Guellal, Bendir, Tbal, Riq, Tambourin.
- Kit Raï Bass & Melodies : basses, Gasba, Accordéon, Trompette, Guitare, Synth.
- Kit Raï Leads & Vox : leads, stabs, cordes, vox et FX.

Au démarrage, les banques A/B/C/D reçoivent chacune un vrai kit Factory raï plutôt que des noms seuls.

Beat Auto doit fonctionner sur toute banque : si la banque active ne contient pas de sons Factory valides sur les slots utilisés par le pattern, elle est hydratée avec le kit raï complet avant de poser les steps.

### Compatibilité

Les 128 entrées de `buildFactory()` restent dans le même ordre. Seule la définition des kits change.

## 2. Moteur audio et cache des bruits

### Problème

`createNoise()` alloue un nouveau AudioBuffer aléatoire à chaque hit. Les claps, shakers, Riq, cymbales et certaines percussions peuvent donc provoquer plus de garbage collection sur mobile, et le résultat live/export n’est pas strictement reproductible.

### Conception

Créer un cache de buffers de bruit par AudioContext et par durée normalisée.

API interne :

```js
getNoiseBuffer(audioContext, seconds, seedKey)
```

- Le cache est isolé par AudioContext via `WeakMap`.
- Les durées sont quantifiées pour éviter trop d’entrées.
- Une graine déterministe dérivée de `seedKey` produit le même bruit pour un même son Factory.
- Le live et l’OfflineAudioContext utilisent la même logique.

Le cache doit rester borné et être naturellement libéré avec l’AudioContext.

## 3. Export WAV identique au live

### Problème

`export-v2.js` applique les Parameter Locks présents sur un événement, mais ne restaure pas forcément les paramètres de piste au step suivant. Un lock Filter/Pan/Gain peut donc contaminer les événements suivants dans l’export.

L’export ne rend actuellement que le pattern courant.

### Conception

Créer une fonction commune qui calcule l’état effectif d’une piste pour chaque step :

```js
resolveTrackParamsAtStep(trackId, pattern, stepIndex, baseMixerState, stepLocks)
```

Elle combine :

1. état Mixer de base ;
2. automation de piste au step ;
3. locks du step courant.

Le live et l’export l’utilisent. Ainsi, l’absence de lock au step suivant rétablit explicitement la valeur de base/automation.

Ajouter deux modes d’export :

- Pattern : comportement actuel.
- Song : rend `songArrangement` complet, avec répétitions, changements de pattern, tempo global, swing et durée correcte.

Les stems Song utilisent exactement le même arrangement.

## 4. Sonilo : propriété des tâches et quotas

### Problème

`sonilo-task` accepte un `taskId` valide pour tout utilisateur authentifié. Si un identifiant est connu, son état peut être consulté par un autre utilisateur.

Le quota est réservé avant l’appel Sonilo ; une erreur amont peut donc consommer une unité sans génération créée.

### Conception

Ajouter une table :

```sql
public.sonilo_tasks (
  task_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
)
```

RLS :
- select uniquement si `auth.uid() = user_id`;
- insert uniquement pour son propre `user_id`.

Flux :

1. `sonilo-generate` valide l’utilisateur et le quota.
2. Appel Sonilo.
3. Si Sonilo retourne un vrai `task_id`, enregistrer le task avec `auth.uid()`.
4. Si l’appel échoue avant création de tâche, annuler/rendre le quota réservé.
5. `sonilo-task` vérifie que `task_id` appartient à `auth.uid()` avant tout appel vers Sonilo.

Le navigateur ne reçoit aucune information supplémentaire sensible.

## 5. Sauvegarde Supabase sans doublons

### Problème

Chaque clic sur “Sauver Cloud” fait un `insert` dans `music_projects`, ce qui crée une nouvelle ligne même lorsqu’on sauvegarde un projet déjà ouvert.

### Conception

Ajouter au runtime un `cloudProjectId`.

- Nouveau projet : `insert`, puis mémoriser l’id.
- Projet cloud ouvert : conserver son id.
- Sauvegarde suivante : `update ... eq('id', cloudProjectId).eq('user_id', currentUser)`.
- “Enregistrer une copie” peut rester une action séparée plus tard ; ce n’est pas inclus ici.

Les samples restent stockés sous :

```
<user_id>/<project_id>/<pad>.<ext>
```

Une mise à jour réutilise le même dossier.

## 6. VST Bridge et contexte sécurisé

### Problème

Le bridge sert actuellement MPC Studio en HTTP local pour éviter le Mixed Content, mais cela peut réduire les capacités navigateur associées à un contexte sécurisé : Service Worker/PWA, micro et certaines API MIDI.

### Conception

Cette correction est divisée en deux niveaux.

### Niveau immédiat

- Détecter si MPC est ouvert via HTTP LAN.
- Afficher clairement les capacités indisponibles dans ce mode.
- Ne pas présenter “PWA installable” ou fonctions sécurisées comme disponibles lorsque le navigateur les bloque.
- Garder le traitement VST même-origin actuel.

### Niveau sécurisé

Ajouter au bridge une option HTTPS locale lorsque des fichiers certificat/clé sont fournis :

```
--cert path/to/cert.pem
--key path/to/key.pem
```

Le bridge peut alors servir MPC et son API VST sur la même origine HTTPS.

Aucun certificat auto-signé n’est généré silencieusement par l’application. La documentation explique l’usage et le fallback HTTP LAN.

## 7. Déploiement

### Décision

Vercel reste le seul hébergement production de MPC Studio.

Le workflow `.github/workflows/pages.yml` est supprimé, car :
- GitHub Pages n’est pas utilisé comme URL production ;
- le workflow échoue actuellement sur la création du site Pages ;
- maintenir deux pipelines de publication augmente le risque de divergence.

La CI `check.yml` reste active sur `main` et les PR.

## 8. Tests et vérification

### Tests unitaires

Ajouter des tests pour :

- chaque kit possède exactement 16 indices valides ;
- le kit complet couvre les familles raï attendues ;
- toutes les banques initiales ont 16 sons Factory réels ;
- Beat Auto ne crée pas un pattern silencieux sur B/C/D ;
- le cache de bruit réutilise un buffer compatible et reste déterministe ;
- les paramètres exportés reviennent à l’état de base au step suivant ;
- l’export Song calcule correctement la chronologie de l’arrangement ;
- ownership Sonilo : un utilisateur ne peut pas lire le task d’un autre ;
- quota annulé si aucun `taskId` n’est créé ;
- sauvegarde cloud choisit insert vs update selon `cloudProjectId`.

### Tests statiques/CI

- `npm test`
- `node --check` sur tous les modules.
- `python -m py_compile vst_bridge.py`.
- contrôle des secrets Sonilo.
- vérifier qu’aucun workflow GitHub Pages ne subsiste.
- vérifier que le service worker référence tous les modules requis.

### Vérification backend

Après migrations/déploiement :
- Supabase Security Advisor : 0 warning/error.
- Edge Functions Sonilo : ACTIVE + `verify_jwt=true`.
- test SQL sans session sur les fonctions de quota/ownership doit refuser l’accès.

### Vérification production

Après PR et fusion :
- CI main verte ;
- statut Vercel success ;
- URL production répond ;
- PWA recharge le nouveau cache ;
- test manuel recommandé sur Android : pads, Beat Auto, export, Sonilo, sauvegarde cloud et VST mode local.

## Hors périmètre

- Refonte visuelle complète.
- Nouveaux instruments supplémentaires au-delà des 128 slots.
- Hébergement de vrais samples commerciaux.
- Création automatique de certificats locaux.
- Collaboration multi-utilisateur temps réel.
- Marketplace VST.
- Changement de fournisseur Supabase ou Vercel.

## Ordre d’implémentation

1. Kits explicites + banques + Beat Auto.
2. Cache bruit déterministe.
3. Parité live/export + export Song.
4. Ownership Sonilo + compensation quota.
5. Sauvegarde cloud update/insert.
6. VST Bridge HTTPS optionnel + détection des capacités.
7. Suppression GitHub Pages.
8. Vérification finale complète et PR vers `main`.
