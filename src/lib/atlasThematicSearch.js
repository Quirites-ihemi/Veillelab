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

// Variantes lexicales simples (singulier/pluriel) pour les autres sujets.
const INFLECTIONS = {
  violence: ['violence', 'violences'],
  migration: ['migration', 'migrations'],
  cyberattaque: ['cyberattaque', 'cyberattaques'],
}

// Élargissement de recherche validé pour cette famille thématique.
// « drogue », « stupéfiant » et « narcotrafic » ne sont PAS des synonymes
// stricts : l'équivalence sert uniquement à retrouver des documents et des
// expertises contenant l'un des termes. Elle ne crée aucune relation graphe.
const DRUG_SEARCH_FAMILY = [
  'drogue', 'drogues',
  'stupefiant', 'stupefiants',
  'narcotrafic', 'narcotrafics',
]

// Variantes orthographiques d'un même terme, dont narco-trafic et narco trafic.
function normalizeThemeText(value) {
  return normalize(value).replace(/\bnarco[\s-]+(trafics?)\b/g, (_, suffix) => `narco${suffix}`)
}

function searchForms(query) {
  const q = normalizeThemeText(query)
  if (!q) return []
  if (DRUG_SEARCH_FAMILY.includes(q)) return DRUG_SEARCH_FAMILY
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
    const searchable = `${expertise.label} ${expertise.definition} ${(expertise.entities || []).join(' ')}`
    // Conserver la recherche partielle historique dans les expertises (ex. « prévent »).
    const direct = normalizeThemeText(searchable).includes(normalizeThemeText(query))
    // Un autre terme de la famille permet une découverte thématique, mais ne
    // doit pas être présenté comme une correspondance directe au mot saisi.
    const thematic = !direct && DRUG_SEARCH_FAMILY.includes(normalizeThemeText(query))
      && containsText(searchable, DRUG_SEARCH_FAMILY)
    const related = (expertise.publications || [])
      .map(p => byPub.get(p.publication_id))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
    if (!direct && !thematic && !related.length) return null
    return {
      expertise,
      kind: direct ? 'direct' : thematic ? 'theme' : 'publication',
      viaPublication: related[0]?.publication || null,
      score: (direct ? 100 : thematic ? 60 : 0) + (related[0]?.score || 0),
    }
  }).filter(Boolean)

  return ranked
    .sort((a, b) => b.score - a.score || a.expertise.label.localeCompare(b.expertise.label, 'fr'))
    .slice(0, limit)
}
