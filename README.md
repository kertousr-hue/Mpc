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
