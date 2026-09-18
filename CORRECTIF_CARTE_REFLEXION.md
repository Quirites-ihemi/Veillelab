# Correctif — Carte de réflexion assistée uniquement

Ce patch ne remplace PAS l’onglet 3 « Atelier veille ».

Il conserve intégralement :
- l’écran d’accueil de l’Atelier de veille ;
- les six cartes de transformation ;
- Résumé analytique, Glossaire, Extraction de recommandations, Experts ministériels et Scénario de veille ;
- la navigation et le Header existants.

Seul le contenu ouvert après clic sur la carte « Carte de réflexion assistée » (T03) est remplacé par la nouvelle interface « Réfléchir avec le corpus » validée visuellement.

Fichiers du patch :
- `src/pages/Atelier.jsx` : modification minimale du routage de T03 ;
- `src/pages/ReflectionWorkspaceV1.jsx` : nouvelle interface T03 ;
- `src/pages/reflection-workspace.css` : styles propres à T03 ;
- `src/services/reflectionApi.js` : appels `/reflection-assist` et `/corpus-search`.

Le fichier `src/components/Header.jsx` n’est pas modifié.
