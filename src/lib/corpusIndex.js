// Index local de la base pour « Avancer avec le corpus ».
// Tout est calculé à partir des fichiers public/data/*.json chargés par l'application :
// quand la base s'enrichit, les thèmes, les types et tous les nombres suivent
// sans modifier le code.

// --- Thèmes ---------------------------------------------------------------
// Regroupement des domaines de la base (colonne « domaine » des publications)
// en grands thèmes. La première règle dont un mot-clé figure dans le domaine
// l'emporte. Un domaine qui ne correspond à aucune règle devient son propre
// thème, sous son libellé d'origine : rien n'est perdu quand un domaine nouveau
// apparaît. Pour ajuster un regroupement, il suffit de modifier cette liste.
export const THEME_RULES = [
  { label: 'Migrations, intégration, citoyenneté', keys: ['migration', 'integration', 'citoyennete', 'asile'] },
  { label: 'Démocratie et information', keys: ['democrati', 'informationnel', 'desinformation', 'veille strategique'] },
  { label: 'Administration territoriale', keys: ['administration territoriale', 'prefecture', 'territoires'] },
  { label: 'Menaces et sécurité nationale', keys: ['radicalit', 'terroris', 'renseignement', 'contre-espionnage', 'securite nationale', 'prospective', 'defense'] },
  { label: 'Crises et sécurité civile', keys: ['securite civile', 'crise', 'resilience', 'catastrophe'] },
  { label: 'Criminalités et trafics', keys: ['criminalit', 'criminel', 'narcotrafic', 'drogue', 'stupefiant', 'cyber', 'violences', 'homicide', 'trafic'] },
  { label: 'Métiers de la sécurité', keys: ['travail', 'emploi', 'formation', 'metier'] },
  { label: 'Sécurité publique et délinquance', keys: ['securite publique', 'securite routiere', 'maintien de l', 'securite interieure', 'justice', 'mineurs', 'criminologie', 'delinquance'] },
]

// --- Types d'éléments -----------------------------------------------------
// Types proposés à l'utilisateur, dans l'ordre d'affichage. « types » regroupe
// les valeurs de la colonne type_noeud qui relèvent de la même famille.
export const ELEMENT_TYPES = [
  { id: 'tendances', label: 'Tendances', one: 'Tendance', types: ['tendance', 'tendance_forte'] },
  { id: 'recommandations', label: 'Recommandations', one: 'Recommandation', types: ['recommandation'] },
  { id: 'signaux', label: 'Signaux faibles', one: 'Signal faible', types: ['signal_faible'] },
  { id: 'problemes', label: 'Problèmes', one: 'Problème', types: ['probleme', 'Problème'] },
  { id: 'actions', label: 'Actions', one: 'Action', types: ['action'] },
  { id: 'dispositifs', label: 'Dispositifs', one: 'Dispositif', types: ['instrument_dispositif'] },
  { id: 'methodes', label: 'Méthodes', one: 'Méthode', types: ['methode'] },
  { id: 'acteurs', label: 'Acteurs', one: 'Acteur', types: ['acteur'] },
  // Les notions sont le type le plus fréquent du graphe : elles sont cherchées
  // et s'affichent dans leur propre onglet, sans être mises en avant à l'accueil.
  { id: 'notions', label: 'Notions', one: 'Notion', types: ['notion_idee'] },
]
// Types mis en avant dans « Ou par type d’élément » (les autres restent
// accessibles par les onglets des résultats).
export const FEATURED_TYPES = ['tendances', 'recommandations', 'signaux', 'actions', 'dispositifs', 'acteurs']

const TYPE_OF_NODE = new Map(ELEMENT_TYPES.flatMap(group => group.types.map(type => [type, group.id])))
export const typeGroup = id => ELEMENT_TYPES.find(group => group.id === id)

// --- Normalisation et recherche ------------------------------------------
export function normalize(text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
}

const STOP = new Set(['les', 'des', 'une', 'aux', 'dans', 'sur', 'pour', 'par', 'avec', 'que', 'qui', 'quoi', 'est', 'sont', 'ces', 'cette', 'son', 'ses', 'leur', 'leurs', 'entre', 'plus', 'moins', 'comme', 'face', 'quel', 'quels', 'quelle', 'quelles', 'comment', 'pourquoi', 'and', 'the'])

