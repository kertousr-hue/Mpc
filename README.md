# MPC Studio

Application web/PWA de production musicale inspirée du workflow d'un sampler autonome, avec un design original.

## Fonctionnalités

- 16 pads tactiles bien centrés.
- 4 banques A/B/C/D = 64 pads.
- 3 espaces : **Sampling**, **Séquençage**, **Création**.
- **128 sons Factory originaux générés directement par le moteur audio** :
  - 16 kicks
  - 16 snares
  - 8 claps
  - 16 hi-hats
  - 8 open hats
  - 16 percussions
  - 8 toms
  - 8 cymbales
  - 12 basses
  - 12 synthés
  - 8 FX/Vox
- Import WAV/MP3/audio.
- Enregistrement micro.
- Slice ×4.
- Pitch, volume, trim début/fin, loop et reverse pour les samples utilisateur.
- 8 patterns.
- Séquenceur 16 pas.
- Note Repeat, Full Level, Tap Tempo, Swing et métronome.
- Beat automatique et kit aléatoire.
- Sauvegarde locale.
- Import/export projet JSON.
- Export WAV du pattern courant.
- PWA installable.
- Connexion Supabase pour Auth, projets Cloud et stockage privé des samples utilisateur.

## Lancer le projet

Il faut le servir en HTTP/HTTPS.

Exemple :

```bash
python -m http.server 8080
```

Puis ouvrir :

`http://localhost:8080`

## Supabase

Le dépôt ne contient **aucune clé secrète**.

1. Créer un projet Supabase séparé pour MPC Studio.
2. Exécuter `supabase-schema.sql`.
3. Ouvrir l'application et appuyer sur **SUPABASE**.
4. Saisir le Project URL et uniquement une **Publishable key**.
5. Créer un compte ou se connecter.
6. Utiliser **SAUVER CLOUD**.

Le schéma active RLS sur les projets et limite les fichiers du bucket `music-samples` au dossier de chaque utilisateur.

## Sécurité

Ne jamais placer une `service_role`, une secret key ou un mot de passe dans le code du navigateur.

## Samples Factory

Les 128 sons Factory sont synthétisés par le moteur Web Audio au moment de la lecture. Ils sont originaux et n'embarquent aucune banque commerciale protégée.


## API gratuites intégrées

Un bouton **API GRATUITES** est disponible dans l'application.

Services ajoutés :

- **Openverse** — recherche audio sous licence ouverte, sans clé obligatoire.
- **Wikimedia Commons** — sons et fichiers audio libres avec métadonnées de licence.
- **Internet Archive** — recherche dans les archives audio publiques.
- **MusicBrainz** — métadonnées de morceaux, artistes et enregistrements.
- **Freesound** — recherche de samples avec une clé API gratuite personnelle.
- **Demucs** — séparation d'un sample utilisateur en Drums, Bass, Vocals et Other via le service public de démonstration.
- **Basic Pitch** — conversion audio vers MIDI via un serveur Basic Pitch auto-hébergé configuré par l'utilisateur.

### Freesound

La clé Freesound n'est jamais enregistrée dans GitHub. Elle est stockée localement dans le navigateur via l'écran **Configuration** du centre API.

### Demucs

Le service Demucs utilisé est un service public tiers et peut être indisponible ou limité. Pour une application de production, il est recommandé d'auto-héberger Demucs.

### Licences

Le fait qu'un fichier soit accessible par une API gratuite ne signifie pas qu'il peut être utilisé sans conditions. MPC Studio affiche la licence ou un lien vers la source quand cette information est disponible. Toujours vérifier la licence avant redistribution ou usage commercial.


## Installation PWA

MPC Studio est préparé pour être installé comme une application.

### Android / Chrome

1. Ouvrir le site en HTTPS.
2. Appuyer sur **INSTALLER L’APPLICATION** dans MPC Studio.
3. Accepter l’installation Android.
4. L’application apparaît ensuite sur l’écran d’accueil et s’ouvre en mode autonome.

Si le bouton d’installation natif n’est pas proposé, ouvrir le menu **⋮** de Chrome puis choisir **Installer l’application** ou **Ajouter à l’écran d’accueil**.

### Fichiers PWA

- `manifest.webmanifest` : nom, couleurs, icônes, raccourcis Sampling/Séquençage/Création.
- `icons/icon-192.png` et `icons/icon-512.png` : icônes Android.
- `pwa.js` : bouton d’installation, détection du mode installé et guide de secours.
- `sw.js` : cache local et fonctionnement hors ligne des fonctions principales.

L’installation PWA nécessite une origine sécurisée **HTTPS** (ou localhost pendant le développement).
