import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { runReflectionAction } from '../services/reflectionApi.js'
import { buildCorpusIndex, searchIndex, selectTheme, selectPublication, selectType, typeGroup, FEATURED_TYPES, ELEMENT_TYPES } from '../lib/corpusIndex.js'
import './reflection-workspace.css'
import './corpus-explore.css'

const CARD_TYPES = [
  { id: 'question', label: 'Question', tone: 'blue', icon: '?', placeholder: 'Quelle question souhaitez-vous poser ?' },
  { id: 'idea', label: 'Idée / hypothèse', tone: 'yellow', icon: '✦', placeholder: 'Formulez votre idée ou votre hypothèse…' },
  { id: 'note', label: 'Note', tone: 'lilac', icon: '✎', placeholder: 'Ajoutez une observation, une piste ou un rappel…' },
  { id: 'check', label: 'Point à vérifier', tone: 'green', icon: '✓', placeholder: 'Quel point souhaitez-vous vérifier plus tard ?' },
]

const LINK_LABELS = ['est lié à', 'appuie', 'nuance', 'questionne', '']
const STORAGE_KEY = 'quirites:reflection-workspace:v2'
const LEGACY_STORAGE_KEY = 'quirites:reflection-canvas:v1'

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
  if (material?.group && typeGroup(material.group)) return typeGroup(material.group).one
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
  return 'Élément d’une publication'
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

function cardCenter(card) {
  const width = 260
  const height = card.collapsed ? 68 : (card.title ? 198 : 176)
  return { x: Number(card.x || 0) + width / 2, y: Number(card.y || 0) + height / 2 }
}