// Texte cherchable : sans accents, en minuscules, et toute ponctuation remplacée
// par une espace, caractère pour caractère. Ainsi « sapeurs-pompiers » contient
// le mot « pompiers », « (IA) » le mot « ia », et les positions restent celles
// du texte d'origine (utile pour centrer l'extrait sur le passage trouvé).
export function searchable(text) {
  let out = ''
  for (const ch of String(text || '')) {
    const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const c = base.charAt(0) || ' '
    out += /[a-z0-9]/.test(c) || base === 'œ' || base === 'æ' ? (base === 'œ' ? 'o' : base === 'æ' ? 'a' : c) : ' '
    // Un caractère d'origine sur deux unités UTF-16 (emoji…) garde la même longueur.
    if (ch.length === 2) out += ' '
  }
  return out
}

export function queryTerms(query) {
  // Pluriels simples : « drogues » cherche aussi « drogue », « élus » « élu », « feux » « feu ».
  const stem = term => term.length >= 4 && !/\d/.test(term) ? term.replace(/(?:s|x)$/, '') : term
  // Les sigles de deux lettres tapés en majuscules (IA, UE…) sont gardés.
  const acronyms = new Set((String(query || '').match(/\b[A-Z]{2}\b/g) || []).map(normalize))
  return [...new Set(searchable(query).split(/\s+/).filter(term => (term.length >= 3 || acronyms.has(term)) && !STOP.has(term)).map(stem))]
}

