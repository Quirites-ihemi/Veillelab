// Vidéos hébergées sur le dépôt GitHub « videolancementV1 ».
export const VIDEO_PAGE = 'https://quirites-ihemi.github.io/videolancementV1/'

export const VIDEOS = {
  lancement: {
    id: 'lancement',
    title: 'Quiritès Veille Lab en 90 secondes',
    lead: 'Découvrez l’application en une minute et demie : repérer les expertises, explorer une publication, construire votre propre travail.',
    duration: '1 min 30',
    href: VIDEO_PAGE + 'teaser.html',
    image: VIDEO_PAGE + 'vignette_lancement.jpg',
  },
  atlas: {
    id: 'atlas',
    title: 'L’Atlas des expertises ministérielles',
    lead: 'Prise en main de l’Atlas : familles d’expertises, recherche par sujet, fiches et publications associées.',
    duration: '3 min 18',
    href: VIDEO_PAGE + '#atlas',
    image: VIDEO_PAGE + 'vignette_atlas.jpg',
  },
  atelier: {
    id: 'atelier',
    title: 'L’Atelier de veille',
    lead: 'Prise en main de l’Atelier : résumé analytique, glossaire, recommandations, corpus et scénario de veille.',
    duration: '9 min 18',
    href: VIDEO_PAGE + '#atelier',
    image: VIDEO_PAGE + 'vignette_atelier.jpg',
  },
}

// Vidéo proposée à l'ouverture de chaque onglet.
export const TAB_VIDEO = {
  home: 'lancement',
  expertises: 'atlas',
  explorer: 'lancement',
  atelier: 'atelier',
  documents: 'lancement',
}
