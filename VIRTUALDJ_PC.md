# MPC Studio + VirtualDJ PC + Android

Ce mode permet d'utiliser un téléphone Android comme contrôleur de VirtualDJ exécuté sur un PC Windows.

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

La passerelle MPC Studio ne rend pas directement le port Network Control accessible au téléphone. Elle communique avec VirtualDJ localement sur `127.0.0.1` et expose seulement des commandes autorisées.

## 2. Démarrer la passerelle sur le PC

Le plus simple sous Windows : double-cliquer sur :

`start_virtualdj_bridge.bat`

Sinon depuis un terminal :

```bash
python virtualdj_bridge.py
```

Le terminal affiche notamment :

```text
Code PIN Android : 123456
Ouvre sur Android : http://192.168.x.x:8765/?mode=virtualdj
```

Ne ferme pas cette fenêtre pendant l'utilisation.

### Avec un mot de passe Network Control

```bash
python virtualdj_bridge.py --vdj-password "TON_MOT_DE_PASSE"
```

### Si Network Control utilise un autre port

```bash
python virtualdj_bridge.py --vdj-port 8088
```

## 3. Ouvrir le contrôleur sur Android

1. Ouvrir Chrome sur Android.
2. Saisir exactement l'adresse affichée par la passerelle PC, par exemple `http://192.168.1.25:8765/?mode=virtualdj`.
3. Dans **VIRTUALDJ PC**, saisir le code PIN affiché sur le PC.
4. Appuyer sur **CONNECTER**.

Cette adresse locale est volontairement utilisée pour éviter le blocage « HTTPS vers HTTP local » des navigateurs mobiles.

## Commandes disponibles

Chaque deck propose :

- Play/Pause
- CUE et SET CUE
- SYNC
- PFL casque
- Pitch
- Volume
- EQ Bass / Medium / Aigu
- Filtre
- Boucles 1 / 2 / 4 / 8 / 16 beats
- 8 Hot Cues
- 8 pads de la page VirtualDJ active
- Echo
- Reverb
- Backspin
- Key Lock

Le mixer central propose le crossfader et 8 pads du Sampler VirtualDJ.

## Sécurité

La passerelle génère un nouveau PIN au démarrage si aucun PIN fixe n'est fourni. Les commandes reçues depuis le réseau sont limitées à une liste blanche : le navigateur ne peut pas envoyer librement n'importe quel VDJScript.

Pour utiliser un PIN fixe :

```bash
python virtualdj_bridge.py --pin 654321
```

## Pare-feu Windows

Au premier lancement, Windows peut demander si Python est autorisé à communiquer sur le réseau. Autoriser uniquement les **réseaux privés**. Ne pas exposer le port 8765 sur Internet et ne pas créer de redirection de port sur la box Internet.
