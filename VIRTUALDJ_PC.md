# MPC Studio + VirtualDJ PC + Android

Ce mode permet d'utiliser un téléphone Android comme contrôleur de VirtualDJ exécuté sur un PC Windows, et d'envoyer un fichier musical du téléphone/PC directement vers Deck A ou Deck B.

## Prérequis

- VirtualDJ 2023 ou plus récent.
- Une licence VirtualDJ Pro.
- L'extension officielle **Network Control** installée dans VirtualDJ.
- Python 3 sur le PC.
- Le PC et le téléphone Android sur le même réseau Wi‑Fi/LAN.

## 1. Activer Network Control dans VirtualDJ

Dans VirtualDJ :

1. Ouvrir **Settings / Paramètres**.
2. Aller dans **Extensions**.
3. Rechercher **Network Control** dans les effets/autres extensions.
4. Installer l'extension.
5. Dans le panneau Master, ouvrir Network Control dans la catégorie Auto-Start.
6. Laisser le port HTTP sur **80** pour la configuration par défaut de MPC Studio.
7. Un mot de passe Network Control est optionnel. S'il est utilisé, lancer la passerelle avec `--vdj-password`.

La passerelle MPC Studio communique avec VirtualDJ localement sur `127.0.0.1` et expose seulement des commandes autorisées.

## 2. Démarrer la passerelle v2 sur le PC

Le plus simple sous Windows : double-cliquer sur :

`start_virtualdj_bridge.bat`

Le lanceur utilise maintenant automatiquement `virtualdj_bridge_v2.py`.

Sinon depuis un terminal :

```bash
python virtualdj_bridge_v2.py
```

Le terminal affiche notamment :

```text
Code PIN Android : 123456
Ouvre sur Android : http://192.168.x.x:8765/?mode=virtualdj
```

Ne ferme pas cette fenêtre pendant l'utilisation.

### Avec un mot de passe Network Control

```bash
python virtualdj_bridge_v2.py --vdj-password "TON_MOT_DE_PASSE"
```

### Si Network Control utilise un autre port

```bash
python virtualdj_bridge_v2.py --vdj-port 8088
```

## 3. Ouvrir le contrôleur sur Android

1. Ouvrir Chrome sur Android.
2. Saisir exactement l'adresse affichée par la passerelle PC, par exemple `http://192.168.1.25:8765/?mode=virtualdj`.
3. Dans **VIRTUALDJ PC**, saisir le code PIN affiché sur le PC.
4. Appuyer sur **CONNECTER**.

Cette adresse locale est volontairement utilisée pour éviter le blocage « HTTPS vers HTTP local » des navigateurs mobiles.

## 4. Envoyer une musique vers VirtualDJ

Sur chaque deck, MPC Studio affiche maintenant **CHARGER UNE MUSIQUE**.

1. Appuyer sur **CHOISIR UN FICHIER**.
2. Choisir un MP3, WAV, FLAC, M4A, AAC, OGG, OPUS ou AIFF.
3. MPC Studio transfère le fichier au PC par le réseau local.
4. La passerelle sauvegarde une copie temporaire sur le PC.
5. VirtualDJ charge automatiquement le morceau sur le deck choisi.

La taille maximale par fichier est de 250 Mo. Les fichiers reçus sont stockés par défaut dans le dossier temporaire Windows `MPC-Studio-VirtualDJ`.

Le chargement utilise la commande VDJScript officielle `deck N load "fullpath"`. Le navigateur ne peut pas fournir lui-même un chemin arbitraire sur le PC.

## Commandes disponibles

Chaque deck propose Play/Pause, CUE et SET CUE, SYNC, PFL, Pitch, Volume, EQ Bass/Medium/Aigu, Filtre, boucles 1/2/4/8/16 beats, 8 Hot Cues, 8 pads VirtualDJ, Echo, Reverb, Backspin et Key Lock.

Le mixer central propose le crossfader et 8 pads du Sampler VirtualDJ.

## Sécurité

La passerelle génère un nouveau PIN au démarrage si aucun PIN fixe n'est fourni. Les commandes reçues depuis le réseau sont limitées à une liste blanche. L'upload accepte uniquement des extensions audio autorisées et ne peut charger que le fichier qui vient d'être transféré dans le dossier temporaire de la passerelle.

Pour utiliser un PIN fixe :

```bash
python virtualdj_bridge_v2.py --pin 654321
```

## Pare-feu Windows

Au premier lancement, Windows peut demander si Python est autorisé à communiquer sur le réseau. Autoriser uniquement les **réseaux privés**. Ne pas exposer le port 8765 sur Internet et ne pas créer de redirection de port sur la box Internet.
