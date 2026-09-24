import React, { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { runReflectionAction, searchReflectionCorpus } from '../services/reflectionApi.js'
import './reflection-workspace.css'
import heroImage from '../header-corpus-securite.png'

const NEEDS = [
  {
    id: 'overview',
    label: 'Comprendre rapidement ce que le corpus contient sur un thème',
    description: 'Obtenir une vue d’ensemble des angles abordés, publications, acteurs, territoires et principaux éléments présents dans le corpus.',
    placeholder: 'Sur quel thème souhaitez-vous faire le point ?',
    submitLabel: 'Explorer le thème',
    icon: 'book',
    tone: 'blue',
    advice: 'Une faible présence dans les résultats peut traduire une faible couverture du corpus, pas une faible importance du phénomène.',
  },
  {
    id: 'precise',
    label: 'Trouver une information précise dans le corpus',
    description: 'Chercher un fait, un chiffre, un concept, un dispositif, un acteur ou une information ciblée.',
    placeholder: 'Quelle information recherchez-vous précisément ?',
    submitLabel: 'Chercher dans le corpus',
    icon: 'search',
    tone: 'yellow',
    advice: 'L’absence de résultat ne signifie pas nécessairement que l’information n’existe pas : elle peut être formulée autrement ou ne pas être couverte par le corpus.',
  },
  {
    id: 'trends',
    label: 'Voir ce qui évolue ou émerge',
    description: 'Repérer les évolutions, récurrences et signaux présents dans les sujets couverts par le corpus.',
    placeholder: 'Sur quel sujet souhaitez-vous repérer des évolutions ou des signaux ?',
    submitLabel: 'Repérer les évolutions',
    icon: 'graph',
    tone: 'green',
    advice: 'Une évolution dans le corpus n’est pas automatiquement une évolution du phénomène lui-même. Vérifiez notamment les périodes et la composition des sources mobilisées.',
  },
  {
    id: 'actors',
    label: 'Identifier les acteurs concernés et leur rôle',
    description: 'Repérer les acteurs mentionnés dans les publications et la manière dont leur rôle y est décrit.',
    placeholder: 'Sur quel sujet souhaitez-vous identifier les acteurs ?',
    submitLabel: 'Identifier les acteurs',
    icon: 'target',
    tone: 'coral',
    advice: 'Le rôle affiché correspond à la manière dont l’acteur est décrit dans les publications du corpus ; il ne résume pas nécessairement l’ensemble de ses compétences.',
  },
  {
    id: 'public-action',
    label: 'Voir comment l’action publique répond au problème',
    description: 'Identifier, dans les sujets couverts, les dispositifs, instruments, acteurs de mise en œuvre et modalités d’action déjà documentés.',
    placeholder: 'Quel problème ou sujet d’action publique souhaitez-vous explorer ?',
    submitLabel: 'Explorer l’action publique',
    icon: 'building',
    tone: 'lilac',
    advice: 'Le corpus montre uniquement les réponses d’action publique documentées par les publications présentes ; il ne constitue pas un inventaire exhaustif des dispositifs existants.',
  },
]

const CARD_TYPES = [
  { id: 'question', label: 'Question', tone: 'blue', icon: '?', placeholder: 'Quelle question souhaitez-vous poser ?' },
  { id: 'idea', label: 'Idée / hypothèse', tone: 'yellow', icon: '✦', placeholder: 'Formulez votre idée ou votre hypothèse…' },
  { id: 'note', label: 'Note', tone: 'lilac', icon: '✎', placeholder: 'Ajoutez une observation, une piste ou un rappel…' },
  { id: 'check', label: 'Point à vérifier', tone: 'green', icon: '✓', placeholder: 'Quel point souhaitez-vous vérifier plus tard ?' },
]

const LINK_LABELS = ['est lié à', 'appuie', 'nuance', 'questionne', '']
const STORAGE_KEY = 'quirites:reflection-workspace:v2'
const LEGACY_STORAGE_KEY = 'quirites:reflection-canvas:v1'
const ECLAIREUR_IDLE_MS = 30000

function normalizeMaterialId(value) {
  const text = String(value || '').trim()
  if (!text) return null
  if (/^(chunk|node|relation):/i.test(text)) return text
  if (/^C\d+/i.test(text)) return `chunk:${text}`
  if (/^N\d+/i.test(text)) return `node:${text}`
  if (/^R\d+/i.test(text)) return `relation:${text}`
  return null
}

function materialIdOf(material) {
  if (!material) return null
  if (material.material_id) return normalizeMaterialId(material.material_id)
  if (material.result_id) return normalizeMaterialId(material.result_id)
  if (material.chunk_id) return normalizeMaterialId(material.chunk_id)
  if (material.node_id) return normalizeMaterialId(material.node_id)
  if (material.relation_id) return normalizeMaterialId(material.relation_id)
  if (material.id) return normalizeMaterialId(material.id)
  return null
}

function publicationOf(material) {
  return material?.publication || material?.source_publication || null
}

function publicationMeta(material) {
  const pub = publicationOf(material) || {}
  return {
    id: material?.publication_id || pub.publication_id || '',
    title: material?.publication_title || pub.title || pub.titre || '',
    organisation: material?.organisme_producteur || pub.organisme_producteur || '',
    year: material?.annee_publication || material?.année_publication || pub.annee_publication || pub.année_publication || '',
    urlSource: material?.url_source || pub.url_source || '',
    urlContent: material?.url_contenu || pub.url_contenu || '',
  }
}

function provenanceLevelOf(material) {
  return material?.provenance_level || material?.provenance?.level || ''
}

function materialText(material) {
  if (!material) return ''
  if (material?.content?.text) return material.content.text
  if (material?.text) return material.text
  if (material?.label) return material.label
  if (material?.libelle) return material.libelle
  if (material?.formulation) return material.formulation
  if (material?.source_label || material?.target_label) return `${material.source_label || ''} — ${material.relation_type || 'relation'} → ${material.target_label || ''}`
  if (material?.source?.label || material?.target?.label) return `${material.source?.label || ''} — ${material.relation_type || 'relation'} → ${material.target?.label || ''}`
  return material?.selected_material?.text || ''
}

function locatorOf(material) {
  if (material?.page_debut || material?.page_fin) {
    const start = String(material.page_debut || '').trim()
    const end = String(material.page_fin || '').trim()
    if (start && end && start !== end) return { label: `p. ${start}–${end}`, page: start }
    if (start || end) return { label: `p. ${start || end}`, page: start || end }
  }
  const raw = String(material?.provenance?.source_locator || material?.provenance?.locator || material?.locator || material?.page_source || '').trim()
  if (!raw) return null
  if (/^\d+$/.test(raw)) return { label: `p. ${raw}`, page: raw }
  if (/^\d+(?:;\d+)+$/.test(raw)) return { label: `p. ${raw.split(';').join(', ')}`, page: raw.split(';')[0] }
  if (/^\d{1,2}:\d{2}/.test(raw)) return { label: `timecode ${raw}`, page: null }
  return { label: `repère ${raw}`, page: null }
}

function materialKind(material) {
  const id = materialIdOf(material)
  if (id?.startsWith('chunk:')) return 'Extrait'
  if (id?.startsWith('relation:')) return 'Relation'
  if (id?.startsWith('node:')) {
    const type = material?.node_type || material?.content?.node_type || ''
    if (type === 'acteur' || type === 'expert_public') return 'Acteur'
    if (type === 'tendance') return 'Tendance'
    if (type === 'signal_faible') return 'Signal faible'
    if (type === 'action') return 'Action'
    if (type === 'instrument_dispositif') return 'Instrument / dispositif'
    return type ? type.replaceAll('_', ' ') : 'Élément du graphe'
  }
  return 'Élément du corpus'
}

function shortText(text, max = 290) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  return value.length > max ? `${value.slice(0, max).trim()}…` : value
}


