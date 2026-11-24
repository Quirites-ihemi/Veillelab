import { normalize } from './text.js'

// ---------------------------------------------------------------------------
// Recherche par familles de termes (onglets Atlas et Explorer).
//
// Une famille n'est PAS une liste de synonymes stricts : elle sert seulement
// à retrouver des éléments qui emploient un autre mot pour le même sujet
// (« drogue » retrouve « stupéfiants », « cocaïne »…). Elle ne crée aucun lien
// dans le graphe et ne modifie aucune donnée.
// ---------------------------------------------------------------------------
export const SEARCH_FAMILIES = [
  { id: 'drogues', forms: ['drogue', 'stupéfiant', 'narcotrafic', 'cocaïne', 'cannabis', 'héroïne', 'crack', 'opium'] },
  { id: 'ia', forms: ['IA', 'intelligence artificielle'] },
  { id: 'crime-organise', forms: ['crime organisé', 'criminalité organisée'] },
  { id: 'feminicide', forms: ['féminicide', 'violences conjugales', 'violences intrafamiliales', 'au sein du couple'] },
  { id: 'videoprotection', forms: ['vidéoprotection', 'vidéosurveillance'] },
  // Familles validées le 24 novembre 2026.
  { id: 'prison', forms: ['prison', 'carcéral', 'carcérale', 'pénitentiaire', 'détenu'] },
  { id: 'immigration', forms: ['immigration', 'migration', 'migrant', 'étrangers'] },
  { id: 'securite-routiere', forms: ['sécurité routière', 'routier', 'routière', 'route'] },
  { id: 'jeunes', forms: ['jeune', 'mineur', 'adolescent'] },
  { id: 'incendies', forms: ['incendie', 'feux'] },
]

const STOP = new Set(['le', 'la', 'les', 'l', 'de', 'des', 'du', 'd', 'un', 'une', 'et', 'ou', 'en', 'au', 'aux', 'a', 'sur', 'pour', 'dans', 'par', 'avec'])

// Texte comparable : sans accents ni ponctuation ; « narco-trafic » = « narcotrafic ».
export const searchText = value =>
  normalize(String(value || '').replace(/[’']/g, ' '))
    .replace(/-/g, ' ')
    .replace(/\bnarco\s+(trafics?|trafiquants?)\b/g, 'narco$1')
    .replace(/\s+/g, ' ')
    .trim()

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const stem = w => (w.length >= 4 && !/\d/.test(w) ? w.replace(/(?:s|x)$/, '') : w)

// Un mot : forme exacte ou pluriel ; à partir de 5 lettres, début de mot
// (« stupéf » trouve « stupéfiants », « incendi » trouve « incendies »).
const wordPattern = w => {
  const s = stem(w)
  return s.length >= 5 ? `${esc(s)}[a-z0-9]*` : `${esc(s)}(?:s|x|es)?`
}
// Une expression : chaque mot au singulier ou au pluriel, dans l'ordre.
const phrasePattern = phrase => phrase.split(' ').map(w => `${esc(stem(w))}(?:s|x|es)?`).join(' ')
const toRegex = body => new RegExp(`(?:^| )(?:${body})(?= |$)`)

const FAMILY_FORMS = SEARCH_FAMILIES.map(f => ({ ...f, keys: f.forms.map(searchText) }))

/**
 * Prépare une requête. Chaque mot (ou expression d'une famille) doit être
 * présent ; un mot d'une famille est satisfait par n'importe quel terme de
 * cette famille.
 *   test(texte)        → correspondance, familles comprises
 *   testDirect(texte)  → correspondance avec les seuls mots tapés
 *   alsoSearched       → autres termes cherchés, pour l'afficher au lecteur
 */
export function searchMatcher(query) {
  let q = ` ${searchText(query)} `
  const units = []
  const also = []
  // Les expressions de plusieurs mots d'abord (« intelligence artificielle »).
  const candidates = FAMILY_FORMS.flatMap(f => f.keys.map((key, i) => ({ f, key, i })))
    .sort((a, b) => b.key.split(' ').length - a.key.split(' ').length || b.key.length - a.key.length)
  for (const { f, key } of candidates) {
    const re = new RegExp(` ${phrasePattern(key)} `)
    if (!re.test(q)) continue
    q = q.replace(re, ' ')
    units.push({
      direct: toRegex(phrasePattern(key)),
      family: toRegex(f.keys.map(phrasePattern).join('|')),
    })
    f.forms.forEach((form, i) => { if (f.keys[i] !== key && !also.includes(form)) also.push(form) })
  }
  q.split(' ').filter(w => w && !STOP.has(w)).forEach(w => {
    const re = toRegex(wordPattern(w))
    units.push({ direct: re, family: re })
  })
  const run = (text, key) => {
    if (!units.length) return false
    const t = ` ${searchText(text)} `.trim()
    return units.every(u => u[key].test(t))
  }
  return {
    empty: units.length === 0,
    test: text => run(text, 'family'),
    testDirect: text => run(text, 'direct'),
    alsoSearched: also,
  }
}
