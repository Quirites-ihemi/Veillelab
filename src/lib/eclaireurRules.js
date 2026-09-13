export const ECLAIREUR_STATES = {
  BULLETIN: 'bulletin',
  DIRECT: 'direct',
  OVERVIEW: 'overview',
  CLUSTER: 'cluster',
  EXPERTISE: 'expertise',
  HELP: 'help',
  TRANSDIRECTIONAL: 'transdirectional',
}

export const ECLAIREUR_SESSION_KEYS = {
  welcome: 'quirites:eclaireur:v0:welcome',
  overview: 'quirites:eclaireur:v0:overview',
  cluster: 'quirites:eclaireur:v0:cluster',
  expertise: 'quirites:eclaireur:v0:expertise',
  transdirectional: 'quirites:eclaireur:v0:transdirectional',
}

export function getEntryState() {
  if (typeof window === 'undefined') return ECLAIREUR_STATES.DIRECT

  const params = new URLSearchParams(window.location.search)
  return params.get('source') === 'bulletin'
    ? ECLAIREUR_STATES.BULLETIN
    : ECLAIREUR_STATES.DIRECT
}

export function getEclaireurContent(state, context = {}) {
  const { selectedLabel, clusterLabel } = context

  switch (state) {
    case ECLAIREUR_STATES.BULLETIN:
      return {
        lead: 'Vous prolongez ici votre lecture du bulletin.',
        body:
          'Les publications du ministère mobilisent de nombreux savoirs et savoir-faire portés par nos collègues. Cette carte met en valeur la richesse de ces compétences internes, montre comment elles se complètent et fait apparaître les rapprochements entre elles.',
        prompt:
          'Explorez les grands ensembles de compétences pour découvrir cette richesse.',
        actionLabel: 'Explorer les grands ensembles',
        placement: 'welcome',
      }

    case ECLAIREUR_STATES.DIRECT:
      return {
        lead: 'Bienvenue dans Quiritès Veille Lab.',
        body:
          'Quiritès Veille Lab est l’application compagne du bulletin de veille du ministère de l’Intérieur. Vous êtes ici dans l’onglet 1, consacré aux compétences du ministère. Les publications produites par le ministère mobilisent une grande diversité de connaissances, de méthodes et de savoir-faire portés par nos collègues. Cette carte permet de rendre visible cette richesse et de découvrir comment ces compétences se rapprochent et se complètent.',
        prompt: 'Commencez par choisir un grand ensemble.',
        actionLabel: 'Découvrir la carte',
        placement: 'welcome',
      }

    case ECLAIREUR_STATES.OVERVIEW:
      return {
        lead:
          'Vous voyez ici les grands ensembles de compétences qui ressortent des publications produites par le Ministère.',
        body:
          'Ils réunissent des savoirs et savoir-faire proches ou complémentaires.',
        prompt: 'Cliquez sur un ensemble pour entrer dans le détail.',
        placement: 'overview',
      }

    case ECLAIREUR_STATES.CLUSTER:
      return {
        lead: 'Vous explorez maintenant un grand ensemble de compétences.',
        body:
          'Les points représentent des savoirs et savoir-faire mis en évidence dans les publications. Les liens montrent les rapprochements documentés entre ces compétences.',
        prompt: 'Cliquez sur un point pour en découvrir le détail.',
        placement: 'cluster',
      }

    case ECLAIREUR_STATES.EXPERTISE:
      return {
        lead: 'Vous consultez maintenant une compétence précise.',
        body:
          'La fiche vous indique les publications dans lesquelles elle apparaît, les domaines dans lesquels elle est mobilisée et les compétences auxquelles elle est directement associée.',
        prompt:
          'Ouvrez les différentes rubriques pour poursuivre l’exploration.',
        placement: 'drawer',
      }

    case ECLAIREUR_STATES.TRANSDIRECTIONAL:
      return {
        lead: 'Cet ensemble est transdirectionnel.',
        body:
          'Cela signifie qu’il fait apparaître des compétences mobilisées par plusieurs directions du ministère. Ces rapprochements permettent de voir comment des savoirs et savoir-faire issus de différentes entités se rencontrent autour de problématiques ou de pratiques communes.',
        prompt:
          'Explorez les compétences de l’ensemble pour découvrir ces croisements.',
        actionLabel: 'Compris',
        placement: 'transdirectional',
      }

    case ECLAIREUR_STATES.HELP: {
      if (selectedLabel && clusterLabel) {
        return {
          lead: `Vous êtes dans le grand ensemble « ${clusterLabel} » et consultez la compétence « ${selectedLabel} ».`,
          body:
            'Vous pouvez revenir à la vue globale, choisir une autre compétence ou utiliser le filtre par entité.',
          placement: 'drawer',
        }
      }

      if (selectedLabel) {
        return {
          lead: `Vous consultez la compétence « ${selectedLabel} ».`,
          body:
            'La fiche à droite rassemble son contexte, les publications associées, les domaines mobilisés et les compétences directement associées. Vous pouvez aussi revenir à la carte pour poursuivre l’exploration.',
          placement: 'drawer',
        }
      }

      if (clusterLabel) {
        return {
          lead: `Vous explorez le grand ensemble « ${clusterLabel} ».`,
          body:
            'Sélectionnez un point pour ouvrir une compétence précise, ou revenez à la carte complète pour choisir un autre ensemble.',
          placement: 'cluster',
        }
      }

      return {
        lead: 'Vous êtes sur la carte des compétences du ministère.',
        body:
          'Choisissez un grand ensemble pour entrer dans le détail. Vous pouvez aussi rechercher une compétence ou filtrer la carte par entité.',
        placement: 'overview',
      }
    }

    default:
      return null
  }
}