// Un terme d'au moins 5 lettres correspond s'il commence un mot (« incendi »
// trouve « incendies »). Un terme court doit correspondre à un mot entier, au
// pluriel ou au féminin près : « élu » trouve « élus », pas « élucidation » ;
// « IA » trouve « IA », pas « iatrogène ».
const termRegexCache = new Map()
function termRegex(term) {
  if (!termRegexCache.has(term)) {
    const body = term.length >= 5 ? `${term}[a-z0-9]*` : `${term}(?:s|x|e|es)?`
    termRegexCache.set(term, new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`, 'g'))
  }
  const re = termRegexCache.get(term)
  re.lastIndex = 0
  return re
}

function countTerm(normText, term, cap = 6) {
  const re = termRegex(term)
  let n = 0
  while (n < cap && re.exec(normText)) n += 1
  return n
}

function firstMatch(normText, terms) {
  let best = -1
  for (const term of terms) {
    const re = termRegex(term)
    const m = re.exec(normText)
    if (m && (best < 0 || m.index < best)) best = m.index
  }
  return best
}

// Score : chaque terme trouvé compte, ses répétitions un peu, et l'expression
// exacte tapée par l'utilisateur beaucoup. Les éléments du graphe, courts et
// déjà synthétiques, passent devant les passages à score égal.
function scoreOf(normText, terms, phrase) {
  let score = 0
  for (const term of terms) {
    const n = countTerm(normText, term)
    if (!n) return 0
    score += 10 + Math.min(n, 6)
  }
  if (terms.length > 1) {
    if (phrase && normText.includes(phrase)) score += 25
    else if (closeTogether(normText, terms)) score += 12
    else score -= 15 // mots présents mais éloignés : probablement un autre sujet
  }
  return score
}

// Vrai si tous les termes apparaissent dans une fenêtre de 12 mots.
function closeTogether(normText, terms, window = 12) {
  const words = normText.split(' ').filter(Boolean)
  const hits = terms.map(term => {
    const re = new RegExp(termRegex(term).source)
    return words.map((w, i) => (re.test(w) ? i : -1)).filter(i => i >= 0)
  })
  if (hits.some(list => !list.length)) return false
  return hits[0].some(i => hits.every(list => list.some(j => Math.abs(j - i) <= window)))
}

function pagesLabel(raw) {
  const value = String(raw || '').trim()
  if (!value) return ''
  if (/^\d+(?:;\d+)*$/.test(value)) {
    const pages = value.split(';')
    return `p. ${pages.slice(0, 4).join(', ')}${pages.length > 4 ? '…' : ''}`
  }
  if (/^\d{1,2}:\d{2}/.test(value)) return `timecode ${value.split(';')[0]}`
  return value
}

// --- Construction de l'index ----------------------------------------------
export function buildCorpusIndex(data) {
  const publications = Array.isArray(data?.publications) ? data.publications : []
  const nodes = Array.isArray(data?.nodes) ? data.nodes : []
  const contents = Array.isArray(data?.contents) ? data.contents : []

  const pubById = new Map(publications.map(pub => [pub.publication_id, pub]))
  const pubIdsWithContent = new Set([...nodes.map(n => n.publication_id), ...contents.map(c => c.publication_id)])

  const themeOfDomain = domain => {
    const norm = normalize(domain)
    if (!norm.trim()) return 'Autres publications'
    const rule = THEME_RULES.find(item => item.keys.some(key => norm.includes(key)))
    return rule ? rule.label : String(domain).trim()
  }

  const pubInfo = pub => ({
    publication_id: pub.publication_id,
    publication_title: pub.titre || pub.publication_id,
    organisme_producteur: pub.organisme_producteur || '',
    annee_publication: pub.année_publication || pub.annee_publication || '',
    url_contenu: pub.url_contenu || '',
    url_source: pub.url_source || '',
    domaine: pub.domaine || '',
  })

  // Publications retenues : celles qui ont au moins un élément ou un passage.
  const pubs = publications
    .filter(pub => pubIdsWithContent.has(pub.publication_id))
    .map(pub => ({ ...pubInfo(pub), theme: themeOfDomain(pub.domaine), title: displayTitle(pub.titre || pub.publication_id) }))
  const pubMap = new Map(pubs.map(pub => [pub.publication_id, pub]))

  const elements = []
  nodes.forEach(node => {
    const group = TYPE_OF_NODE.get(node.type_noeud)
    const pub = pubMap.get(node.publication_id)
    if (!group || !pub || !String(node.libelle || '').trim()) return
    elements.push({
      material_id: `node:${node.node_id}`,
      node_id: node.node_id,
      node_type: node.type_noeud,
      group,
      label: String(node.libelle).trim(),
      page_source: node.page_source || '',
      pages: pagesLabel(node.page_source),
      ...pubInfo(pubById.get(node.publication_id)),
      theme: pub.theme,
      _norm: searchable(`${node.libelle} ${node.libelle_normalise || ''}`),
    })
  })

  const passages = contents
    .filter(chunk => pubMap.has(chunk.publication_id) && String(chunk.texte || '').trim())
    .map(chunk => ({
      material_id: `chunk:${chunk.chunk_id}`,
      chunk_id: chunk.chunk_id,
      text: String(chunk.texte).trim(),
      page_debut: chunk.page_debut || '',
      page_fin: chunk.page_fin || '',
      pages: chunk.page_debut ? (chunk.page_fin && chunk.page_fin !== chunk.page_debut ? `p. ${chunk.page_debut}–${chunk.page_fin}` : `p. ${chunk.page_debut}`) : '',
      section: chunk.section || '',
      ...pubInfo(pubById.get(chunk.publication_id)),
      theme: pubMap.get(chunk.publication_id).theme,
      _norm: searchable(chunk.texte),
    }))

  // Thèmes : du plus fourni au moins fourni.
  const themeMap = new Map()
  pubs.forEach(pub => {
    if (!themeMap.has(pub.theme)) themeMap.set(pub.theme, [])
    themeMap.get(pub.theme).push(pub)
  })
  const themes = [...themeMap.entries()]
    .map(([label, list]) => ({ label, publications: list.sort((a, b) => a.title.localeCompare(b.title, 'fr')) }))
    .sort((a, b) => b.publications.length - a.publications.length || a.label.localeCompare(b.label, 'fr'))

  const typeStats = ELEMENT_TYPES.map(group => {
    const list = elements.filter(el => el.group === group.id)
    return { ...group, count: list.length, pubCount: new Set(list.map(el => el.publication_id)).size }
  })

  return {
    pubs,
    pubMap,
    themes,
    elements,
    passages,
    typeStats,
    totals: {
      publications: pubs.length,
      passages: passages.length,
      acteurs: elements.filter(el => el.group === 'acteurs').length,
      actions: elements.filter(el => el.group === 'actions').length,
    },
  }
}

// Titres : la base contient souvent des titres en minuscules.
function displayTitle(title) {
  const value = String(title || '').trim()
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

// --- Sélections -------------------------------------------------------------
// Chaque sélection produit le même format de résultat :
// { title, subtitle, publications: [...], elements: [...], passages: [...] }
function pubsOf(index, items) {
  const ids = [...new Set(items.map(item => item.publication_id))]
  return ids.map(id => index.pubMap.get(id)).filter(Boolean)
}

export function selectTheme(index, themeLabel) {
  const theme = index.themes.find(item => item.label === themeLabel)
  const ids = new Set((theme?.publications || []).map(pub => pub.publication_id))
  return {
    kind: 'theme',
    title: themeLabel,
    publications: theme?.publications || [],
    elements: index.elements.filter(el => ids.has(el.publication_id)),
    passages: [],
  }
}

export function selectPublication(index, publicationId) {
  const pub = index.pubMap.get(publicationId)
  return {
    kind: 'publication',
    title: pub?.title || publicationId,
    subtitle: [pub?.organisme_producteur, pub?.annee_publication].filter(Boolean).join(' · '),
    publication: pub,
    publications: pub ? [pub] : [],
    elements: index.elements.filter(el => el.publication_id === publicationId),
    passages: [],
  }
}

export function selectType(index, groupId) {
  const group = typeGroup(groupId)
  const elements = index.elements.filter(el => el.group === groupId)
  return {
    kind: 'type',
    groupId,
    title: group?.label || groupId,
    publications: pubsOf(index, elements),
    elements,
    passages: [],
  }
}

// Recherche : tous les mots doivent figurer dans l'élément ou le passage.
// Les résultats sont classés du plus pertinent au moins pertinent, et les
// publications selon ce qu'elles apportent sur le sujet (titre compris).
export function searchIndex(index, query) {
  const terms = queryTerms(query)
  if (!terms.length) return { kind: 'search', title: query, query, terms, publications: [], elements: [], passages: [], tooShort: true }
  const phrase = terms.length > 1 ? ` ${searchable(query).split(/\s+/).filter(Boolean).join(' ')} `.replace(/\s+/g, ' ') : ''
  const rank = (list, bonus) => list
    .map(item => ({ item, score: scoreOf(` ${item._norm} `.replace(/\s+/g, ' '), terms, phrase) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(entry => ({ ...entry.item, _score: entry.score + bonus }))
  const elements = rank(index.elements, 5)
  const passages = rank(index.passages, 0).map(p => ({ ...p, excerpt: excerptAround(p.text, p._norm, terms) }))
  const pubScore = new Map()
  const add = (id, value) => pubScore.set(id, (pubScore.get(id) || 0) + value)
  index.pubs.forEach(pub => {
    const score = scoreOf(` ${searchable(pub.title)} `.replace(/\s+/g, ' '), terms, phrase)
    if (score) add(pub.publication_id, 100 + score)
  })
  // Une publication vaut par son meilleur élément ou passage, puis un peu par
  // leur nombre : beaucoup de mentions éparses ne passent pas devant un apport précis.
  const best = new Map(), count = new Map()
  ;[...elements, ...passages].forEach(item => {
    best.set(item.publication_id, Math.max(best.get(item.publication_id) || 0, item._score))
    count.set(item.publication_id, (count.get(item.publication_id) || 0) + 1)
  })
  best.forEach((value, id) => add(id, value + 2 * Math.min(count.get(id), 10)))
  const publications = [...pubScore.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => index.pubMap.get(id))
    .filter(Boolean)
  return { kind: 'search', title: query, query, terms, publications, elements, passages }
}

// Extrait d'environ 320 caractères centré sur le premier mot trouvé, pour que
// l'utilisateur voie d'emblée pourquoi le passage est proposé.
export function excerptAround(text, normText, terms, max = 320) {
  const value = String(text || '')
  if (value.length <= max) return value.replace(/\s+/g, ' ').trim()
  const at = firstMatch(normText, terms)
  if (at < 0) return `${value.slice(0, max).replace(/\s+/g, ' ').trim()}…`
  let start = Math.max(0, at - 90)
  if (start > 0) {
    const space = value.indexOf(' ', start)
    start = space > 0 && space < at ? space + 1 : start
  }
  const end = Math.min(value.length, start + max)
  return `${start > 0 ? '…' : ''}${value.slice(start, end).replace(/\s+/g, ' ').trim()}${end < value.length ? '…' : ''}`
}