function normalizeProofText(text) {
  const raw = String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v]+/g, ' ')
    .trim()
  if (!raw) return []

  const lines = raw.split('\n').map(line => line.replace(/[ ]{2,}/g, ' ').trim())
  const blocks = []
  let paragraph = []
  let activeBulletIndex = -1

  const flushParagraph = () => {
    const value = paragraph.join(' ').replace(/\s+/g, ' ').trim()
    if (value) blocks.push({ type: 'paragraph', text: value })
    paragraph = []
  }
  const isBullet = line => /^(?:[•▪◦‣–—-]|\d+[.)])\s+/.test(line)
  const looksLikeHeading = line => {
    if (!line || line.length > 120) return false
    if (/^[A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜ0-9][A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜ0-9 '\-–—,:;()]{5,}$/.test(line) && /[A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜ]/.test(line)) return true
    return /^(?:introduction|conclusion|constat|constats|enjeu|enjeux|méthode|méthodologie|résultat|résultats|recommandation|recommandations|proposition|propositions|synthèse|focus|encadré)\s*:?$/i.test(line)
  }

  lines.forEach(line => {
    if (!line) {
      flushParagraph()
      activeBulletIndex = -1
      return
    }
    if (isBullet(line)) {
      flushParagraph()
      blocks.push({ type: 'bullet', text: line.replace(/^(?:[•▪◦‣–—-]|\d+[.)])\s+/, '').trim() })
      activeBulletIndex = blocks.length - 1
      return
    }
    if (looksLikeHeading(line)) {
      flushParagraph()
      activeBulletIndex = -1
      blocks.push({ type: 'heading', text: line })
      return
    }
    if (activeBulletIndex >= 0 && blocks[activeBulletIndex]?.type === 'bullet') {
      blocks[activeBulletIndex].text = `${blocks[activeBulletIndex].text} ${line}`.replace(/\s+/g, ' ').trim()
      return
    }
    paragraph.push(line)
  })
  flushParagraph()

  // Deuxième passe : certains PDF insèrent des lignes blanches au milieu d'une
  // même phrase. On ne fusionne que les fragments dont la continuité est sûre
  // (ponctuation non terminale, phrase manifestement inachevée ou reprise en
  // minuscule). Le texte lui-même n'est jamais réécrit.
  const readable = []
  const shouldMerge = (previous, next) => {
    if (!previous || !next || previous.type !== 'paragraph' || next.type !== 'paragraph') return false
    const a = previous.text.trim()
    const b = next.text.trim()
    if (!a || !b) return false
    if (/[,;:–—-]$/.test(a)) return true
    if (!/[.!?…»)”']$/.test(a)) return true
    if (/^[a-zàâäçéèêëîïôöùûü]/.test(b)) return true
    return false
  }
  blocks.forEach(block => {
    const previous = readable[readable.length - 1]
    if (shouldMerge(previous, block)) previous.text = `${previous.text} ${block.text}`.replace(/\s+/g, ' ').trim()
    else readable.push({ ...block })
  })
  return readable
}

function ProofText({ text }) {
  const blocks = normalizeProofText(text)
  if (!blocks.length) return null
  const items = []
  let bulletGroup = []
  const flushBullets = key => {
    if (!bulletGroup.length) return
    items.push(<ul key={`proof-list-${key}`} className="qvl-proof-list">{bulletGroup.map((value, index) => <li key={`${key}-${index}`}>{value}</li>)}</ul>)
    bulletGroup = []
  }
  blocks.forEach((block, index) => {
    if (block.type === 'bullet') {
      bulletGroup.push(block.text)
      return
    }
    flushBullets(index)
    if (block.type === 'heading') items.push(<h4 key={`proof-heading-${index}`}>{block.text}</h4>)
    else items.push(<p key={`proof-paragraph-${index}`}>{block.text}</p>)
  })
  flushBullets('end')
  return <div className="qvl-proof-text">{items}</div>
}

function isPdfUrl(url) {
  return /\.pdf(?:$|[?#])/i.test(String(url || ''))
}

function sourceUrlOf(material) {
  const meta = publicationMeta(material)
  const primary = meta.urlContent || meta.urlSource
  if (!primary) return ''
  const locator = locatorOf(material)
  if (isPdfUrl(primary) && locator?.page) {
    const clean = primary.replace(/#.*$/, '')
    return `${clean}#page=${locator.page}`
  }
  return primary
}

function sourceButtonLabel(material) {
  const meta = publicationMeta(material)
  return isPdfUrl(meta.urlContent) ? 'Ouvrir le document' : 'Ouvrir la source'
}

function makeCanvasCard({ kind = 'Note', title = '', text = '', tone = 'lilac', material = null, x = null, y = null }) {
  const now = Date.now()
  return {
    id: `card-${now}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    title,
    text,
    tone,
    material,
    materialId: materialIdOf(material),
    x: x ?? 64,
    y: y ?? 72,
    collapsed: false,
    createdAt: now,
  }
}

function restoreWorkspace() {
  try {
    const current = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
    if (current && Array.isArray(current.cards)) {
      return {
        cards: current.cards.map(card => ({ ...card, title: String(card?.title || ''), collapsed: Boolean(card.collapsed) })),
        links: Array.isArray(current.links) ? current.links : [],
        activeSubject: String(current.activeSubject || ''),
      }
    }
    const legacy = JSON.parse(sessionStorage.getItem(LEGACY_STORAGE_KEY) || 'null')
    if (Array.isArray(legacy)) return { cards: legacy.map(card => ({ ...card, title: String(card?.title || ''), collapsed: false })), links: [], activeSubject: '' }
  } catch {}
  return { cards: [], links: [], activeSubject: '' }
}

function buildCanvasContext(cards, selectedIds = []) {
  const selected = new Set(selectedIds || [])
  return (cards || [])
    .filter(card => !card?.materialId)
    .map(card => ({
      title: String(card?.title || '').trim(),
      kind: String(card?.kind || '').trim(),
      text: String(card?.text || '').replace(/\s+/g, ' ').trim().slice(0, 420),
      selected: selected.has(card.id),
      createdAt: Number(card?.createdAt || 0),
    }))
    .filter(card => card.title || card.text)
    .sort((a, b) => Number(b.selected) - Number(a.selected) || b.createdAt - a.createdAt)
    .slice(0, 10)
    .map(({ createdAt, ...card }) => card)
}

function needSearchConfig(needId, query) {
  const clean = query.trim()
  // La requête de l’utilisateur reste intacte : on ne lui ajoute plus des mots
  // génériques ("acteur", "tendance", "dispositif") qui dégradaient fortement
  // le rappel sur le moteur lexical. La spécialisation se fait ensuite par
  // classement des matériaux effectivement trouvés dans le corpus.
  if (needId === 'precise') return { query: clean, options: { limit: 24, maxPerPublication: 6, diversifyByPublication: false } }
  if (needId === 'overview') return { query: clean, options: { limit: 30, maxPerPublication: 3, diversifyByPublication: true } }
  return { query: clean, options: { limit: 30, maxPerPublication: 8, diversifyByPublication: false } }
}

function nodeTypeOf(material) {
  return String(material?.node_type || material?.content?.node_type || '').trim().toLowerCase()
}

function relationTypeOf(material) {
  return String(material?.relation_type || material?.content?.relation_type || '').trim().toUpperCase()
}

const ACTOR_RELATIONS = new Set([
  'S_APPUIE_SUR','MOBILISE','MET_EN_OEUVRE','PILOTE','ENCADRE','MENE',
  'INTERVIENT_SUR','INTERVIENT_DANS_LA_PRISE_EN_CHARGE_DE','EXPERTISE_SUR',
  'SE_POSITIONNE_SUR','EST_DESTINATAIRE_DE','CONCERNES_PAR','PARTICIPE_A',
  'ACCOMPAGNE','SOUTIENT','FINANCE','CODEVELOPPE'
])

const PUBLIC_ACTION_RELATIONS = new Set([
  'REPOND_A','MET_EN_OEUVRE','S_APPUIE_SUR','MOBILISE','PERMET_DE','INSTITUE',
  'DEVELOPPE','RENFORCE','ENCADRE','PILOTE','PRECONISE','CONTRIBUE_A',
  'CONDITION_DE_REUSSITE_DE'
])

const TREND_RELATIONS = new Set([
  'FAIT_SUITE_A','ILLUSTRE','OBSERVEE_DANS','CARACTERISE','SE_MANIFESTE_PAR',
  'TAUX_ELEVE_DE','TAUX_FAIBLE_DE','RENFORCE','INFLUENCE'
])

function needPriority(needId, material) {
  const nodeType = nodeTypeOf(material)
  const relationType = relationTypeOf(material)
  const kind = String(material?.kind || '').toLowerCase()
  const text = `${materialText(material)} ${material?.section || ''}`

  if (needId === 'actors') {
    if (['acteur', 'expert_public'].includes(nodeType)) return 100
    if (kind === 'relation' && ACTOR_RELATIONS.has(relationType)) return 80
    if (/(minist[eè]re|office|agence|direction|service|police|gendarmerie|collectivit[a-zàâäéèêëîïôöùûüç-]*|association|observatoire|pr[eé]fet|op[eé]rateur)/i.test(text)) return 55
    return 10
  }

  if (needId === 'public-action') {
    if (['action', 'instrument_dispositif'].includes(nodeType)) return 100
    if (kind === 'relation' && PUBLIC_ACTION_RELATIONS.has(relationType)) return 80
    if (nodeType === 'recommandation') return 45
    if (/(dispositif|programme|plan|mesure|mise en œuvre|mise en oeuvre|exp[eé]riment[a-zàâäéèêëîïôöùûüç-]*|politique publique|strat[eé]gie|contr[oô]le|accompagnement)/i.test(text)) return 55
    return 10
  }

  if (needId === 'trends') {
    if (['tendance', 'signal_faible'].includes(nodeType)) return 100
    if (kind === 'relation' && TREND_RELATIONS.has(relationType)) return 75
    if (/(tendance|signal faible|[eé]volu[a-zàâäéèêëîïôöùûüç-]*|[eé]merg[a-zàâäéèêëîïôöùûüç-]*|hausse|baisse|augment[a-zàâäéèêëîïôöùûüç-]*|diminu[a-zàâäéèêëîïôöùûüç-]*|progress[a-zàâäéèêëîïôöùûüç-]*|recul|nouveau|nouvelle|r[eé]cent[a-zàâäéèêëîïôöùûüç-]*|depuis|entre 20)/i.test(text)) return 60
    return 10
  }

  return 50
}

function visibleResultsForNeed(needId, result) {
  const all = Array.isArray(result?.results) ? result.results : (Array.isArray(result?.materials) ? result.materials : [])
  if (needId === 'overview' || needId === 'precise') return all

  // Les besoins spécialisés ne doivent pas afficher exactement la même liste
  // que la recherche générique. On conserve uniquement les matériaux dont
  // la structure ou le texte apporte réellement quelque chose au besoin choisi.
  const threshold = needId === 'public-action' ? 55 : 55
  return all
    .map((item, index) => ({ item, index, priority: needPriority(needId, item) }))
    .filter(entry => entry.priority >= threshold)
    .sort((a, b) => b.priority - a.priority || Number(b.item?.score || 0) - Number(a.item?.score || 0) || a.index - b.index)
    .map(entry => entry.item)
}

function cardCenter(card) {
  const width = 260
  const height = card.collapsed ? 68 : (card.title ? 198 : 176)
  return { x: Number(card.x || 0) + width / 2, y: Number(card.y || 0) + height / 2 }
}

export default function ReflectionWorkspaceV1({ onBack }) {
  const initial = useMemo(restoreWorkspace, [])
  const [cards, setCards] = useState(initial.cards)
  const [links, setLinks] = useState(initial.links)
  const [activeSubject, setActiveSubject] = useState(initial.activeSubject || '')
  const [selectedIds, setSelectedIds] = useState([])
  const [activeNeedId, setActiveNeedId] = useState('overview')
  const [resultNeedId, setResultNeedId] = useState('overview')
  const [manualQuery, setManualQuery] = useState('')
  const [freeSearchOpen, setFreeSearchOpen] = useState(false)
  const [searchContext, setSearchContext] = useState(null)
  const [searchResult, setSearchResult] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [composer, setComposer] = useState(null)
  const [draft, setDraft] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [linkMode, setLinkMode] = useState(false)
  const [linkLabel, setLinkLabel] = useState('est lié à')
  const [showLinks, setShowLinks] = useState(false)
  const [proofState, setProofState] = useState({ open: false, loading: false, error: '', material: null, result: null })
  const [editingCardId, setEditingCardId] = useState(null)
  const [editDraft, setEditDraft] = useState({ title: '', text: '' })
  const [eclaireur, setEclaireur] = useState({ open: false, step: null })
  const canvasRef = useRef(null)
  const cardEditRef = useRef(null)
  const dragRef = useRef(null)
  const searchInputRef = useRef(null)
  const searchRequestRef = useRef(0)
  const eclaireurIdleRef = useRef(null)

  const activeNeed = NEEDS.find(item => item.id === activeNeedId) || NEEDS[0]
  const resultNeed = NEEDS.find(item => item.id === resultNeedId) || NEEDS[0]
  const selectedCards = useMemo(() => cards.filter(card => selectedIds.includes(card.id)), [cards, selectedIds])
  const visibleResults = useMemo(() => visibleResultsForNeed(resultNeedId, searchResult), [resultNeedId, searchResult])

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ cards, links, activeSubject })) } catch {}
  }, [cards, links, activeSubject])

  useEffect(() => {
    let listening = true
    const stopListening = () => {
      if (!listening) return
      listening = false
      if (eclaireurIdleRef.current) {
        window.clearTimeout(eclaireurIdleRef.current)
        eclaireurIdleRef.current = null
      }
      ;['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(name => window.removeEventListener(name, onActivity))
    }
    const onActivity = () => stopListening()
    ;['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(name => window.addEventListener(name, onActivity, { passive: true }))
    eclaireurIdleRef.current = window.setTimeout(() => {
      if (!listening) return
      setEclaireur({ open: true, step: 'intro' })
      stopListening()
    }, ECLAIREUR_IDLE_MS)
    return stopListening
  }, [])

  useEffect(() => {
    if (searchContext?.source !== 'canvas') return
    const expected = [...(searchContext.cardIds || [])].sort().join('|')
    const current = [...selectedIds].sort().join('|')
    if (expected && expected !== current) {
      searchRequestRef.current += 1
      setSearchLoading(false)
      setSearchResult(null)
      setSearchError('')
      setSearchContext(null)
    }
  }, [selectedIds, searchContext])

  useEffect(() => {
    const onMove = event => {
      const drag = dragRef.current
      if (!drag || !canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const maxX = Math.max(12, rect.width - drag.width - 12)
      const maxY = Math.max(12, rect.height - drag.height - 12)
      const x = Math.min(maxX, Math.max(12, event.clientX - rect.left - drag.offsetX))
      const y = Math.min(maxY, Math.max(12, event.clientY - rect.top - drag.offsetY))
      setCards(list => list.map(card => card.id === drag.id ? { ...card, x, y } : card))
    }
    const onUp = () => {
      dragRef.current = null
      document.body.classList.remove('qvl-reflection-dragging')
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  const closeEclaireur = () => setEclaireur({ open: false, step: null })

  const guideTo = step => {
    if (step === 'needs') setLeftCollapsed(false)
    if (step === 'results') setRightCollapsed(false)
    setEclaireur({ open: true, step })
    window.setTimeout(() => {
      const selector = step === 'cards' ? '.qvl-canvas-toolbar' : step === 'needs' ? '.qvl-reflection-left' : step === 'results' ? '.qvl-reflection-right' : null
      if (selector) document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 30)
  }

  const executeNeedSearch = async (needId, rawQuery, context = {}) => {
    const clean = String(rawQuery || '').trim()
    if (!clean) return

    const requestId = ++searchRequestRef.current
    setResultNeedId(needId)
    setSearchContext({
      source: context.source || 'guided',
      cardIds: Array.isArray(context.cardIds) ? context.cardIds : [],
      query: clean,
    })
    setSearchLoading(true)
    setSearchError('')
    setSearchResult(null)
    try {
      const config = needSearchConfig(needId, clean)
      const result = await searchReflectionCorpus(config.query, {
        ...config.options,
        needId,
        contextSubject: activeSubject,
        canvasContext: buildCanvasContext(cards, context.cardIds || selectedIds),
      })
      if (requestId === searchRequestRef.current) {
        setSearchResult(result)
        setRightCollapsed(false)
        setEclaireur({ open: true, step: 'results' })
        const resolvedSubject = String(result?.interpretation?.subject_query || '').trim()
        if (resolvedSubject) setActiveSubject(resolvedSubject)
      }
    } catch (error) {
      if (requestId === searchRequestRef.current) setSearchError(error?.message || String(error))
    } finally {
      if (requestId === searchRequestRef.current) setSearchLoading(false)
    }
  }

  const chooseNeed = id => {
    setActiveNeedId(id)
    setSearchError('')
    setRightCollapsed(false)
    setEclaireur({ open: true, step: 'results' })
    setFreeSearchOpen(false)
    setManualQuery('')

    // Le besoin informationnel travaille d'abord à partir du canevas courant.
    // Une ancienne question libre ne doit jamais prendre le pas sur le post-it sélectionné.
    const cardsToUse = selectedCards.length
      ? selectedCards
      : (cards.length === 1 ? cards : [])

    if (!selectedCards.length && cards.length === 1) setSelectedIds([cards[0].id])

    const canvasQuery = cardsToUse
      .map(card => {
        const title = String(card?.title || '').trim()
        const text = String(card?.text || '').trim()
        return [title, text].filter(Boolean).join(' — ')
      })
      .filter(Boolean)
      .slice(0, 2)
      .join(' ; ')
      .trim()

    if (canvasQuery) {
      executeNeedSearch(id, canvasQuery, { source: 'canvas', cardIds: cardsToUse.map(card => card.id) })
      return
    }

    // Aucun post-it exploitable : on annule toute ancienne réponse pour éviter
    // qu'elle soit confondue avec le nouveau besoin sélectionné.
    searchRequestRef.current += 1
    setSearchLoading(false)
    setSearchResult(null)
    setSearchContext({ source: 'awaiting-card', cardIds: [], query: '' })
  }

  const runManualSearch = event => {
    event?.preventDefault()
    const clean = manualQuery.trim()
    if (!clean || searchLoading) return
    setEclaireur({ open: true, step: 'results' })
    executeNeedSearch('precise', clean, { source: 'manual', cardIds: [] })
  }

  const beginComposer = type => {
    closeEclaireur()
    if (type === 'corpus') {
      setRightCollapsed(false)
      setFreeSearchOpen(true)
      setTimeout(() => document.querySelector('.qvl-free-search textarea')?.focus(), 0)
      return
    }
    const cardType = CARD_TYPES.find(item => item.id === type)
    if (!cardType) return
    setComposer(cardType)
    setDraft('')
    setDraftTitle('')
    setTimeout(() => document.querySelector('.qvl-canvas-composer textarea')?.focus(), 0)
  }

  const addDraft = () => {
    if (!composer || !draft.trim()) return
    const index = cards.length
    const card = makeCanvasCard({
      kind: composer.label,
      title: draftTitle.trim(),
      text: draft.trim(),
      tone: composer.tone,
      x: 58 + (index % 3) * 276,
      y: 76 + (Math.floor(index / 3) % 4) * 190,
    })
    setCards(list => [...list, card])
    setSelectedIds([card.id])
    setComposer(null)
    setDraft('')
    setDraftTitle('')
    window.setTimeout(() => guideTo('needs'), 80)
  }

  const addMaterialToCanvas = material => {
    const text = materialText(material)
    if (!text) return
    const index = cards.length
    const card = makeCanvasCard({
      kind: 'Élément du corpus',
      text,
      tone: 'sand',
      material,
      x: 76 + (index % 3) * 276,
      y: 86 + (Math.floor(index / 3) % 4) * 190,
    })
    setCards(list => [...list, card])
    setSelectedIds([card.id])
  }

  const deleteCard = id => {
    setCards(list => list.filter(card => card.id !== id))
    setSelectedIds(ids => ids.filter(value => value !== id))
    setLinks(list => list.filter(link => link.source !== id && link.target !== id))
    if (editingCardId === id) cancelCardEdit()
  }

  const toggleCardCollapsed = id => {
    setCards(list => list.map(card => card.id === id ? { ...card, collapsed: !card.collapsed } : card))
  }

  const beginCardEdit = card => {
    setEditingCardId(card.id)
    setEditDraft({ title: String(card.title || ''), text: String(card.text || '') })
    setLinkMode(false)
    setSelectedIds([card.id])
    if (card.collapsed) setCards(list => list.map(item => item.id === card.id ? { ...item, collapsed: false } : item))
    window.setTimeout(() => cardEditRef.current?.focus(), 0)
  }

  const cancelCardEdit = () => {
    setEditingCardId(null)
    setEditDraft({ title: '', text: '' })
  }

  const saveCardEdit = id => {
    const cleanText = String(editDraft.text || '').trim()
    if (!cleanText) return
    const cleanTitle = String(editDraft.title || '').trim()
    setCards(list => list.map(card => {
      if (card.id !== id) return card
      const originalText = card.materialId ? String(card.originalText ?? card.text ?? '') : null
      const next = { ...card, title: cleanTitle, text: cleanText }
      if (card.materialId) {
        next.originalText = originalText
        next.userEdited = cleanText !== originalText
      }
      return next
    }))
    setEditingCardId(null)
    setEditDraft({ title: '', text: '' })
  }

  const resetCanvas = () => {
    if (!window.confirm('Réinitialiser ce canevas ? Les post-it, les liens et le contexte actif seront supprimés.')) return
    searchRequestRef.current += 1
    dragRef.current = null
    setCards([])
    setLinks([])
    setSelectedIds([])
    setActiveSubject('')
    setActiveNeedId('overview')
    setResultNeedId('overview')
    setSearchContext(null)
    setSearchResult(null)
    setSearchLoading(false)
    setSearchError('')
    setManualQuery('')
    setFreeSearchOpen(false)
    setComposer(null)
    setDraft('')
    setDraftTitle('')
    setEditingCardId(null)
    setEditDraft({ title: '', text: '' })
    setLinkMode(false)
    setLinkLabel('est lié à')
    setShowLinks(false)
    setEclaireur({ open: false, step: null })
    try {
      sessionStorage.removeItem(STORAGE_KEY)
      sessionStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {}
  }

  const toggleSelection = (card, event) => {
    if (linkMode) {
      setSelectedIds(ids => {
        if (ids.includes(card.id)) return ids.filter(id => id !== card.id)
        if (ids.length >= 2) return [card.id]
        return [...ids, card.id]
      })
      return
    }
    const multi = event.shiftKey || event.ctrlKey || event.metaKey
    if (multi) {
      setSelectedIds(ids => ids.includes(card.id) ? ids.filter(id => id !== card.id) : [...ids, card.id].slice(-2))
    } else {
      setSelectedIds([card.id])
    }
  }

  const toggleLinkMode = () => {
    setLinkMode(value => {
      const next = !value
      setSelectedIds([])
      setLinkLabel('est lié à')
      return next
    })
  }

  const startDrag = (event, card) => {
    // En mode liaison, un clic doit sélectionner le post-it et jamais démarrer un glisser-déposer.
    if (linkMode) return
    if (event.button !== 0 || event.target.closest('button,textarea,input,a,select')) return
    const element = event.currentTarget.closest('.qvl-canvas-card')
    const rect = element.getBoundingClientRect()
    dragRef.current = { id: card.id, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, width: rect.width, height: rect.height }
    document.body.classList.add('qvl-reflection-dragging')
    element.setPointerCapture?.(event.pointerId)
  }

  const createLink = () => {
    if (selectedIds.length !== 2) return
    const [source, target] = selectedIds
    const exists = links.some(link => (link.source === source && link.target === target) || (link.source === target && link.target === source))
    if (!exists) {
      setLinks(list => [...list, { id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, source, target, label: linkLabel }])
    }
    setLinkLabel('est lié à')
    setLinkMode(false)
    setSelectedIds([])
  }

  const removeLink = id => setLinks(list => list.filter(link => link.id !== id))

  const showProof = async material => {
    closeEclaireur()
    const materialId = materialIdOf(material)
    setProofState({ open: true, loading: true, error: '', material, result: null })
    if (!materialId) {
      setProofState({ open: true, loading: false, error: '', material, result: null })
      return
    }
    try {
      const result = await runReflectionAction('DOC02', { material_id: materialId })
      setProofState({ open: true, loading: false, error: '', material, result })
    } catch (error) {
      setProofState({ open: true, loading: false, error: error?.message || String(error), material, result: null })
    }
  }

  const shellClass = `qvl-reflection-shell ${leftCollapsed ? 'left-collapsed' : ''} ${rightCollapsed ? 'right-collapsed' : ''}`

  return <main className="qvl-reflection-page">
    <div className="qvl-reflection-back-wrap"><button className="back-link" onClick={onBack}><Icon name="back"/>Retour à l’atelier</button></div>

    <section className="qvl-reflection-hero">
      <div className="qvl-hero-copy">
        <div className="qvl-hero-text">
          <h1>Avancer avec le corpus</h1>
          <p>Une bibliothèque à portée de main pour explorer, documenter et relier les éléments utiles à votre travail.</p>
          <span><strong>Périmètre :</strong> l’outil travaille uniquement à partir des publications du bulletin Quiritès intégrées au corpus actif. Il ne complète pas les résultats avec le Web ni avec des connaissances extérieures au corpus et peut donc ne pas pouvoir répondre à certaines questions.</span>
        </div>
        <div className="qvl-hero-visual" aria-hidden="true">
          <img src={heroImage} alt=""/>
        </div>
      </div>
    </section>

    <div className={shellClass}>
      <aside className={`qvl-reflection-left ${eclaireur.open && eclaireur.step === 'needs' ? 'qvl-eclaireur-target' : ''}`}>
        <button className="qvl-panel-toggle left" type="button" onClick={() => setLeftCollapsed(value => !value)} aria-label={leftCollapsed ? 'Déployer les besoins informationnels' : 'Replier les besoins informationnels'}>
          {leftCollapsed ? '›' : '‹'}
        </button>
        {leftCollapsed ? <div className="qvl-collapsed-label">Besoins informationnels</div> : <>
          <header className="qvl-side-heading">
            <span className="qvl-side-icon"><Icon name="book" size={19}/></span>
            <div><h2>Besoins informationnels</h2><p>Choisissez ce que vous cherchez à faire avec le corpus.</p></div>
          </header>
          <div className="qvl-need-list">
            {NEEDS.map(need => {
              const active = activeNeedId === need.id
              return <button key={need.id} type="button" aria-pressed={active} className={`qvl-need-card ${need.tone} ${active ? 'active' : ''}`} onClick={() => chooseNeed(need.id)}>
                <span className="qvl-need-icon"><Icon name={need.icon} size={21}/></span>
                <span className="qvl-need-copy"><strong>{need.label}</strong><small>{need.description}</small></span>
                {active ? <span className="qvl-need-selected" aria-hidden="true">✓</span> : <Icon name="chevron" size={15}/>}
              </button>
            })}
          </div>
          <div className="qvl-scope-note"><Icon name="info" size={15}/><span><strong>Corpus du bulletin uniquement.</strong> Ces fonctions portent sur les publications Quiritès présentes dans le corpus actif, pas sur l’ensemble des connaissances disponibles sur un sujet.</span></div>
        </>}
      </aside>

      <section className="qvl-reflection-center">
        <header className="qvl-canvas-intro">
          <div className="qvl-canvas-title"><span className="qvl-canvas-title-icon">↗</span><div><h2>Construisez votre réflexion</h2><p>Posez une question, formulez une idée, ajoutez une note ou conservez un élément du corpus. Déplacez les cartes, rapprochez-les et reliez-les pour faire apparaître progressivement votre raisonnement.</p></div></div>
          <div className={`qvl-canvas-toolbar ${eclaireur.open && eclaireur.step === 'cards' ? 'qvl-eclaireur-target' : ''}`}>
            {CARD_TYPES.map(type => <button key={type.id} type="button" className={`qvl-postit-add ${type.tone}`} onClick={() => beginComposer(type.id)}><span>{type.icon}</span>{type.label}</button>)}
            <button type="button" className="qvl-postit-add sand" onClick={() => beginComposer('corpus')}><span>▤</span>Élément du corpus</button>
            <span className="qvl-toolbar-spacer"/>
            <div className="qvl-link-tools">
              <button type="button" className={`qvl-link-button ${linkMode ? 'active' : ''}`} onClick={toggleLinkMode}><Icon name="link" size={16}/>{linkMode ? 'Annuler la liaison' : 'Relier des cartes'}</button>
              {links.length > 0 && <button type="button" className="qvl-link-count" onClick={() => setShowLinks(value => !value)}>Liens ({links.length})</button>}
              <button type="button" className="qvl-link-button qvl-reset-button" onClick={resetCanvas} disabled={!cards.length && !links.length && !activeSubject}><Icon name="close" size={14}/>Réinitialiser</button>
              {showLinks && links.length > 0 && <div className="qvl-link-list-popover">
                <strong>Liens du canevas</strong>
                {links.map(link => {
                  const source = cards.find(card => card.id === link.source)
                  const target = cards.find(card => card.id === link.target)
                  return <div key={link.id}><span>{shortText(source?.title || source?.text, 26)} {link.label || '—'} {shortText(target?.title || target?.text, 26)}</span><button type="button" onClick={() => removeLink(link.id)}>×</button></div>
                })}
              </div>}
            </div>
          </div>
          {linkMode && <div className="qvl-link-builder">
            <div>
              <strong>Créer une liaison entre deux post-it</strong>
              <span>{selectedIds.length === 0 ? 'Cliquez sur le premier post-it.' : selectedIds.length === 1 ? 'Premier post-it choisi. Cliquez maintenant sur le second.' : 'Deux post-it sont sélectionnés. Choisissez éventuellement le type de lien.'}</span>
            </div>
            <select value={linkLabel} onChange={event => setLinkLabel(event.target.value)} disabled={selectedIds.length !== 2}>
              {LINK_LABELS.map(label => <option key={label || 'none'} value={label}>{label || 'Sans libellé'}</option>)}
            </select>
            <button type="button" className="primary" disabled={selectedIds.length !== 2} onClick={createLink}>Créer le lien</button>
            <button type="button" className="ghost" onClick={toggleLinkMode}>Annuler</button>
          </div>}
        </header>

        {composer && <div className={`qvl-canvas-composer ${composer.tone}`}>
          <div><strong>{composer.label}</strong><span>Le titre est facultatif. Il peut aussi aider à garder le sujet du canevas explicite.</span></div>
          <div className="qvl-composer-fields">
            <input maxLength={120} value={draftTitle} onChange={event => setDraftTitle(event.target.value)} placeholder="Titre du post-it (facultatif)"/>
            <textarea value={draft} onChange={event => setDraft(event.target.value)} placeholder={composer.placeholder} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') addDraft() }}/>
          </div>
          <div className="qvl-composer-actions"><button type="button" onClick={() => { setComposer(null); setDraft(''); setDraftTitle('') }}>Annuler</button><button type="button" className="primary" disabled={!draft.trim()} onClick={addDraft}>Ajouter au canevas</button></div>
        </div>}

        <div className="qvl-canvas-stage">
          <div className={`qvl-canvas ${cards.length ? 'has-cards' : ''} ${linkMode ? 'link-mode' : ''}`} ref={canvasRef} onClick={event => { if (event.target === event.currentTarget) setSelectedIds([]) }}>
            <svg className="qvl-links-layer" width="100%" height="100%" aria-hidden="true">
              <defs><marker id="qvl-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor"/></marker></defs>
              {links.map(link => {
                const source = cards.find(card => card.id === link.source)
                const target = cards.find(card => card.id === link.target)
                if (!source || !target) return null
                const a = cardCenter(source)
                const b = cardCenter(target)
                const midX = (a.x + b.x) / 2
                const midY = (a.y + b.y) / 2
                return <g key={link.id} className="qvl-link-line">
                  <path d={`M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`} markerEnd="url(#qvl-arrow)"/>
                  {link.label && <><rect x={midX - 40} y={midY - 11} width="80" height="22" rx="11"/><text x={midX} y={midY + 3} textAnchor="middle">{link.label}</text></>}
                </g>
              })}
            </svg>

            {!cards.length && <div className="qvl-empty-canvas">
              <div className="qvl-empty-postits" aria-hidden="true"><i className="blue"/><i className="yellow"/><i className="lilac"/></div>
              <h3>Installez votre réflexion ici</h3>
              <p>Commencez par une question, une idée ou une note. Cherchez ensuite dans le corpus et ajoutez les éléments utiles à côté de votre propre raisonnement.</p>
              <span>Une bibliothèque à portée de main, un espace de travail qui reste le vôtre.</span>
            </div>}

            {cards.map(card => {
              const selected = selectedIds.includes(card.id)
              const linkIndex = linkMode ? selectedIds.indexOf(card.id) + 1 : 0
              const meta = card.material ? publicationMeta(card.material) : null
              const locator = card.material ? locatorOf(card.material) : null
              const editing = editingCardId === card.id
              return <article key={card.id} className={`qvl-canvas-card ${card.tone} ${selected ? 'selected' : ''} ${linkIndex ? 'link-selected' : ''} ${card.materialId ? 'corpus-card' : ''} ${card.userEdited ? 'user-edited' : ''} ${editing ? 'editing' : ''} ${card.collapsed ? 'collapsed' : ''}`} style={{ left: card.x, top: card.y }} onClick={event => { event.stopPropagation(); if (!editing) toggleSelection(card, event) }} onPointerDown={event => startDrag(event, card)}>
                {linkIndex > 0 && <span className="qvl-link-order" aria-hidden="true">{linkIndex}</span>}
                <header>
                  <span>{card.kind}{card.userEdited ? ' · modifié' : ''}</span>
                  <div className="qvl-card-controls">
                    <button type="button" aria-label="Modifier la carte" title="Modifier" onClick={event => { event.stopPropagation(); beginCardEdit(card) }}><span className="qvl-edit-glyph" aria-hidden="true">✎</span></button>
                    <button type="button" aria-label={card.collapsed ? 'Déployer la carte' : 'Réduire la carte'} title={card.collapsed ? 'Déployer' : 'Réduire'} onClick={event => { event.stopPropagation(); if (editing) cancelCardEdit(); toggleCardCollapsed(card.id) }}><Icon name={card.collapsed ? 'plus' : 'minus'} size={13}/></button>
                    <button type="button" aria-label="Supprimer la carte" title="Supprimer" onClick={event => { event.stopPropagation(); deleteCard(card.id) }}><Icon name="close" size={13}/></button>
                  </div>
                </header>
                {card.collapsed ? <p>{shortText(card.title || card.text, 72)}</p> : editing ? <div className="qvl-card-editor" onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
                  <input maxLength={120} value={editDraft.title} onChange={event => setEditDraft(value => ({ ...value, title: event.target.value }))} placeholder="Titre du post-it (facultatif)"/>
                  <textarea ref={cardEditRef} value={editDraft.text} onChange={event => setEditDraft(value => ({ ...value, text: event.target.value }))} onKeyDown={event => { if (event.key === 'Escape') cancelCardEdit(); if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') saveCardEdit(card.id) }} aria-label="Texte du post-it"/>
                  <div className="qvl-card-edit-actions"><button type="button" onClick={cancelCardEdit}>Annuler</button><button type="button" className="primary" disabled={!editDraft.text.trim()} onClick={() => saveCardEdit(card.id)}>Enregistrer</button></div>
                </div> : <>
                  {card.title && <strong className="qvl-card-title-display">{card.title}</strong>}
                  <p>{card.text}</p>
                </>}
                {!card.collapsed && card.material && <footer>
                  <strong>{meta?.title || meta?.id}</strong>
                  <span>{[meta?.organisation, meta?.year].filter(Boolean).join(' · ')}</span>
                  <span>{[locator?.label, provenanceLevelOf(card.material) ? `provenance ${provenanceLevelOf(card.material)}` : ''].filter(Boolean).join(' · ')}</span>
                  {card.userEdited && <span className="qvl-card-edit-note">Texte modifié dans le canevas · preuve source inchangée</span>}
                </footer>}
              </article>
            })}
          </div>
        </div>
        <div className={`qvl-canvas-help ${linkMode ? 'link-mode' : ''}`}><span>{linkMode ? `Mode liaison : sélectionnez deux cartes (${selectedCards.length}/2).` : selectedCards.length ? `${selectedCards.length} carte${selectedCards.length > 1 ? 's' : ''} sélectionnée${selectedCards.length > 1 ? 's' : ''}` : 'Cliquez sur une carte pour la sélectionner.'}</span><span>{linkMode ? 'Cliquez simplement sur deux post-it, puis qualifiez le lien.' : 'Les volets peuvent être repliés pour agrandir le canevas · Chaque post-it peut être réduit.'}</span></div>
      </section>

      <aside className={`qvl-reflection-right ${eclaireur.open && eclaireur.step === 'results' ? 'qvl-eclaireur-target' : ''}`}>
        <button className="qvl-panel-toggle right" type="button" onClick={() => setRightCollapsed(value => !value)} aria-label={rightCollapsed ? 'Déployer le corpus' : 'Replier le corpus'}>
          {rightCollapsed ? '‹' : '›'}
        </button>
        {rightCollapsed ? <div className="qvl-collapsed-label">Corpus</div> : <>
          <header className="qvl-side-heading corpus">
            <span className="qvl-side-icon"><Icon name="file" size={19}/></span>
            <div><h2>Ce que le corpus Quiritès apporte</h2><p>Résultats fondés sur les publications du bulletin présentes dans le corpus actif.</p></div>
          </header>

          <div className="qvl-corpus-boundary"><Icon name="info" size={17}/><div><strong>Périmètre du bot</strong><p>Il répond uniquement à partir des publications du bulletin Quiritès intégrées au corpus actif. Une absence ou une faible couverture ici ne signifie pas que le sujet est absent de la littérature ou des connaissances disponibles en dehors du bulletin.</p></div></div>

          {searchContext?.source === 'canvas' && <div className="qvl-guided-status"><Icon name="target" size={16}/><div><strong>Recherche à partir du canevas</strong><span>{searchResult?.interpretation?.context_used ? `Contexte utilisé : ${searchResult.interpretation.context_subject || searchResult.interpretation.subject_query}` : searchResult?.interpretation?.subject_query ? `Sujet interprété : ${searchResult.interpretation.subject_query}` : 'Le besoin sélectionné est appliqué au post-it actif et au contexte utile du canevas.'}</span></div></div>}
          {searchContext?.source === 'manual' && searchResult?.interpretation?.context_used && <div className="qvl-guided-status"><Icon name="target" size={16}/><div><strong>Contexte du canevas utilisé</strong><span>{searchResult.interpretation.context_subject || searchResult.interpretation.subject_query}</span></div></div>}

          {searchContext?.source !== 'manual' && <div className="qvl-general-advice"><Icon name="info" size={16}/><div><strong>Repère</strong><p>{activeNeed.advice}</p></div></div>}

          {searchError && <div className="qvl-search-error"><strong>La recherche n’a pas abouti.</strong><span>{searchError}</span></div>}
          {searchLoading && <div className="qvl-search-loading"><span>✦</span><strong>Recherche dans le corpus actif…</strong></div>}
          {!searchLoading && searchResult && <NeedResults need={resultNeed} result={searchResult} materials={visibleResults} onAdd={addMaterialToCanvas} onProof={showProof}/>} 
          {!searchLoading && !searchResult && !searchError && <div className="qvl-right-empty"><span className="qvl-round-book"><Icon name="book" size={28}/></span><strong>{searchContext?.source === 'awaiting-card' ? 'Choisissez le point de départ.' : 'Votre bibliothèque est prête.'}</strong><p>{searchContext?.source === 'awaiting-card' ? 'Sélectionnez un post-it dans le canevas, puis cliquez sur l’un des besoins informationnels à gauche.' : 'Sélectionnez un post-it puis un besoin informationnel. Les résultats apparaîtront ici avec leur provenance.'}</p></div>}

          <div className={`qvl-free-search ${freeSearchOpen ? 'open' : ''}`}>
            <button type="button" className="qvl-free-search-toggle" onClick={() => { setFreeSearchOpen(value => !value); window.setTimeout(() => document.querySelector('.qvl-free-search textarea')?.focus(), 0) }}>
              <Icon name="search" size={16}/><span><strong>Question libre au corpus du bulletin</strong><small>Le bot n’utilise que les publications intégrées au corpus actif.</small></span><span aria-hidden="true">{freeSearchOpen ? '−' : '+'}</span>
            </button>
            {freeSearchOpen && <form onSubmit={runManualSearch}>
              <textarea ref={searchInputRef} maxLength={500} value={manualQuery} onChange={event => setManualQuery(event.target.value)} placeholder="Posez directement une question au corpus…"/>
              <span className="qvl-char-count">{manualQuery.length}/500</span>
              <button type="submit" disabled={!manualQuery.trim() || searchLoading}><Icon name="search" size={18}/>{searchLoading ? 'Recherche…' : 'Chercher dans le corpus'}</button>
            </form>}
          </div>
        </>}
      </aside>
    </div>

    {eclaireur.open && <EclaireurGuide
      step={eclaireur.step}
      resultCount={visibleResults.length}
      loading={searchLoading}
      awaitingCard={searchContext?.source === 'awaiting-card'}
      onClose={closeEclaireur}
      onCards={() => guideTo('cards')}
      onNeeds={() => guideTo('needs')}
      onResults={() => guideTo('results')}
    />}
    {!eclaireur.open && <button type="button" className="qvl-eclaireur-help" onClick={() => setEclaireur({ open: true, step: 'intro' })}><span aria-hidden="true">✦</span>L’Éclaireur</button>}

    {proofState.open && <ProofModal state={proofState} onClose={() => setProofState({ open: false, loading: false, error: '', material: null, result: null })}/>} 
  </main>
}

function EclaireurGuide({ step, resultCount, loading, awaitingCard, onClose, onCards, onNeeds, onResults }) {
  const multiple = resultCount > 1
  if (step === 'cards') return <aside className="qvl-eclaireur-guide cards" aria-live="polite">
    <EclaireurHeader onClose={onClose}/><p className="qvl-eclaireur-lead">Commencez par une carte.</p><p>Les boutons <strong>Question</strong>, <strong>Idée / hypothèse</strong>, <strong>Note</strong> et <strong>Point à vérifier</strong> sont juste au-dessus du canevas.</p><button type="button" onClick={onNeeds}>Puis voir les besoins informationnels →</button>
  </aside>
  if (step === 'needs') return <aside className="qvl-eclaireur-guide needs" aria-live="polite">
    <EclaireurHeader onClose={onClose}/><p className="qvl-eclaireur-lead">Choisissez maintenant votre besoin informationnel.</p><p>Le volet de gauche détermine la manière dont le corpus sera interrogé à partir de votre carte.</p><button type="button" onClick={onResults}>Où apparaîtront les résultats ? →</button>
  </aside>
  if (step === 'results') return <aside className="qvl-eclaireur-guide results" aria-live="polite">
    <EclaireurHeader onClose={onClose}/><p className="qvl-eclaireur-lead">Les résultats apparaissent ici, dans le volet de droite.</p>
    {awaitingCard ? <p>Sélectionnez d’abord une carte dans le canevas : le besoin choisi sera appliqué à ce point de départ.</p> : loading ? <p>La recherche est en cours. Les éléments trouvés vont s’afficher dans cette colonne.</p> : resultCount === 0 ? <p>Si le corpus ne fournit pas de résultat suffisant, le message de limite s’affichera au même endroit.</p> : multiple ? <p className="qvl-eclaireur-scroll">Plusieurs résultats sont disponibles : <strong>faites bien descendre l’ascenseur de cette colonne jusqu’en bas</strong> pour tous les voir. <span aria-hidden="true">↓</span></p> : <p>Le résultat est affiché dans cette colonne avec sa provenance et sa preuve.</p>}
  </aside>
  return <aside className="qvl-eclaireur-guide intro" aria-live="polite">
    <EclaireurHeader onClose={onClose}/><p className="qvl-eclaireur-lead">Vous pouvez avancer de deux façons complémentaires.</p>
    <div className="qvl-eclaireur-section"><strong>Démarches dans le canevas</strong><span>Question · Idée / hypothèse · Note · Point à vérifier</span></div>
    <div className="qvl-eclaireur-section"><strong>Besoins informationnels</strong><span>Comprendre un thème · Trouver une information précise · Voir ce qui évolue · Identifier les acteurs · Explorer les réponses d’action publique</span></div>
    <div className="qvl-eclaireur-actions"><button type="button" onClick={onCards}>Voir les démarches</button><button type="button" onClick={onNeeds}>Voir les besoins</button></div>
  </aside>
}

function EclaireurHeader({ onClose }) {
  return <div className="qvl-eclaireur-heading"><span className="qvl-eclaireur-mark">✦</span><strong>L’Éclaireur</strong><button type="button" onClick={onClose} aria-label="Fermer L’Éclaireur">×</button></div>
}

function NeedResults({ need, result, materials, onAdd, onProof }) {
  const all = result?.results || result?.materials || []
  const pubs = new Map()
  materials.forEach(item => {
    const meta = publicationMeta(item)
    if (meta.id) pubs.set(meta.id, meta)
  })
  const domains = [...new Set(materials.map(item => item.domaine).filter(Boolean))]

  return <section className="qvl-need-results">
    {need.id === 'overview' && <div className="qvl-overview-strip">
      <div><strong>{pubs.size}</strong><span>publication{pubs.size > 1 ? 's' : ''}</span></div>
      <div><strong>{materials.length}</strong><span>élément{materials.length > 1 ? 's' : ''}</span></div>
      <div><strong>{domains.length}</strong><span>domaine{domains.length > 1 ? 's' : ''}</span></div>
    </div>}
    <div className="qvl-result-heading"><div><strong>{materials.length} résultat{materials.length > 1 ? 's' : ''}</strong><span>{need.id === 'overview' ? 'pour construire une première vue du thème' : 'correspondant à ce besoin informationnel'}</span></div>{all.length !== materials.length && <small>{all.length - materials.length} autre{all.length - materials.length > 1 ? 's' : ''} résultat{all.length - materials.length > 1 ? 's' : ''} écarté{all.length - materials.length > 1 ? 's' : ''} car hors de cette catégorie</small>}</div>
    {materials.length ? <div className="qvl-result-list">{materials.slice(0, 14).map((material, index) => <ResultMaterial key={materialIdOf(material) || index} material={material} onAdd={() => onAdd(material)} onProof={() => onProof(material)}/>)}</div> : <div className="qvl-no-result"><strong>Le corpus actif ne permet pas de répondre suffisamment à ce besoin.</strong><p>Aucun élément suffisamment ciblé n’a été repéré dans les publications du bulletin présentes dans le corpus. Cela ne signifie pas que le sujet est peu documenté en dehors du bulletin. Vous pouvez préciser la formulation ou revenir à « Comprendre rapidement ce que le corpus contient sur un thème ».</p></div>}
  </section>
}

function ResultMaterial({ material, onAdd, onProof }) {
  const id = materialIdOf(material)
  const meta = publicationMeta(material)
  const locator = locatorOf(material)
  const provenance = provenanceLevelOf(material)
  const sourceUrl = sourceUrlOf(material)
  return <article className="qvl-result-card">
    <div className="qvl-result-card-top"><span>{materialKind(material)}</span>{id && <small>{id.replace(':', ' · ')}</small>}</div>
    <p className="qvl-result-excerpt">{shortText(materialText(material), 360)}</p>
    <div className="qvl-result-source">
      <strong>{meta.title || meta.id || 'Publication source'}</strong>
      <span>{[meta.organisation, meta.year].filter(Boolean).join(' · ')}</span>
      <div>{meta.id && <em>{meta.id}</em>}{locator?.label && <em>{locator.label}</em>}{provenance && <em>provenance {provenance}</em>}</div>
    </div>
    <div className="qvl-result-actions">
      {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer"><Icon name="external" size={14}/>{sourceButtonLabel(material)}</a> : <span className="qvl-source-unavailable">Lien source indisponible</span>}
      <button type="button" className="ghost" onClick={onProof}><Icon name="file" size={14}/>Voir la preuve complète</button>
      <button type="button" className="primary" onClick={onAdd}><Icon name="plus" size={14}/>Ajouter au canevas</button>
    </div>
  </article>
}

function ProofModal({ state, onClose }) {
  const result = state.result
  const material = state.material
  const meta = result?.publication ? publicationMeta({ publication: result.publication }) : publicationMeta(material)
  const fallbackUrl = sourceUrlOf(material)
  const publicationUrl = result?.publication?.url_contenu || result?.publication?.url_source || fallbackUrl
  const proofs = result?.proofs || []
  const sourceLocator = result?.provenance?.source_locator || locatorOf(material)?.label || ''
  const level = result?.provenance?.level || provenanceLevelOf(material)
  const materialValue = materialText(material)
  const sourceHref = publicationUrl && isPdfUrl(publicationUrl) && result?.provenance?.source_locator && /^\d/.test(result.provenance.source_locator)
    ? `${publicationUrl.replace(/#.*$/, '')}#page=${result.provenance.source_locator.split(';')[0]}`
    : publicationUrl

  return <div className="qvl-proof-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="qvl-proof-modal" role="dialog" aria-modal="true" aria-label="Preuve complète">
      <header>
        <div className="qvl-proof-title-block">
          <span>Preuve complète</span>
          <h2>{meta.title || meta.id || 'Publication source'}</h2>
          <p className="qvl-proof-header-meta">{[meta.organisation, meta.year, meta.id].filter(Boolean).join(' · ')}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer la preuve complète"><Icon name="close" size={18}/></button>
      </header>

      <div className="qvl-proof-body">

        {state.loading && <div className="qvl-proof-loading"><span>✦</span>Recherche de la preuve exacte…</div>}
        {state.error && <div className="qvl-proof-error"><strong>La preuve n’a pas pu être chargée.</strong><span>{state.error}</span></div>}
        {!state.loading && !state.error && result?.provenance?.message && <div className="qvl-proof-message"><strong>Statut de la preuve</strong><span>{result.provenance.message}</span></div>}

        {!state.loading && !state.error && proofs.length > 0 && <section className="qvl-proof-section">
          <h3>Éléments de preuve</h3>
          <div className="qvl-proof-excerpts">{proofs.map((proof, index) => <article key={proof.proof_id || index}>
            <div className="qvl-proof-excerpt-head">
              <div><strong>{proof.section || `Extrait source ${index + 1}`}</strong>{proof.proof_id && <small>{proof.proof_id}</small>}</div>
              {proof.locator && <span>{/^\d/.test(String(proof.locator)) ? `p. ${String(proof.locator).replaceAll(';', ', ')}` : proof.locator}</span>}
            </div>
            <ProofText text={proof.text}/>
          </article>)}</div>
        </section>}

        {!state.loading && !state.error && !proofs.length && <section className="qvl-proof-section">
          <h3>{result ? 'Élément documenté' : 'Élément sélectionné'}</h3>
          {result && <p className="qvl-proof-availability">Aucun extrait fin supplémentaire n’est disponible pour ce matériau.</p>}
          {materialValue ? <div className="qvl-proof-fallback-text"><ProofText text={materialValue}/></div> : <p className="qvl-proof-availability">Aucun texte n’est disponible pour cet élément.</p>}
        </section>}

        <section className="qvl-proof-section qvl-proof-provenance">
          <h3>Provenance</h3>
          <div className="qvl-proof-provenance-line">
            <strong>{meta.title || meta.id || 'Publication source'}</strong>
            <span>{[meta.organisation, meta.year, meta.id, sourceLocator ? `repère ${String(sourceLocator).replace(/^repère\s+/i, '')}` : '', level ? `provenance ${level}` : ''].filter(Boolean).join(' · ')}</span>
          </div>
          <p>Texte restitué sans reformulation. Seuls les retours à la ligne purement techniques sont neutralisés à l’affichage.</p>
        </section>
      </div>

      <footer>
        {sourceHref && <a href={sourceHref} target="_blank" rel="noreferrer"><Icon name="external" size={15}/>Ouvrir la source</a>}
        <button type="button" onClick={onClose}>Fermer</button>
      </footer>
    </section>
  </div>
}
