// Vidéos hébergées sur le dépôt GitHub « videolancementV1 ».
export const VIDEO_PAGE = 'https://quirites-ihemi.github.io/videolancementV1/'

export const VIDEOS = {
  atlas: {
    id: 'atlas',
    title: 'L’Atlas des expertises ministérielles',
    lead: 'Prise en main de l’Atlas : familles d’expertises, recherche par sujet, fiches et publications associées.',
    duration: '3 min 18',
    href: VIDEO_PAGE + '#atlas',
    image: VIDEO_PAGE + 'vignette_atlas.jpg',
  },
  explorer: {
    id: 'explorer',
    title: 'Explorer une publication',
    lead: 'Prise en main de l’onglet : choisir une publication, lire son graphe de connaissances, interroger le graphe et retrouver la preuve à la page.',
    duration: '7 min 11',
    href: VIDEO_PAGE + '#explorer',
    image: VIDEO_PAGE + 'vignette_explorer.jpg',
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

// Vidéo de prise en main proposée à l'ouverture de l'onglet correspondant.
// La vidéo de lancement (teaser.html) sert à la diffusion extérieure : elle n'est pas proposée ici.
export const TAB_VIDEO = {
  expertises: 'atlas',
  explorer: 'explorer',
  atelier: 'atelier',
}
