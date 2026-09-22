CORRECTIF MINIMAL — CHUNK VISIBLE
=================================

Ce paquet part EXACTEMENT de la version actuellement publiée dans
Veillelab/public/t06-v2-test.

Il ne change PAS :
- le backend ;
- les prompts ;
- la génération des axes ;
- la sélection des matériaux ;
- les objets de veille.

Il change uniquement le rendu des sources :
- `repère 88;91` devient `p. 88 et 91` ;
- le champ backend `extrait` est affiché sous le titre, sous la mention
  « Extrait du corpus » ;
- la justification du filtre est affichée séparément.

Dans GitHub :
    Veillelab/public/t06-v2-test/

REMPLACER uniquement :
    app.js
    styles.css

Après le déploiement GitHub Pages, recharger avec Ctrl+F5.

Contrôle visuel :
sous chaque matériau doit apparaître le libellé exact :
    EXTRAIT DU CORPUS

Si à la place apparaît :
    Extrait du corpus non renvoyé par le backend.
alors le problème est côté données/backend et non côté affichage.
