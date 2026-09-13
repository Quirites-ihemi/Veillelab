export const ECLAIREUR_STATES = {
  BULLETIN: 'bulletin',
  DIRECT: 'direct',
  OVERVIEW: 'overview',
  CLUSTER: 'cluster',
  EXPERTISE: 'expertise',
  HELP: 'help',
}

export const ECLAIREUR_SESSION_KEYS = {
  welcome: 'quirites:eclaireur:v1:welcome',
  overview: 'quirites:eclaireur:v1:overview',
  cluster: 'quirites:eclaireur:v1:cluster',
  expertise: 'quirites:eclaireur:v1:expertise',
}

export const ECLAIREUR_OVERVIEW_LAST_STEP = 6

export function getEntryState() {
  if (typeof window === 'undefined') return ECLAIREUR_STATES.DIRECT

  const params = new URLSearchParams(window.location.search)
  return params.get('source') === 'bulletin'
    ? ECLAIREUR_STATES.BULLETIN
    : ECLAIREUR_STATES.DIRECT
}

function getOverviewContent(step = 0) {
  switch (step) {
    case 0:
      return {
        lead: 'Chaque point représente une micro-expertise repérée dans les publications produites par le ministère.',
        body:
          'Ces compétences relèvent de trois grandes catégories :',
        categories: [
          { label: 'Problème public', color: '#14af75' },
          { label: 'Méthode / savoir-faire', color: '#ffb20e' },
          { label: 'Instrument / dispositif', color: '#7258d9' },
        ],
        placement: 'overview',
      }

    case 1:
      return {
        lead: 'Les liens montrent les micro-expertises associées dans une même publication.',
        body:
          'Ils permettent de voir comment différents problèmes, méthodes et dispositifs se combinent dans les travaux du ministère.',
        placement: 'overview',
      }

    case 2:
      return {
        lead: 'Certaines micro-expertises sont plus fortement reliées entre elles qu’au reste du réseau.',
        body:
          'La clusterisation est la méthode qui permet de repérer automatiquement ces ensembles à partir des relations présentes dans le graphe.',
        placement: 'overview',
      }

    case 3:
      return {
        lead: 'Ces ensembles sont ensuite nommés à partir des compétences qu’ils rassemblent.',
        body:
          'Leur intitulé facilite la lecture : ils ne correspondent ni à des catégories administratives ni à un classement défini à l’avance.',
        placement: 'overview',
      }

    case 4:
      return {
        lead: 'Certains ensembles sont transdirectionnels.',
        body:
          'Ils réunissent des compétences mobilisées par plusieurs directions du ministère et font apparaître des croisements de savoirs et de savoir-faire au-delà des frontières organisationnelles.',
        placement: 'overview',
      }

    case 5:
      return {
        lead: 'Une compétence peut aussi apparaître seule.',
        body:
          'Cela ne signifie pas qu’elle est moins importante : le corpus ne fait simplement pas apparaître suffisamment de relations avec d’autres compétences.',
        placement: 'overview',
      }

    default:
      return {
        lead: 'Vous savez maintenant comment lire la carte.',
        body:
          'Les grands ensembles font apparaître les proximités entre compétences, tout en conservant les expertises plus spécialisées ou isolées.',
        prompt: 'Cliquez sur un grand ensemble de compétences pour l’explorer.',
        actionLabel: 'Explorer la carte',
        placement: 'overview',
      }
  }
}

export function getEclaireurContent(state, context = {}) {
  const { selectedLabel, clusterLabel, overviewStep = 0 } = context

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
      return getOverviewContent(overviewStep)

    case ECLAIREUR_STATES.CLUSTER:
      return {
        lead: 'Vous explorez maintenant un grand ensemble de compétences.',
        body:
          'Vous pouvez maintenant entrer dans le détail des savoirs et savoir-faire qui composent cet ensemble.',
        prompt: 'Cliquez sur un point pour découvrir cette compétence.',
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
