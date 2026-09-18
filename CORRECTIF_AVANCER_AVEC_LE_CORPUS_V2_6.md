# Avancer avec le corpus — V2.6

Version reconstruite à partir du ZIP complet transmis le 18 septembre 2026.

Corrections principales :

- suppression de la priorité donnée à une ancienne requête libre ;
- un besoin documentaire s'applique désormais d'abord au(x) post-it sélectionné(s) ;
- si le canevas ne contient qu'un seul post-it, il est utilisé automatiquement ;
- la question du post-it n'est plus recopiée dans le champ de recherche ;
- la recherche libre est séparée dans un bloc repliable « Question libre au corpus » ;
- les résultats guidés sont effacés si l'utilisateur change de post-it, afin d'éviter d'afficher une réponse liée à une ancienne carte ;
- le texte principal des post-it n'est plus en gras ;
- le mode « Relier des cartes » est refait : le déplacement est désactivé pendant la sélection des deux cartes, les cartes 1 et 2 sont visuellement numérotées et un bandeau dédié permet de qualifier puis créer le lien ;
- les liens restent persistés dans le sessionStorage avec le canevas.

Contrôles effectués :

- parsing JSX/JS des 26 fichiers source : 0 erreur ;
- vérification des imports relatifs : 0 import manquant ;
- vérifications statiques ciblées sur la séparation recherche guidée / recherche libre, le mode liaison et le poids de police des post-it.

Le build Vite complet n'a pas pu être exécuté dans l'environnement de préparation car l'installation npm n'aboutit pas dans le délai disponible. Les sources ont néanmoins été vérifiées syntaxiquement avec le parseur TypeScript JSX.
