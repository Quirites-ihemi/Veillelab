// Voisinage entre publications, calculé dans le navigateur à partir du corpus chargé
// (nœuds et relations). Aucune donnée n'est modifiée : il s'agit d'un rapprochement
// lexical entre éléments, affiché avec ses preuves pour que le lecteur puisse en juger.

const STOP = new Set(('de la le les des du d l et en a au aux pour par sur dans un une à ou leur leurs son sa ses entre face avec sans plus est sont selon ce cette ces qui que lors vers via notamment france francais francaise national nationale nationaux public publique publics publiques politique politiques').split(' '))
const SUFFIXES = ['ations', 'ation', 'ements', 'ement', 'ites', 'ite', 'iques', 'ique', 'ismes', 'isme', 'istes', 'iste', 'eurs', 'eur', 'ives', 'ive', 'ifs', 'if', 'elles', 'elle', 'aux', 'ales', 'ale', 'al', 'es', 's', 'e']
// Types qui ne font pas un « sujet » : on ne les prend pas comme branches.
const NOT_SUBJECT = new Set(['acteur', 'expert_public', 'localisation'])

const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
function stem(w) {
  for (const suf of SUFFIXES) if (w.length - suf.length >= 4 && w.endsWith(suf)) return w.slice(0, -suf.length)
  return w
}
function tokens(node) {
  const words = fold(`${node.libelle || ''} ${node.libelle_normalise || ''}`).match(/[a-z]+/g) || []
  return new Set(words.filter(w => w.length > 3 && !STOP.has(w)).map(stem))
}

export function buildNeighbourIndex(nodes = [], relations = []) {
  const tok = new Map(), df = new Map(), degree = new Map(), byPub = new Map()
  for (const n of nodes) {
    const t = tokens(n); tok.set(n.node_id, t)
    for (const x of t) df.set(x, (df.get(x) || 0) + 1)
    if (!byPub.has(n.publication_id)) byPub.set(n.publication_id, [])
    byPub.get(n.publication_id).push(n)
  }
  for (const r of relations) {
    degree.set(r.source_id, (degree.get(r.source_id) || 0) + 1)
    degree.set(r.cible_id, (degree.get(r.cible_id) || 0) + 1)
  }
  const idf = new Map([...df].map(([t, c]) => [t, Math.log(nodes.length / c)]))
  return { nodes, tok, idf, degree, byPub }
}

function score(index, a, b) {
  const A = index.tok.get(a.node_id), B = index.tok.get(b.node_id)
  const shared = [...A].filter(t => B.has(t))
  if (shared.length < 2 || !shared.some(t => index.idf.get(t) > 3)) return 0
  const w = set => [...set].reduce((s, t) => s + index.idf.get(t), 0)
  return shared.reduce((s, t) => s + index.idf.get(t), 0) / Math.sqrt(w(A) * w(B) + 1e-9)
}

// Branches d'une publication : ses éléments les plus reliés (sujets) et, pour chacun,
// les publications voisines qui contiennent un élément proche.
export function branchesFor(index, publicationId, { maxBranches = 5, maxLeaves = 3, threshold = 0.28 } = {}) {
  const own = index.byPub.get(publicationId) || []
  const subjects = own.filter(n => !NOT_SUBJECT.has(n.type_noeud))
    .sort((a, b) => (index.degree.get(b.node_id) || 0) - (index.degree.get(a.node_id) || 0)).slice(0, 8)
  const branches = []
  for (const subject of subjects) {
    const best = new Map()
    for (const other of index.nodes) {
      if (other.publication_id === publicationId) continue
      const s = score(index, subject, other)
      if (s >= threshold && s > (best.get(other.publication_id)?.score || 0)) best.set(other.publication_id, { publicationId: other.publication_id, node: other, score: s })
    }
    const leaves = [...best.values()].sort((a, b) => b.score - a.score).slice(0, maxLeaves)
    if (leaves.length) branches.push({ subject, leaves })
    if (branches.length >= maxBranches) break
  }
  return branches
}