export default function ReflectionWorkspaceV1({ onBack, data }) {
  const initial = useMemo(() => restoreWorkspace(), [])
  const [cards, setCards] = useState(initial.cards)
  const [links, setLinks] = useState(initial.links)
  const [activeSubject, setActiveSubject] = useState(initial.activeSubject || '')
  const [selectedIds, setSelectedIds] = useState([])
  const [query, setQuery] = useState('')
  const [selection, setSelection] = useState(null)
  const [openTheme, setOpenTheme] = useState('')
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
  // Sur téléphone, le guide démarre réduit pour ne pas masquer les boutons.
  const [eclaireur, setEclaireur] = useState(() => ({ mode: typeof window !== 'undefined' && window.innerWidth <= 760 ? 'minimized' : 'open', step: 'start' }))
  const canvasRef = useRef(null)
  const cardEditRef = useRef(null)
  const dragRef = useRef(null)
  const searchInputRef = useRef(null)

  // Index local de la base : thèmes, types et nombres sont recalculés à chaque
  // chargement des données, donc suivent l'enrichissement de la base.
  const index = useMemo(() => buildCorpusIndex(data), [data])
  const selectedCards = useMemo(() => cards.filter(card => selectedIds.includes(card.id)), [cards, selectedIds])
  const keptIds = useMemo(() => new Set(cards.map(card => card.materialId).filter(Boolean)), [cards])

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ cards, links, activeSubject })) } catch {}
  }, [cards, links, activeSubject])

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

  const closeEclaireur = () => setEclaireur(state => ({ ...state, mode: 'closed' }))
  const minimizeEclaireur = () => setEclaireur(state => ({ ...state, mode: 'minimized' }))
  const restoreEclaireur = () => setEclaireur(state => ({ ...state, mode: 'open', step: state.step || 'start' }))
  const guideStep = step => setEclaireur(state => state.mode === 'closed' ? { ...state, step } : { ...state, step })

  // Une seule entrée : on montre ce que la base contient pour un mot, un thème,
  // une publication ou un type d'élément.
  const showSelection = result => {
    setSelection(result)
    setRightCollapsed(false)
    if (result?.subject) setActiveSubject(result.subject)
    guideStep('results')
  }
  const runSearch = event => {
    event?.preventDefault()
    const clean = query.trim()
    if (!clean) return
    showSelection({ ...searchIndex(index, clean), subject: clean })
  }
  const chooseTheme = label => {
    setOpenTheme(current => current === label ? '' : label)
    showSelection({ ...selectTheme(index, label), subject: label })
  }
  const choosePublication = id => showSelection(selectPublication(index, id))
  const chooseType = groupId => showSelection(selectType(index, groupId))

  const beginComposer = type => {
    closeEclaireur()
    const cardType = CARD_TYPES.find(item => item.id === type)
    if (!cardType) return
    setComposer(cardType)
    setDraft('')
    setDraftTitle('')
    setTimeout(() => {
      const box = document.querySelector('.qvl-canvas-composer')
      box?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
      box?.querySelector('textarea')?.focus({ preventScroll: true })
    }, 0)
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
  }

  const addMaterialToCanvas = material => {
    const text = materialText(material)
    if (!text) return
    const index = cards.length
    const card = makeCanvasCard({
      kind: materialKind(material),
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
    dragRef.current = null
    setCards([])
    setLinks([])
    setSelectedIds([])
    setActiveSubject('')
    setSelection(null)
    setQuery('')
    setOpenTheme('')
    setComposer(null)
    setDraft('')
    setDraftTitle('')
    setEditingCardId(null)
    setEditDraft({ title: '', text: '' })
    setLinkMode(false)
    setLinkLabel('est lié à')
    setShowLinks(false)
    setEclaireur({ mode: 'closed', step: 'start' })
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
    <header className="etb-bar">
      <button className="back-link etb-back" onClick={onBack}><Icon name="back"/>Atelier</button>
      <h1>Avancer avec le corpus</h1>
      <span className="etb-bar-regime">Enrichissement contrôlé</span>
      <span className="etb-bar-spacer"/>
      <div className={`qce-postit-bar ${eclaireur.mode === 'open' && eclaireur.step === 'canvas' ? 'qvl-eclaireur-target' : ''}`} role="group" aria-label="Créer un post-it">
        <span className="qce-postit-bar-label">Créer un post-it</span>
        {CARD_TYPES.map(type => <button key={type.id} type="button" className={`qce-postit-btn ${type.tone} ${composer?.id === type.id ? 'active' : ''}`} onClick={() => beginComposer(type.id)}><span aria-hidden="true">{type.icon}</span>{type.label}</button>)}
      </div>
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
    </header>

    <div className={shellClass}>
      <aside className={`qvl-reflection-left qce-left ${eclaireur.mode === 'open' && eclaireur.step === 'start' ? 'qvl-eclaireur-target' : ''}`}>
        <button className="qvl-panel-toggle left" type="button" onClick={() => setLeftCollapsed(value => !value)} aria-label={leftCollapsed ? 'Déployer la recherche' : 'Replier la recherche'}>
          {leftCollapsed ? '›' : '‹'}
        </button>
        {leftCollapsed ? <div className="qvl-collapsed-label">Chercher</div> : <CorpusStart
          index={index}
          query={query}
          setQuery={setQuery}
          onSearch={runSearch}
          inputRef={searchInputRef}
          openTheme={openTheme}
          selection={selection}
          onTheme={chooseTheme}
          onPublication={choosePublication}
          onType={chooseType}
        />}
      </aside>
      <section className="qvl-reflection-center">
        <header className="qvl-canvas-intro">
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
              <h3>Votre espace de travail</h3>
              <p>Cherchez un mot ou choisissez un thème à gauche. Gardez ici les éléments utiles avec « + Garder », puis ajoutez vos propres notes et reliez-les.</p>
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

      <aside className={`qvl-reflection-right qce-right ${eclaireur.mode === 'open' && eclaireur.step === 'results' ? 'qvl-eclaireur-target' : ''}`}>
        <button className="qvl-panel-toggle right" type="button" onClick={() => setRightCollapsed(value => !value)} aria-label={rightCollapsed ? 'Déployer les résultats' : 'Replier les résultats'}>
          {rightCollapsed ? '‹' : '›'}
        </button>
        {rightCollapsed ? <div className="qvl-collapsed-label">Résultats</div> : <CorpusResults
          index={index}
          selection={selection}
          keptIds={keptIds}
          onKeep={material => { addMaterialToCanvas(material); guideStep('canvas') }}
          onProof={showProof}
          onPublication={choosePublication}
        />}
      </aside>
    </div>
    <EclaireurGuide
      step={eclaireur.step}
      mode={eclaireur.mode}
      onClose={closeEclaireur}
      onMinimize={minimizeEclaireur}
      onRestore={restoreEclaireur}
    />

    {proofState.open && <ProofModal state={proofState} onClose={() => setProofState({ open: false, loading: false, error: '', material: null, result: null })}/>} 
  </main>
}

// Déplacement libre de L'Éclaireur (interface uniquement) : l'utilisateur peut le
// faire glisser où il veut ; il reste toujours dans la fenêtre.
function useMovable(deps) {
  const ref = useRef(null)
  const dragRef = useRef(null)
  const movedRef = useRef(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const fitInWindow = () => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let dx = 0, dy = 0
    if (r.right > innerWidth - 8) dx = innerWidth - 8 - r.right
    if (r.left + dx < 8) dx = 8 - r.left
    if (r.bottom > innerHeight - 8) dy = innerHeight - 8 - r.bottom
    if (r.top + dy < 8) dy = 8 - r.top
    if (dx || dy) setOffset(o => ({ x: o.x + dx, y: o.y + dy }))
  }
  useLayoutEffect(fitInWindow, deps)
  useEffect(() => {
    window.addEventListener('resize', fitInWindow)
    return () => window.removeEventListener('resize', fitInWindow)
  }, [])
  const onPointerDown = event => {
    movedRef.current = false
    if (event.button !== 0 || event.target.closest('.qvl-eclaireur-header-actions button, .qvl-eclaireur-minimized-close')) return
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    dragRef.current = { startX: event.clientX, startY: event.clientY, base: offset, rect: r }
    movedRef.current = false
    const onMove = moveEvent => {
      const d = dragRef.current
      if (!d) return
      let dx = moveEvent.clientX - d.startX
      let dy = moveEvent.clientY - d.startY
      if (!movedRef.current && Math.hypot(dx, dy) < 4) return
      movedRef.current = true
      dx = Math.min(innerWidth - 8 - d.rect.right, Math.max(8 - d.rect.left, dx))
      dy = Math.min(innerHeight - 8 - d.rect.bottom, Math.max(8 - d.rect.top, dy))
      setOffset({ x: d.base.x + dx, y: d.base.y + dy })
    }
    const onUp = () => {
      dragRef.current = null
      // Le clic éventuel suit immédiatement le relâchement : on ne le bloque qu'une fois.
      window.setTimeout(() => { movedRef.current = false }, 0)
      document.body.classList.remove('qvl-eclaireur-dragging')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    document.body.classList.add('qvl-eclaireur-dragging')
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  // Un glisser ne doit pas déclencher le bouton sur lequel il a commencé.
  const onClickCapture = event => {
    if (movedRef.current) { event.preventDefault(); event.stopPropagation(); movedRef.current = false }
  }
  const style = { '--qvl-drag-x': `${offset.x}px`, '--qvl-drag-y': `${offset.y}px` }
  return { ref, style, onPointerDown, onClickCapture, moved: offset.x !== 0 || offset.y !== 0 }
}

function EclaireurGuide({ step = 'start', mode = 'open', onClose, onMinimize, onRestore }) {
  const steps = ['start', 'results', 'canvas']
  const index = Math.max(0, steps.indexOf(step))
  const number = index + 1
  const side = step === 'results' ? 'left' : 'right'
  const movable = useMovable([mode, step])
  const moveProps = { ref: movable.ref, style: movable.style, onClickCapture: movable.onClickCapture }
  const movedClass = movable.moved ? ' qvl-eclaireur-moved' : ''

  if (mode === 'closed') {
    return <button type="button" {...moveProps} onPointerDown={movable.onPointerDown} title="Rouvrir le guide · glisser pour le déplacer" className={`qvl-eclaireur-help qvl-eclaireur-side-${side}${movedClass}`} onClick={onRestore} aria-label="Rouvrir le guide"><span aria-hidden="true">✦</span>Guide</button>
  }

  if (mode === 'minimized') {
    return <div {...moveProps} onPointerDown={movable.onPointerDown} title="Glisser pour déplacer le guide" className={`qvl-eclaireur-minimized qvl-eclaireur-side-${side}${movedClass}`} aria-label={`Guide, étape ${number} sur 3, réduit`}>
      <button type="button" className="qvl-eclaireur-minimized-main" onClick={onRestore} aria-label="Déployer le guide"><span aria-hidden="true">✦</span><strong>Guide</strong><small>{number}/3</small></button>
      <button type="button" className="qvl-eclaireur-minimized-close" onClick={onClose} aria-label="Fermer le guide">×</button>
    </div>
  }

  let title = '1 · Choisir un point de départ'
  let body = <p>À gauche, <strong>cherchez un mot</strong> ou partez de notre fonds : un <strong>thème</strong>, une publication ou un <strong>type d’élément</strong> (tendances, recommandations…).</p>
  if (step === 'results') {
    title = '2 · Garder ce qui sert'
    body = <p>À droite, la base montre ce qu’elle contient, avec la publication et la page. Cliquez sur <strong>+ Garder</strong> pour placer un élément sur le canevas.</p>
  } else if (step === 'canvas') {
    title = '3 · Construire votre réflexion'
    body = <p>Ajoutez vos questions, idées et notes avec les boutons <strong>Créer un post-it</strong> en haut, puis <strong>reliez les cartes</strong> pour faire apparaître votre raisonnement.</p>
  }

  return <aside {...moveProps} className={`qvl-eclaireur-guide qvl-eclaireur-step-${step} qvl-eclaireur-side-${side}${movedClass}`} aria-live="polite" aria-label={`Guide, étape ${number} sur 3`}>
    <header className="qvl-eclaireur-visual-header" onPointerDown={movable.onPointerDown} title="Glisser pour déplacer le guide">
      <div className="qvl-eclaireur-brand"><span className="qvl-eclaireur-compass" aria-hidden="true">✦</span><div><strong>Guide</strong><small>VOTRE GUIDE DANS CET ESPACE</small></div></div>
      <div className="qvl-eclaireur-header-actions"><span>{number}/3</span><button type="button" className="qvl-eclaireur-minimize" onClick={onMinimize} aria-label="Réduire le guide">−</button><button type="button" className="qvl-eclaireur-close" onClick={onClose} aria-label="Fermer le guide">×</button></div>
      <div className="qvl-eclaireur-lighthouse" aria-hidden="true"><span className="qvl-eclaireur-lighthouse-light"/><span className="qvl-eclaireur-lighthouse-top"/><span className="qvl-eclaireur-lighthouse-body"/><span className="qvl-eclaireur-lighthouse-base"/></div>
    </header>
    <div className="qvl-eclaireur-body">
      <h3>{title}</h3>
      {body}
      <div className="qvl-eclaireur-footer">
        <div className="qvl-eclaireur-dots" aria-hidden="true">{steps.map((item, dotIndex) => <i key={item} className={dotIndex === index ? 'active' : ''}/>)}</div>
      </div>
    </div>
  </aside>
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

// ---------------------------------------------------------------------------
// Volet gauche : chercher un mot d'abord, puis valoriser le fonds (thèmes,
// publications, types d'éléments). Tous les nombres viennent de la base.
// ---------------------------------------------------------------------------
function CorpusStart({ index, query, setQuery, onSearch, inputRef, openTheme, selection, onTheme, onPublication, onType }) {
  const featured = index.typeStats.filter(stat => FEATURED_TYPES.includes(stat.id) && stat.count > 0)
  const activePub = selection?.kind === 'publication' ? selection.publication?.publication_id : ''
  return <div className="qce-start">
    <form className="qce-search" onSubmit={onSearch} role="search">
      <label htmlFor="qce-query">Chercher dans les publications</label>
      <div className="qce-search-row">
        <input id="qce-query" ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Un mot, un sujet : incendie, narcotrafic…" autoComplete="off"/>
        <button type="submit" disabled={!query.trim()}><Icon name="search" size={16}/><span>Chercher</span></button>
      </div>
    </form>

    <h3 className="qce-label">Ou partir de notre fonds · par thème</h3>
    <div className="qce-themes">
      {index.themes.map(theme => {
        const open = openTheme === theme.label
        const active = selection?.kind === 'theme' && selection.title === theme.label
        return <div key={theme.label} className={`qce-theme ${open ? 'open' : ''}`}>
          <button type="button" className={`qce-theme-btn ${active ? 'active' : ''}`} aria-expanded={open} onClick={() => onTheme(theme.label)}>
            <span>{theme.label}</span><em>{theme.publications.length}</em>
          </button>
          {open && <ul className="qce-pubs">
            {theme.publications.map(pub => <li key={pub.publication_id}>
              <button type="button" className={activePub === pub.publication_id ? 'active' : ''} onClick={() => onPublication(pub.publication_id)} title={pub.title}>{pub.title}</button>
            </li>)}
          </ul>}
        </div>
      })}
    </div>

    {featured.length > 0 && <>
      <h3 className="qce-label">Ou par type d’élément</h3>
      <div className="qce-types">
        {featured.map(stat => <button key={stat.id} type="button" className={`qce-type ${selection?.kind === 'type' && selection.groupId === stat.id ? 'active' : ''}`} onClick={() => onType(stat.id)}>
          <strong>{stat.count}</strong><span>{stat.label}</span><small>{stat.pubCount} publication{stat.pubCount > 1 ? 's' : ''}</small>
        </button>)}
      </div>
    </>}
  </div>
}

// ---------------------------------------------------------------------------
// Volet droit : ce que la base contient pour la sélection, classé par type.
// Un onglet n'apparaît que s'il contient au moins un élément.
// ---------------------------------------------------------------------------
const PAGE_SIZE = 25

function CorpusResults({ index, selection, keptIds, onKeep, onProof, onPublication }) {
  const [tab, setTab] = useState('')
  const [shown, setShown] = useState(PAGE_SIZE)
  const boxRef = useRef(null)

  const tabs = useMemo(() => {
    if (!selection) return []
    const list = ELEMENT_TYPES
      .map(group => ({ id: group.id, label: group.label, items: selection.elements.filter(el => el.group === group.id) }))
      .filter(entry => entry.items.length)
    if (selection.passages?.length) list.push({ id: 'passages', label: 'Passages', items: selection.passages })
    return list
  }, [selection])

  useEffect(() => {
    setShown(PAGE_SIZE)
    if (boxRef.current) boxRef.current.scrollTop = 0
    if (!selection) { setTab(''); return }
    // Pour une recherche, on ouvre d'abord le type le plus fourni en éléments
    // structurés ; à défaut, les passages.
    setTab(tabs[0]?.id || '')
  }, [selection]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!selection) {
    return <div className="qce-results qce-overview">
      <h2>Ce que contient la base</h2>
      <p className="qce-muted">Les résultats s’afficheront ici, chacun avec sa publication et sa page.</p>
      <div className="qce-totals">
        <div><strong>{index.totals.publications}</strong><span>publications</span></div>
        <div><strong>{index.totals.passages.toLocaleString('fr-FR')}</strong><span>passages consultables</span></div>
        <div><strong>{index.totals.acteurs}</strong><span>acteurs</span></div>
        <div><strong>{index.totals.actions}</strong><span>actions</span></div>
      </div>
      <p className="qce-warning">Une absence de résultat signifie que les publications du bulletin n’en parlent pas, pas que le sujet n’existe pas.</p>
    </div>
  }

  const current = tabs.find(entry => entry.id === tab) || tabs[0]
  const items = current?.items || []
  const isType = selection.kind === 'type'
  const pubCount = selection.publications.length
  const empty = !tabs.length

  // Pour un type parcouru sur toute la base, on regroupe par publication.
  const grouped = isType ? groupByPublication(items.slice(0, shown)) : null

  return <div className="qce-results" ref={boxRef}>
    <header className="qce-results-head">
      <div>
        <span className="qce-kicker">{selection.kind === 'search' ? 'Recherche' : selection.kind === 'theme' ? 'Thème' : selection.kind === 'publication' ? 'Publication' : 'Type d’élément'}</span>
        <h2>{selection.kind === 'search' ? `« ${selection.title} »` : selection.title}</h2>
        {selection.subtitle && <p className="qce-muted">{selection.subtitle}</p>}
      </div>
      {selection.kind !== 'publication' && <span className="qce-count">{pubCount} publication{pubCount > 1 ? 's' : ''}</span>}
    </header>

    {selection.kind === 'publication' && selection.publication && <PublicationLinks pub={selection.publication}/>}

    {empty ? <div className="qce-empty">
      <strong>{selection.tooShort ? 'Tapez au moins un mot de trois lettres.' : 'La base ne contient rien sur ce point pour le moment.'}</strong>
      {!selection.tooShort && <p>Essayez un mot plus court ou plus général (« drogue » plutôt que « trafic de drogues de synthèse »), ou partez d’un thème. Une absence de résultat ne signifie pas que le sujet n’existe pas en dehors du bulletin.</p>}
    </div> : <>
      {selection.kind !== 'publication' && !isType && pubCount > 0 && <PublicationList pubs={selection.publications} onPublication={onPublication}/>}

      {tabs.length > 1 && <div className="qce-tabs" role="tablist" aria-label="Types d’éléments">
        {tabs.map(entry => <button key={entry.id} type="button" role="tab" aria-selected={entry.id === current?.id} className={entry.id === current?.id ? 'active' : ''} onClick={() => { setTab(entry.id); setShown(PAGE_SIZE) }}>
          {entry.label}<em>{entry.items.length}</em>
        </button>)}
      </div>}
      {tabs.length === 1 && <p className="qce-single-tab">{current.label} · {items.length}</p>}

      <div className="qce-items" role="tabpanel">
        {isType
          ? grouped.map(group => <section key={group.pub.publication_id} className="qce-group">
              <button type="button" className="qce-group-title" onClick={() => onPublication(group.pub.publication_id)}>{group.pub.title}</button>
              {group.items.map(item => <ResultItem key={item.material_id} item={item} kept={keptIds.has(item.material_id)} onKeep={onKeep} onProof={onProof} hidePublication/>)}
            </section>)
          : items.slice(0, shown).map(item => <ResultItem key={item.material_id} item={item} kept={keptIds.has(item.material_id)} onKeep={onKeep} onProof={onProof} hidePublication={selection.kind === 'publication'}/>)}
      </div>
      {items.length > shown && <button type="button" className="qce-more" onClick={() => setShown(value => value + PAGE_SIZE)}>Afficher {Math.min(PAGE_SIZE, items.length - shown)} de plus ({items.length - shown} restant{items.length - shown > 1 ? 's' : ''})</button>}
    </>}
  </div>
}

function groupByPublication(items) {
  const map = new Map()
  items.forEach(item => {
    if (!map.has(item.publication_id)) map.set(item.publication_id, { pub: { publication_id: item.publication_id, title: displayPubTitle(item.publication_title) }, items: [] })
    map.get(item.publication_id).items.push(item)
  })
  return [...map.values()]
}

function displayPubTitle(title) {
  const value = String(title || '').trim()
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

function PublicationList({ pubs, onPublication }) {
  const [all, setAll] = useState(false)
  const visible = all ? pubs : pubs.slice(0, 4)
  return <div className="qce-publist">
    {visible.map(pub => <button key={pub.publication_id} type="button" onClick={() => onPublication(pub.publication_id)} title="Voir tout ce que contient cette publication">
      <span>{pub.title}</span><Icon name="chevron" size={13}/>
    </button>)}
    {pubs.length > 4 && <button type="button" className="qce-publist-more" onClick={() => setAll(value => !value)}>{all ? 'Réduire la liste' : `+ ${pubs.length - 4} autre${pubs.length - 4 > 1 ? 's' : ''}`}</button>}
  </div>
}

function PublicationLinks({ pub }) {
  const href = pub.url_contenu || pub.url_source
  return <div className="qce-publinks">
    <span>{[pub.theme, pub.domaine && pub.domaine !== pub.theme ? pub.domaine : ''].filter(Boolean).join(' · ')}</span>
    {href && <a href={href} target="_blank" rel="noreferrer"><Icon name="external" size={13}/>Ouvrir la publication</a>}
  </div>
}

function ResultItem({ item, kept, onKeep, onProof, hidePublication = false }) {
  const isPassage = item.material_id.startsWith('chunk:')
  const text = isPassage ? shortText(item.text, 320) : item.label
  const where = [hidePublication ? '' : displayPubTitle(item.publication_title), item.pages].filter(Boolean).join(' · ')
  return <article className={`qce-item ${isPassage ? 'passage' : ''}`}>
    <div className="qce-item-text">
      <p>{text}</p>
      {where && <small>{where}</small>}
    </div>
    <div className="qce-item-actions">
      <button type="button" className={`qce-keep ${kept ? 'kept' : ''}`} onClick={() => onKeep(item)} disabled={kept}>{kept ? 'Gardé ✓' : '+ Garder'}</button>
      <button type="button" className="qce-proof" onClick={() => onProof(item)}>Preuve</button>
    </div>
  </article>
}
