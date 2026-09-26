# VST3 PC Bridge

MPC Studio est une PWA : un navigateur ne peut pas charger directement un binaire VST3 Windows.

Le **VST3 PC Bridge** exécute les plugins installés sur le PC et permet à MPC Studio d'envoyer le sample du pad sélectionné, de le traiter, puis de récupérer un WAV.

## MeldaProduction / MPluginManager

Le fichier `MPluginManager_*_setup.exe` est l'installeur/gestionnaire MeldaProduction. MPC Studio ne l'exécute pas. Installe les plugins voulus normalement sur Windows afin que leurs fichiers `.vst3` soient présents dans les dossiers VST3 du système.

## Démarrage

Sous Windows, lancer `start_vst_bridge.bat`.

Le pont :
- détecte les VST3 installés ;
- affiche un PIN ;
- écoute par défaut sur le port 8766 ;
- n'accepte qu'un identifiant de plugin issu de son propre scan ;
- limite les uploads à 64 Mo ;
- traite uniquement des WAV PCM 16-bit envoyés par MPC Studio.

Sur Android, PC et téléphone doivent être sur le même réseau. Dans **Création > VST3 PC**, saisir l'adresse LAN affichée par le pont et le PIN.

## Dépendances

Le script utilise Python, NumPy et Spotify Pedalboard. Le fichier batch tente d'installer `pedalboard` et `numpy` s'ils sont absents.

Certains VST3 peuvent ne pas être compatibles avec le traitement hors-ligne de Pedalboard. Le pont renvoie alors une erreur sans modifier le sample original.
