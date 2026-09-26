# VST3 PC Bridge

MPC Studio est une PWA : un navigateur ne peut pas charger directement un binaire VST3 Windows.

Le **VST3 PC Bridge** exécute les plugins installés sur le PC et permet à MPC Studio d'envoyer le sample du pad sélectionné, de le traiter, puis de récupérer un WAV. Il ne lance aucun installeur et ne transmet pas les chemins des plugins au navigateur.

## MeldaProduction / MPluginManager

Le fichier `MPluginManager_*_setup.exe` est l'installeur/gestionnaire MeldaProduction. MPC Studio ne l'exécute pas. Installe les plugins voulus normalement sur Windows afin que leurs fichiers `.vst3` soient présents dans les dossiers VST3 du système.

## Mode recommandé : HTTPS LAN

Pour conserver un **Secure Context** sur Android/PC (Service Worker/PWA, micro et Web MIDI selon le navigateur), le mode recommandé est de servir MPC Studio et l'API VST depuis le Bridge en HTTPS sur le réseau local.

Prépare un certificat TLS valable pour le nom/IP LAN utilisé, puis approuve ce certificat sur les appareils qui ouvriront MPC Studio. Configure ensuite :

```bat
set MPC_VST_CERT=C:\chemin\vers\cert.pem
set MPC_VST_KEY=C:\chemin\vers\key.pem
start_vst_bridge.bat
```

Le Bridge affiche alors une URL de la forme :

```text
https://192.168.1.20:8766/
```

Ouvre **cette URL HTTPS LAN** directement dans le navigateur du PC ou du téléphone. L'application et l'API VST sont alors sur la même origine.

Le Bridge affiche aussi un **jeton de session** long. Dans **Création > VST3 PC**, utilise ce jeton si le champ n'est pas déjà renseigné pour la session.

## Mode HTTP de secours

Sans `MPC_VST_CERT` et `MPC_VST_KEY`, le Bridge continue à fonctionner en HTTP :

```text
http://192.168.1.20:8766/
```

Ce mode reste utile pour un test local/same-origin, mais certaines fonctions web nécessitant un contexte sécurisé peuvent être limitées. Une page Vercel HTTPS ne peut pas appeler directement un Bridge HTTP LAN : le navigateur bloque ce mixed content.

## Accès cross-origin optionnel depuis Vercel

Le chemin recommandé reste l'URL HTTPS LAN du Bridge. Si tu veux autoriser explicitement la version Vercel HTTPS à appeler un Bridge HTTPS privé, ajoute son origine :

```bat
set MPC_VST_ALLOWED_ORIGINS=https://mpc-nu-inky.vercel.app
```

Plusieurs origines peuvent être séparées par des virgules. Le wildcard `*` est refusé.

Selon le navigateur, une autorisation d'accès au réseau local peut encore être demandée. Le Bridge répond aux preflights de réseau privé uniquement pour une origine présente dans l'allowlist.

## Sécurité du Bridge

Le pont :

- détecte uniquement les VST3 installés ;
- utilise un jeton de session aléatoire ;
- limite les tentatives d'authentification ;
- n'accepte qu'un identifiant de plugin issu de son propre scan ;
- limite les uploads à 64 Mo ;
- limite les WAV à 15 minutes ;
- n'exécute qu'un traitement VST à la fois ;
- traite uniquement des WAV PCM 16-bit mono/stéréo envoyés par MPC Studio ;
- n'autorise jamais une origine navigateur wildcard.

## Démarrage

Sous Windows, lance `start_vst_bridge.bat`.

PC et téléphone doivent être sur le même réseau pour une adresse LAN. En HTTPS, le certificat doit être approuvé par l'appareil client avant que le navigateur accepte la connexion.

## Dépendances

Le script utilise Python, NumPy et Spotify Pedalboard. Le fichier batch tente d'installer `pedalboard` et `numpy` s'ils sont absents.

Certains VST3 peuvent ne pas être compatibles avec le traitement hors-ligne de Pedalboard. Le pont renvoie alors une erreur sans modifier le sample original.
