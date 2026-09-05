# BeatBox Studio V4

## Nouveautés
- Interface repensée avec 16 pads 4×4 bien centrés.
- 3 modes : Sampling, Séquençage, Création.
- Bibliothèque Factory de 128 samples originaux : kicks, snares, claps, hats, open hats, percussions, toms, cymbals, basses, synthés et FX/Vox.
- Import de samples personnels.
- Enregistrement micro.
- Slice/Chop ×4, pitch, trim start/end, reverse.
- 4 banques A/B/C/D = 64 pads.
- 8 patterns, séquenceur 16 pas, Note Repeat, Full Level, Tap Tempo, Swing.
- Générateur de beat automatique.
- Sauvegarde locale, import/export projet, export WAV.
- Connexion Supabase : Auth, projets Cloud, Storage privé pour samples personnels.

## Démarrage local
La bibliothèque Factory utilise des fichiers WAV locaux. Ouvre l'application via HTTP/HTTPS.

Exemple avec Python :
`python -m http.server 8080`

Puis ouvre :
`http://localhost:8080`

## Supabase
1. Crée un NOUVEAU projet Supabase dédié à BeatBox Studio.
2. Exécute `supabase-schema.sql`.
3. Dans l'application, appuie sur `SUPABASE`.
4. Renseigne le Project URL et uniquement la Publishable key (`sb_publishable_...`).
5. Crée un compte ou connecte-toi.
6. Utilise `SAUVEGARDER CLOUD`.

Ne mets jamais de secret key ou de service_role key dans le navigateur.

## Samples
Les 128 sons Factory de cette V4 ont été synthétisés spécialement pour cette application et sont fournis comme sons originaux. Ils ne copient pas de banques commerciales.
