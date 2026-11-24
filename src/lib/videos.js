// Vidéos hébergées sur le dépôt GitHub « videolancementV1 ».
export const VIDEO_PAGE = 'https://quirites-ihemi.github.io/videolancementV1/'

export const VIDEOS = {
  lancement: { id: 'lancement', title: 'Quiritès Veille Lab en 90 secondes', duration: '1 min 30', href: VIDEO_PAGE + 'teaser.html' },
  atlas: { id: 'atlas', title: 'L’Atlas des expertises ministérielles', duration: '3 min 18', href: VIDEO_PAGE + '#atlas' },
  atelier: { id: 'atelier', title: 'L’Atelier de veille', duration: '9 min 18', href: VIDEO_PAGE + '#atelier' },
}

// Vidéo signalée à l'ouverture de chaque onglet.
export const TAB_VIDEO = {
  home: 'lancement',
  expertises: 'atlas',
  explorer: 'lancement',
  atelier: 'atelier',
  documents: 'lancement',
}
