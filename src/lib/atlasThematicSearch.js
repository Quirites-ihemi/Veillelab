import { normalize } from './text.js'

// Exemples de portes d'entrée ; ce ne sont ni des micro-expertises, ni un
// thesaurus de synonymes. Les résultats restent calculés à partir du corpus.
export const ATLAS_THEME_EXAMPLES = [
  { label: 'Drogues et narcotrafic', query: 'narcotrafic' },
  { label: 'Criminalité organisée', query: 'criminalité organisée' },
  { label: 'Violences', query: 'violences sexuelles' },
  { label: 'Terrorisme', query: 'terrorisme' },
  { label: 'Cybersécurité', query: 'cybercriminalité' },
  { label: 'Immigration et asile', query: 'asile' },
  { label: 'Sécurité territoriale', query: 'délinquance' },
  { label: 'Maintien de l’ordre', query: 'maintien de l’ordre' },
  { label: 'Sécurité routière', query: 'sécurité routière' },
  { label: 'Environnement', query: 'criminalité environnementale' },
  { label: 'Santé mentale', query: 'santé mentale' },
  { label: 'Technologies', query: 'intelligence artificielle' },
]

// Uniquement des variantes lexicales sûres (singulier/pluriel). Ne pas
// assimiler « drogue », « stupéfiants » et « narcotrafic » : leurs périmètres
// ne sont pas interchangeables.
const INFLECTIONS = {
  drogue: ['drogue', 'drogues'],
  stupefiant: ['stupefiant', 'stupefiants'],
  violence: ['violence', 'violences'],
  migration: ['migration', 'migrations'],
  cyberattaque: ['cyberattaque', 'cyberattaques'],
}

// Variantes orthographiques d'un même terme, pas des synonymes thématiques.
// On harmonise les trois écritures sans élargir la recherche à « drogues ».
function normalizeThemeText(value) {
  return normalize(value).replace(/\bnarco[\s-]+(trafics?)\b/g, (_, suffix) => `narco${suffix}`)
}

function searchForms(query) {
  const q = normalizeThemeText(query)
  if (!q) return []
  const forms = Object.values(INFLECTIONS).find(group => group.includes(q))
  return forms || [q]
}

function containsText(haystack, forms) {
  if (!forms.length) return false
  const text = ` ${normalizeThemeText(haystack)} `
  return forms.some(form => text.includes(` ${form} `))
}

// L'index est documentaire : correspondance explicite avec le titre de la
// publication ou le libellé d'un nœud de cette publication. Les textes des
// chunks ne sont pas interrogés pour éviter des rapprochements peu précis.
export function findDocumentedTopics(data, query, limit = 8) {
  const forms = searchForms(query)
  if (!forms.length) return []

  const matchedByPublication = new Map()
  for (const node of data.nodes || []) {
    const labelMatch = containsText(node.libelle, forms)
    const normalizedMatch = containsText(node.libelle_normalise, forms)
    if (!labelMatch && !normalizedMatch) continue
    if (!matchedByPublication.has(node.publication_id)) {
      matchedByPublication.set(node.publication_id, [])
    }
    matchedByPublication.get(node.publication_id).push({
      node,
      score: labelMatch ? 4 : 2,
    })
  }

  return (data.publications || [])
    .map(publication => {
      const titleMatched = containsText(publication.titre, forms)
      const nodes = (matchedByPublication.get(publication.publication_id) || [])
        .sort((a, b) => b.score - a.score || a.node.node_id.localeCompare(b.node.node_id))
      if (!titleMatched && !nodes.length) return null
      return {
        publication,
        titleMatched,
        nodes: nodes.map(({ node }) => node),
        // Une correspondance dans le texte du titre vaut davantage qu'une
        // occurrence générique dans un seul nœud.
        score: (titleMatched ? 8 : 0) + nodes.reduce((sum, match) => sum + match.score, 0),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.publication.titre.localeCompare(b.publication.titre, 'fr'))
    .slice(0, limit)
}

// Deux types de résultats clairement distingués :
// - direct : le libellé/la définition de l'expertise correspond à la requête ;
// - publication : l'expertise est associée dans le référentiel à une publication
//   portant un nœud/titre correspondant. Cela NE constitue pas une nouvelle
//   relation validée entre la micro-expertise et le sujet du nœud.
export function findThematicExpertises(expertises, documented, query, limit = 8) {
  const forms = searchForms(query)
  if (!forms.length) return []
  const byPub = new Map(documented.map(match => [match.publication.publication_id, match]))

  const ranked = (expertises || []).map(expertise => {
    // Conserver la recherche partielle historique dans les expertises (ex. « prévent »).
    const direct = normalizeThemeText(`${expertise.label} ${expertise.definition} ${(expertise.entities || []).join(' ')}`).includes(normalizeThemeText(query))
    const related = (expertise.publications || [])
      .map(p => byPub.get(p.publication_id))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
    if (!direct && !related.length) return null
    return {
      expertise,
      kind: direct ? 'direct' : 'publication',
      viaPublication: related[0]?.publication || null,
      score: (direct ? 100 : 0) + (related[0]?.score || 0),
    }
  }).filter(Boolean)

  return ranked
    .sort((a, b) => b.score - a.score || a.expertise.label.localeCompare(b.expertise.label, 'fr'))
    .slice(0, limit)
}
