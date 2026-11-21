import { searchMatcher, searchText } from './searchFamilies.js'

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

// Les familles de termes (drogue → stupéfiants, cocaïne…) sont partagées avec
// l'onglet Explorer : voir lib/searchFamilies.js.
// L'index est documentaire : correspondance explicite avec le titre de la
// publication ou le libellé d'un nœud de cette publication. Les textes des
// chunks ne sont pas interrogés pour éviter des rapprochements peu précis.
export function findDocumentedTopics(data, query, limit = 8) {
  const m = searchMatcher(query)
  if (m.empty) return []

  const matchedByPublication = new Map()
  for (const node of data.nodes || []) {
    const labelMatch = m.test(node.libelle)
    const normalizedMatch = m.test(node.libelle_normalise)
    if (!labelMatch && !normalizedMatch) continue
    if (!matchedByPublication.has(node.publication_id)) {
      matchedByPublication.set(node.publication_id, [])
    }
    matchedByPublication.get(node.publication_id).push({
      node,
      // Le mot tapé lui-même compte davantage qu'un terme de sa famille.
      score: (labelMatch ? 3 : 2) + (m.testDirect(node.libelle) ? 1 : 0),
    })
  }

  return (data.publications || [])
    .map(publication => {
      const titleMatched = m.test(publication.titre)
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
  const m = searchMatcher(query)
  if (m.empty) return []
  const byPub = new Map(documented.map(match => [match.publication.publication_id, match]))

  const ranked = (expertises || []).map(expertise => {
    const searchable = `${expertise.label} ${expertise.definition} ${(expertise.entities || []).join(' ')}`
    // Conserver la recherche partielle historique dans les expertises (ex. « prévent »).
    const direct = searchText(searchable).includes(searchText(query)) || m.testDirect(searchable)
    // Un autre terme de la famille permet une découverte thématique, mais ne
    // doit pas être présenté comme une correspondance directe au mot saisi.
    const thematic = !direct && m.test(searchable)
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
