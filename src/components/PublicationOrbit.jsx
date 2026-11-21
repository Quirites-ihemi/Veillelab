import React, { useEffect, useMemo, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// ONGLET 2 — « Orbites autour d'un sujet »
//
// Une seule publication. L'entité explorée est au centre ; les entités qui
// lui sont directement liées gravitent sur une première orbite, avec le verbe
// de la relation ; les liens de second rang restent en retrait sur une orbite
// extérieure ; les autres entités forment un halo discret. Un clic sur
// n'importe quelle entité la place au centre : on navigue de proche en proche
// dans le texte.
//
// Aucune donnée n'est inventée : entités, relations, verbes, pages et
// extraits proviennent de nodes.json, relations.json et contents.json.
// ---------------------------------------------------------------------------

export const ORBIT_TYPES = {
  acteur: ['Acteur', '#7FB2FF'],
  expert_public: ['Expert public', '#A9D4FF'],
  action: ['Action', '#FF9F6B'],
  notion_idee: ['Notion', '#B79CFF'],
  probleme: ['Problème', '#FF6B81'],
  'Problème': ['Problème', '#FF6B81'],
  localisation: ['Localisation', '#3FE0C5'],
  signal_faible: ['Signal faible', '#FFD166'],
  recommandation: ['Recommandation', '#8CF08A'],
  tendance: ['Tendance', '#F7A8FF'],
  tendance_forte: ['Tendance forte', '#FF8FD0'],
  instrument_dispositif: ['Instrument / dispositif', '#6FE3FF'],
  methode: ['Méthode', '#FFC48C'],
}

export const normalizeType = t => (t === 'Problème' ? 'probleme' : t)

// Définition courte de chaque type, affichée en infobulle dans la liste des types.
export const TYPE_HINTS = {
  acteur: 'Organisation, institution ou personne qui intervient dans la publication.',
  expert_public: 'Agent public, auteur ou intervenant, dont l’expertise est mobilisée dans la publication.',
  action: 'Ce qui est fait ou engagé : mesure, opération, programme.',
  notion_idee: 'Concept ou idée structurante du texte.',
  probleme: 'Difficulté, risque ou enjeu identifié par la publication.',
  localisation: 'Lieu, territoire ou zone géographique cité.',
  signal_faible: 'Indice discret d’une évolution possible, encore peu visible.',
  recommandation: 'Proposition formulée par les auteurs.',
  tendance: 'Évolution observée dans la durée.',
  tendance_forte: 'Évolution de fond, durable et bien établie.',
  instrument_dispositif: 'Outil juridique, technique ou organisationnel existant.',
  methode: 'Manière de faire, démarche ou approche décrite.',
}
export const typeHint = t => TYPE_HINTS[normalizeType(t)] || ''
export const typeLabel = t => (ORBIT_TYPES[t] || [t || 'Élément'])[0]
export const typeColor = t => (ORBIT_TYPES[t] || [null, '#B79CFF'])[1]

// Verbes de relation : SE_DECLINE_EN → « se décline en », S_INSCRIT_DANS →
// « s’inscrit dans », MET_EN_OEUVRE → « met en œuvre »…
const WORD = {
  A: 'à', REPOND: 'répond', CARACTERISE: 'caractérise', ASSOCIE: 'associé', DECLINE: 'décline',
  OBSERVEE: 'observée', LOCALISE: 'localisé', OEUVRE: 'œuvre', ELEVE: 'élevé', MENE: 'mène',
  REUSSITE: 'réussite', CONCERNES: 'concernés', PRECONISE: 'préconise', CODEVELOPPE: 'codéveloppe',
  DEVELOPPE: 'développe', PRESENTE: 'présente', PRECEDE: 'précède', SPECIALISE: 'spécialisé',
  IDENTIFIE: 'identifié', DETECTE: 'détecte', SECURISE: 'sécurise', EVIDENCE: 'évidence',
  ACCROIT: 'accroît', ECLAIRE: 'éclaire', PRESIDE: 'préside', PREVENIR: 'prévenir',
  TOUCHE: 'touché', ETE: 'été', DESTINATAIRE: 'destinataire', REPOSE: 'repose', PRISE: 'prise',
}
export function verbLabel(v = '') {
  const raw = String(v || '').trim()
  if (!raw) return 'relation'
  if (raw === 'ASSOCIATION') return 'associé à'
  const parts = raw.split('_').filter(Boolean)
  let out = []
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i]
    if (p === 'S' && i + 1 < parts.length) {
      out.push(`s’${(WORD[parts[i + 1]] || parts[i + 1].toLowerCase())}`)
      i += 1
      continue
    }
    out.push(WORD[p] || p.toLowerCase())
  }
  return out.join(' ')
}

// Repères d'une entité : pages (« 12 »), plages (« 16-32 ») ou timecodes
// (« 08:25 », « 02:34-04:06 »). Les intitulés non localisables sont ignorés.
const TIMECODE_RE = /^\d{1,2}:\d{2}(?::\d{2})?$/
const LOCATOR_RE = /^(\d{1,2}:\d{2}(?::\d{2})?|\d+)(?:\s*[-–]\s*(\d{1,2}:\d{2}(?::\d{2})?|\d+))?$/
const locatorKey = v => {
  const first = String(v).split(/[-–]/)[0].trim()
  if (TIMECODE_RE.test(first)) return first.split(':').reduce((acc, x) => acc * 60 + Number(x), 0)
  return Number(first)
}
export const isTimecode = v => TIMECODE_RE.test(String(v ?? '').trim())
export const pagesOf = n =>
  [...new Set(String(n?.page_source || '')
    .split(/[;,]/)
    .map(x => x.trim().replace(/\s*[-–]\s*/, '-'))
    .filter(x => LOCATOR_RE.test(x) && !/^0+$/.test(x)))]
    .sort((a, b) => locatorKey(a) - locatorKey(b))
// Libellé d'un repère de chunk : « p. 12–13 », « timecode 02:32–05:01 », ou rien.
export const locatorLabel = (start, end) => {
  const a = String(start ?? '').trim()
  const b = String(end ?? '').trim()
  if (!a && !b) return ''
  const span = a && b && b !== a ? `${a}–${b}` : (a || b)
  return `${isTimecode(a || b) ? 'timecode' : 'p.'} ${span}`
}

const FONT = 'Manrope, "Segoe UI", Roboto, system-ui, sans-serif'
const SERIF = '"Source Serif 4", Georgia, "Times New Roman", serif'
let ctx = null
function measure(text, font) {
  if (typeof document === 'undefined') return String(text).length * 8
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')
  ctx.font = font
  return ctx.measureText(String(text)).width
}
function wrap(text, maxWidth, font) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let cur = ''
  words.forEach(w => {
    const next = cur ? `${cur} ${w}` : w
    if (cur && measure(next, font) > maxWidth) { lines.push(cur); cur = w } else cur = next
  })
  if (cur) lines.push(cur)
  return lines
}
const overlap = (a, b, m = 0) =>
  !(a.x1 + m <= b.x0 || b.x1 + m <= a.x0 || a.y1 + m <= b.y0 || b.y1 + m <= a.y0)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

// Le bandeau « Fil du document » a été retiré : plus de réserve en bas du graphe.
const STRIP_H = 0
const TOP_H = 54
const TYPE_ORDER = Object.keys(ORBIT_TYPES)

// Vue d'ensemble : disposition « à ressorts » déterministe (Fruchterman-
// Reingold) des seuls éléments reliés. Même publication → même dessin.
function forceLayout(ids, links) {
  const N = ids.length
  const index = new Map(ids.map((id, i) => [id, i]))
  const P = ids.map((_, i) => {
    const r = Math.sqrt((i + 0.5) / N)
    const a = i * 2.399963
    return { x: Math.cos(a) * r, y: Math.sin(a) * r }
  })
  const E = links
    .map(([a, b]) => [index.get(a), index.get(b)])
    .filter(([a, b]) => a != null && b != null && a !== b)
  if (N < 2) return P
  const k = Math.sqrt(1 / N)
  let temp = 0.1
  for (let it = 0; it < 420; it += 1) {
    const D = P.map(() => ({ x: 0, y: 0 }))
    for (let i = 0; i < N; i += 1) {
      for (let j = i + 1; j < N; j += 1) {
        const dx = P[i].x - P[j].x
        const dy = P[i].y - P[j].y
        const d = Math.max(1e-3, Math.hypot(dx, dy))
        const f = (k * k) / d
        D[i].x += (dx / d) * f; D[i].y += (dy / d) * f
        D[j].x -= (dx / d) * f; D[j].y -= (dy / d) * f
      }
    }
    E.forEach(([a, b]) => {
      const dx = P[a].x - P[b].x
      const dy = P[a].y - P[b].y
      const d = Math.max(1e-3, Math.hypot(dx, dy))
      const f = (d * d) / k
      D[a].x -= (dx / d) * f; D[a].y -= (dy / d) * f
      D[b].x += (dx / d) * f; D[b].y += (dy / d) * f
    })
    P.forEach((p, i) => {
      D[i].x -= p.x * 1.6 * k
      D[i].y -= p.y * 1.6 * k
      const len = Math.hypot(D[i].x, D[i].y)
      if (len > 0) {
        const m = Math.min(len, temp)
        p.x += (D[i].x / len) * m
        p.y += (D[i].y / len) * m
      }
    })
    temp = Math.max(0.002, temp * 0.985)
  }
  return P
}

export default function PublicationOrbit({
  nodes,
  relations,
  focusId,
  onFocus,
  onOpenRelation,
  onOpenProof,
  highlightIds = [],
  contents = [],
  resetToken = 0,
}) {
  const wrapRef = useRef(null)
  const svgRef = useRef(null)
  const groupRef = useRef(null)
  const dragRef = useRef(null)
  const movedRef = useRef(0)
  const [size, setSize] = useState({ w: 900, h: 700 })
  const [hoverId, setHoverId] = useState(null)
  const [scale, setScale] = useState(1)
  // Bouton « Noms » : nomme aussi les éléments des cercles extérieurs
  // (indispensable sur tablette, où le survol n'existe pas).
  const [showNames, setShowNames] = useState(() => {
    try { return localStorage.getItem('qvl:explorer:showNames') !== '0' } catch { return true }
  })
  const toggleNames = () => setShowNames(value => {
    const next = !value
    try { localStorage.setItem('qvl:explorer:showNames', next ? '1' : '0') } catch {}
    return next
  })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [fontsReady, setFontsReady] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const m = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) setSize(s => (Math.abs(s.w - r.width) < 1 && Math.abs(s.h - r.height) < 1 ? s : { w: r.width, h: r.height }))
    }
    m()
    const ro = new ResizeObserver(m)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let alive = true
    const f = document.fonts
    if (f?.load) {
      Promise.all([f.load(`600 18px ${SERIF}`), f.load(`600 13px ${FONT}`)])
        .then(() => alive && setFontsReady(x => x + 1)).catch(() => {})
    }
    return () => { alive = false }
  }, [])

  // Chaque changement de sujet recentre la vue.
  useEffect(() => { setScale(1); setPan({ x: 0, y: 0 }) }, [focusId, resetToken])

  const byId = useMemo(() => new Map(nodes.map(n => [n.node_id, n])), [nodes])

  const adjacency = useMemo(() => {
    const m = new Map()
    nodes.forEach(n => m.set(n.node_id, []))
    relations.forEach(r => {
      if (!m.has(r.source_id) || !m.has(r.cible_id)) return
      m.get(r.source_id).push({ rel: r, other: r.cible_id })
      m.get(r.cible_id).push({ rel: r, other: r.source_id })
    })
    return m
  }, [nodes, relations])

  const highlight = useMemo(() => new Set(highlightIds || []), [highlightIds])

  // ------------------------------------------------------------------ modèle
  const model = useMemo(() => {
    const W = size.w
    const H = size.h
    const focus = byId.get(focusId)
    if (!focus) return null

    const top = TOP_H
    const bottom = H - STRIP_H - 10
    const cx = W / 2
    const cy = (top + bottom) / 2 + 4
    const availH = bottom - top

    // Premier cercle : voisins directs, groupés par type puis par libellé.
    const ring1Map = new Map()
    ;(adjacency.get(focusId) || []).forEach(({ rel, other }) => {
      if (!ring1Map.has(other)) ring1Map.set(other, [])
      ring1Map.get(other).push(rel)
    })
    const ring1 = [...ring1Map.keys()]
      .map(id => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => {
        const ta = TYPE_ORDER.indexOf(normalizeType(a.type_noeud))
        const tb = TYPE_ORDER.indexOf(normalizeType(b.type_noeud))
        return ta - tb || a.libelle.localeCompare(b.libelle, 'fr')
      })

    const n1 = ring1.length
    const dense = n1 > 12
    const rx1 = Math.min(W * 0.28, 320)
    const ry1 = Math.min(availH * 0.36, 240)
    const pos = new Map()
    pos.set(focusId, { x: cx, y: cy, ring: 0, angle: 0 })
    ring1.forEach((n, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, n1) + (n1 % 2 === 0 ? Math.PI / Math.max(2, n1) : 0)
      const k = dense ? (i % 2 ? 1.12 : 0.9) : 1
      pos.set(n.node_id, { x: cx + Math.cos(a) * rx1 * k, y: cy + Math.sin(a) * ry1 * k, ring: 1, angle: a })
    })

    // Second cercle : voisins des voisins, placés près de leur « parent ».
    const ring1Set = new Set(ring1.map(n => n.node_id))
    const ring2Parent = new Map()
    ring1.forEach(n => {
      ;(adjacency.get(n.node_id) || []).forEach(({ other }) => {
        if (other === focusId || ring1Set.has(other) || ring2Parent.has(other)) return
        ring2Parent.set(other, n.node_id)
      })
    })
    const rx2 = Math.min(rx1 * 1.58, W / 2 - 26)
    const ry2 = Math.min(ry1 * 1.5, availH / 2 - 10)
    const ring2 = [...ring2Parent.entries()]
      .map(([id, parent]) => ({ id, angle: pos.get(parent).angle }))
      .sort((a, b) => a.angle - b.angle)
    const minGap = ring2.length ? Math.min((2 * Math.PI) / ring2.length, 0.2) : 0
    for (let i = 1; i < ring2.length; i += 1) {
      if (ring2[i].angle - ring2[i - 1].angle < minGap) ring2[i].angle = ring2[i - 1].angle + minGap
    }
    ring2.forEach(({ id, angle }) => {
      pos.set(id, { x: cx + Math.cos(angle) * rx2, y: cy + Math.sin(angle) * ry2, ring: 2, angle })
    })

    // Les autres entités : halo discret sur une orbite extérieure.
    const rest = nodes.filter(n => !pos.has(n.node_id))
    const rx3 = Math.min(rx1 * 1.9, W / 2 - 14)
    const ry3 = Math.min(ry1 * 1.78, availH / 2 - 2)
    rest.forEach((n, i) => {
      const a = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / Math.max(1, rest.length)
      pos.set(n.node_id, { x: cx + Math.cos(a) * rx3, y: cy + Math.sin(a) * ry3, ring: 3, angle: a })
    })

    // Rayons des cœurs (pixels).
    const radius = n => {
      const p = pos.get(n.node_id)
      if (!p) return 3
      if (p.ring === 0) return 22
      if (p.ring === 1) return 8 + Math.min(5, (adjacency.get(n.node_id) || []).length * 0.6)
      if (p.ring === 2) return 5.5
      return 3.4
    }

    // Boîtes déjà occupées : nœuds du premier cercle et sujet central.
    const placed = []
    ring1.forEach(n => {
      const p = pos.get(n.node_id)
      const r = radius(n) + 4
      placed.push({ x0: p.x - r, x1: p.x + r, y0: p.y - r, y1: p.y + r })
    })
    placed.push({ x0: cx - 30, x1: cx + 30, y0: cy - 30, y1: cy + 30 })

    // Libellé du sujet : pastille sous l'orbe.
    const focusFont = `600 18px ${SERIF}`
    const focusLines = wrap(focus.libelle, 280, focusFont)
    const fw = Math.max(...focusLines.map(l => measure(l, focusFont))) + 30
    const fh = focusLines.length * 23 + 16
    const focusBox = { x0: cx - fw / 2, x1: cx + fw / 2, y0: cy + 34, y1: cy + 34 + fh }
    placed.push(focusBox)

    // Libellés du premier cercle : à l'extérieur, décalés vers l'extérieur
    // jusqu'à ne plus rien recouvrir ; sinon révélés au survol.
    const labelSize = dense ? 12.5 : 13.5
    const labelFont = `600 ${labelSize}px ${FONT}`
    const lineH = labelSize * 1.28
    const labels = new Map()
    ring1.forEach(n => {
      const p = pos.get(n.node_id)
      const r = radius(n)
      const lines = wrap(n.libelle, dense || W < 900 ? 140 : 178, labelFont)
      const w = Math.max(...lines.map(l => measure(l, labelFont)))
      const h = lines.length * lineH
      const c = Math.cos(p.angle)
      const s = Math.sin(p.angle)
      let found = null
      for (let step = 0; step < 14 && !found; step += 1) {
        const d = r + 9 + step * 8
        let x0, y0, anchor
        if (Math.abs(c) > 0.32) {
          anchor = c > 0 ? 'start' : 'end'
          const ax = p.x + c * d + (c > 0 ? 2 : -2)
          x0 = c > 0 ? ax : ax - w
          y0 = p.y + s * step * 8 - h / 2
        } else {
          anchor = 'middle'
          x0 = p.x - w / 2
          y0 = s < 0 ? p.y - d - h : p.y + d
        }
        x0 = clamp(x0, 6, W - 6 - w)
        y0 = clamp(y0, top - 6, bottom - h)
        const box = { x0: x0 - 3, x1: x0 + w + 3, y0: y0 - 2, y1: y0 + h + 2 }
        if (!placed.some(b => overlap(box, b))) found = { box, x0, y0, w, anchor }
      }
      if (found) {
        placed.push(found.box)
        const tx = found.anchor === 'start' ? found.x0 : found.anchor === 'end' ? found.x0 + found.w : found.x0 + found.w / 2
        labels.set(n.node_id, { lines, tx, ty: found.y0 + labelSize - 1, anchor: found.anchor, size: labelSize, lineH })
      }
    })

    // Verbes : pastille cliquable sur le trait, là où elle ne gêne rien.
    const pillFont = `600 12px ${FONT}`
    const pills = []
    // Orbite très peuplée : les verbes ne sont montrés qu'au survol (et dans
    // la fiche, volet « Relations »), pour ne pas saturer le graphe.
    if (!dense) ring1.forEach(n => {
      const rels = ring1Map.get(n.node_id) || []
      if (!rels.length) return
      const p = pos.get(n.node_id)
      const text = verbLabel(rels[0].type_relation) + (rels.length > 1 ? ` +${rels.length - 1}` : '')
      const w = measure(text, pillFont) + 16
      for (const f of [0.56, 0.68, 0.44, 0.8]) {
        const x = cx + (p.x - cx) * f
        const y = cy + (p.y - cy) * f
        const box = { x0: x - w / 2, x1: x + w / 2, y0: y - 11, y1: y + 11 }
        if (!placed.some(b => overlap(box, b, 2))) {
          placed.push(box)
          pills.push({ id: n.node_id, rel: rels[0], text, x, y, w })
          break
        }
      }
    })

    // Noms des cercles extérieurs (bouton « Noms ») : une ligne, tronquée,
    // posée vers l'extérieur ; un nom qui recouvrirait autre chose est omis.
    const outerLabels = []
    let outerHidden = 0
    if (showNames) {
      const outer = nodes.filter(n => { const p = pos.get(n.node_id); return p && p.ring >= 2 })
      outer.forEach(n => {
        const p = pos.get(n.node_id)
        const r = radius(n) + 3
        placed.push({ x0: p.x - r, x1: p.x + r, y0: p.y - r, y1: p.y + r })
      })
      const size = dense ? 11 : 11.5
      const font = `500 ${size}px ${FONT}`
      const h = size * 1.3
      outer
        .sort((a, b) => pos.get(a.node_id).ring - pos.get(b.node_id).ring)
        .forEach(n => {
          const p = pos.get(n.node_id)
          const maxW = p.ring === 2 ? 165 : 135
          let text = String(n.libelle || '')
          if (measure(text, font) > maxW) {
            while (text.length > 4 && measure(`${text}…`, font) > maxW) text = text.slice(0, -1)
            text = `${text.trim()}…`
          }
          const w = measure(text, font)
          const c = Math.cos(p.angle)
          const sn = Math.sin(p.angle)
          const r = radius(n)
          let found = null
          // Vers l'extérieur d'abord ; au bord de l'écran, vers l'intérieur.
          for (let attempt = 0; attempt < 12 && !found; attempt += 1) {
            const step = attempt % 6
            const inward = attempt >= 6
            const d = r + 5 + step * 6
            let x0, y0, anchor
            if (Math.abs(c) > 0.32) {
              const right = (c > 0) !== inward
              anchor = right ? 'start' : 'end'
              x0 = right ? p.x + d : p.x - d - w
              y0 = p.y - h / 2 + (step % 2 ? 1 : -1) * Math.ceil(step / 2) * (h * 0.8)
            } else if (inward) {
              anchor = 'middle'
              x0 = p.x - w / 2 + (step % 2 ? 1 : -1) * Math.ceil(step / 2) * 12
              y0 = sn < 0 ? p.y + d : p.y - d - h
            } else {
              anchor = 'middle'
              x0 = p.x - w / 2 + (step % 2 ? 1 : -1) * Math.ceil(step / 2) * 12
              y0 = sn < 0 ? p.y - d - h : p.y + d
            }
            if (x0 < 6 || x0 + w > W - 6 || y0 < top - 6 || y0 + h > bottom) continue
            const box = { x0: x0 - 2, x1: x0 + w + 2, y0: y0 - 1, y1: y0 + h + 1 }
            if (!placed.some(b => overlap(box, b))) found = { box, x0, y0, w, anchor }
          }
          if (!found) { outerHidden += 1; return }
          placed.push(found.box)
          const tx = found.anchor === 'start' ? found.x0 : found.anchor === 'end' ? found.x0 + found.w : found.x0 + found.w / 2
          outerLabels.push({ id: n.node_id, text, full: n.libelle, tx, ty: found.y0 + size - 1, anchor: found.anchor, size, ring: p.ring })
        })
    }

    const edges = []
    relations.forEach((r, index) => {
      const a = pos.get(r.source_id)
      const b = pos.get(r.cible_id)
      if (!a || !b) return
      const touchesFocus = r.source_id === focusId || r.cible_id === focusId
      const level = touchesFocus ? 1 : (a.ring <= 1 && b.ring <= 2) || (b.ring <= 1 && a.ring <= 2) ? 2 : 3
      edges.push({ r, a, b, level, key: `${r.relation_id || index}` })
    })

    return { W, H, cx, cy, pos, ring1, ring1Map, radius, labels, pills, outerLabels, outerHidden, edges, focus, focusLines, focusBox, rx1, ry1, rx2, ry2, rx3, ry3, top, bottom, dense }
  }, [size, byId, adjacency, focusId, nodes, relations, fontsReady, showNames])

  // ------------------------------------------------- vue d'ensemble (entrée)
  // Aucun élément n'est mis en avant : tous les éléments reliés sont
  // disposés selon leurs liens ; les éléments sans lien forment le halo.
  const ov = useMemo(() => {
    if (focusId || !nodes.length) return null
    const W = size.w
    const H = size.h
    const top = TOP_H
    const bottom = H - STRIP_H - 10
    const cx = W / 2
    const cy = (top + bottom) / 2 + 4
    const availH = bottom - top
    const deg = new Map(nodes.map(n => [n.node_id, (adjacency.get(n.node_id) || []).length]))
    const byType = (a, b) => {
      const ta = TYPE_ORDER.indexOf(normalizeType(a.type_noeud))
      const tb = TYPE_ORDER.indexOf(normalizeType(b.type_noeud))
      return ta - tb || a.libelle.localeCompare(b.libelle, 'fr')
    }
    const linked = nodes.filter(n => deg.get(n.node_id) > 0).sort(byType)
    const lone = nodes.filter(n => !deg.get(n.node_id)).sort(byType)

    const rx1 = Math.min(W * 0.28, 320)
    const ry1 = Math.min(availH * 0.36, 240)
    const rx3 = Math.min(rx1 * 1.9, W / 2 - 14)
    const ry3 = Math.min(ry1 * 1.78, availH / 2 - 2)
    const hw = lone.length ? rx3 * 0.74 : W / 2 - 110
    const hh = lone.length ? ry3 * 0.66 : availH / 2 - 46

    const pos = new Map()
    const ids = linked.map(n => n.node_id)
    const P = forceLayout(ids, relations.map(r => [r.source_id, r.cible_id]))
    if (P.length) {
      const xs = P.map(p => p.x)
      const ys = P.map(p => p.y)
      const bx = (Math.min(...xs) + Math.max(...xs)) / 2
      const by = (Math.min(...ys) + Math.max(...ys)) / 2
      const bw = Math.max(1e-3, (Math.max(...xs) - Math.min(...xs)) / 2)
      const bh = Math.max(1e-3, (Math.max(...ys) - Math.min(...ys)) / 2)
      let sx = hw / bw
      let sy = hh / bh
      const s = Math.min(sx, sy)
      sx = Math.min(sx, s * 1.5)
      sy = Math.min(sy, s * 1.5)
      // Petits graphes : on évite des liens démesurés.
      const idx = new Map(ids.map((id, i) => [id, i]))
      const lens = relations
        .map(r => [idx.get(r.source_id), idx.get(r.cible_id)])
        .filter(([a, b]) => a != null && b != null)
        .map(([a, b]) => Math.hypot((P[a].x - P[b].x) * sx, (P[a].y - P[b].y) * sy))
      const avg = lens.length ? lens.reduce((x, y) => x + y, 0) / lens.length : 0
      if (avg > 170) { sx *= 170 / avg; sy *= 170 / avg }
      ids.forEach((id, i) => pos.set(id, { x: cx + (P[i].x - bx) * sx, y: cy + (P[i].y - by) * sy, ring: 1, angle: Math.atan2(P[i].y - by, P[i].x - bx) }))
    }
    lone.forEach((n, i) => {
      const a = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / Math.max(1, lone.length)
      pos.set(n.node_id, { x: cx + Math.cos(a) * rx3, y: cy + Math.sin(a) * ry3, ring: 3, angle: a })
    })

    const maxDeg = Math.max(1, ...deg.values())
    const radius = n => {
      const p = pos.get(n.node_id)
      if (!p) return 3
      if (p.ring === 3) return 3.6
      return 5.5 + 8 * Math.sqrt((deg.get(n.node_id) || 0) / maxDeg)
    }
    const hubId = linked.length ? [...linked].sort((a, b) => deg.get(b.node_id) - deg.get(a.node_id))[0].node_id : null

    // Zone réservée au bandeau d'aide, en haut à gauche.
    const placed = [{ x0: 0, x1: Math.min(390, W - 280), y0: 0, y1: top + 6 }]
    const placedLabels = [placed[0]]
    nodes.forEach(n => {
      const p = pos.get(n.node_id)
      const r = radius(n) + 3
      placed.push({ x0: p.x - r, x1: p.x + r, y0: p.y - r, y1: p.y + r })
    })

    // Noms des éléments reliés : les plus reliés d'abord ; sans « Noms »,
    // seuls les six plus reliés sont nommés.
    const labelSize = 12.5
    const labelFont = `600 ${labelSize}px ${FONT}`
    const lineH = labelSize * 1.25
    const labels = new Map()
    let hidden = 0
    const order = [...linked].sort((a, b) => deg.get(b.node_id) - deg.get(a.node_id) || byType(a, b))
    order.forEach((n, rank) => {
      if (!showNames && rank >= 6) return
      const p = pos.get(n.node_id)
      const r = radius(n)
      let lines = wrap(n.libelle, 150, labelFont)
      if (lines.length > 2) {
        let second = lines.slice(1).join(' ')
        while (second.length > 4 && measure(`${second}…`, labelFont) > 150) second = second.slice(0, -1)
        lines = [lines[0], `${second.trim()}…`]
      }
      const w = Math.max(...lines.map(l => measure(l, labelFont)))
      const h = lines.length * lineH
      const right = p.x >= cx
      const cands = []
      for (let step = 0; step < 4; step += 1) {
        const d = r + 6 + step * 7
        const side = [
          { x0: p.x + d, y0: p.y - h / 2, anchor: 'start' },
          { x0: p.x - d - w, y0: p.y - h / 2, anchor: 'end' },
        ]
        if (!right) side.reverse()
        cands.push(...side,
          { x0: p.x - w / 2, y0: p.y + d, anchor: 'middle' },
          { x0: p.x - w / 2, y0: p.y - d - h, anchor: 'middle' })
      }
      // En dernier recours : en diagonale, au-dessus ou au-dessous.
      for (const dy of [-1, 1]) {
        for (const dir of right ? [1, -1] : [-1, 1]) {
          const y0 = dy < 0 ? p.y - r - h - 2 : p.y + r + 2
          cands.push(dir > 0 ? { x0: p.x + r * 0.6, y0, anchor: 'start' } : { x0: p.x - r * 0.6 - w, y0, anchor: 'end' })
        }
      }
      // Les trois éléments les plus reliés sont toujours nommés : leur nom
      // peut passer sur un point voisin, jamais sur un autre nom.
      const against = rank < 3 ? placedLabels : placed
      let found = null
      for (const c of cands) {
        if (c.x0 < 6 || c.x0 + w > W - 6 || c.y0 < top - 6 || c.y0 + h > bottom) continue
        const box = { x0: c.x0 - 3, x1: c.x0 + w + 3, y0: c.y0 - 2, y1: c.y0 + h + 2 }
        if (!against.some(b => overlap(box, b))) { found = { ...c, box }; break }
      }
      if (!found) { hidden += 1; return }
      placed.push(found.box)
      placedLabels.push(found.box)
      const tx = found.anchor === 'start' ? found.x0 : found.anchor === 'end' ? found.x0 + w : found.x0 + w / 2
      labels.set(n.node_id, { lines, tx, ty: found.y0 + labelSize - 1, anchor: found.anchor, size: labelSize, lineH })
    })

    // Noms des éléments sans lien (halo), comme dans la vue centrée.
    const outerLabels = []
    if (showNames) {
      const size = 11.5
      const font = `500 ${size}px ${FONT}`
      const h = size * 1.3
      lone.forEach(n => {
        const p = pos.get(n.node_id)
        let text = String(n.libelle || '')
        if (measure(text, font) > 135) {
          while (text.length > 4 && measure(`${text}…`, font) > 135) text = text.slice(0, -1)
          text = `${text.trim()}…`
        }
        const w = measure(text, font)
        const c = Math.cos(p.angle)
        const sn = Math.sin(p.angle)
        const r = radius(n)
        let found = null
        for (let attempt = 0; attempt < 12 && !found; attempt += 1) {
          const step = attempt % 6
          const inward = attempt >= 6
          const d = r + 5 + step * 6
          let x0, y0, anchor
          if (Math.abs(c) > 0.32) {
            const toRight = (c > 0) !== inward
            anchor = toRight ? 'start' : 'end'
            x0 = toRight ? p.x + d : p.x - d - w
            y0 = p.y - h / 2 + (step % 2 ? 1 : -1) * Math.ceil(step / 2) * (h * 0.8)
          } else {
            anchor = 'middle'
            x0 = p.x - w / 2 + (step % 2 ? 1 : -1) * Math.ceil(step / 2) * 12
            y0 = (sn < 0) !== inward ? p.y - d - h : p.y + d
          }
          if (x0 < 6 || x0 + w > W - 6 || y0 < top - 6 || y0 + h > bottom) continue
          const box = { x0: x0 - 2, x1: x0 + w + 2, y0: y0 - 1, y1: y0 + h + 1 }
          if (!placed.some(b => overlap(box, b))) found = { box, x0, y0, w, anchor }
        }
        if (!found) { hidden += 1; return }
        placed.push(found.box)
        const tx = found.anchor === 'start' ? found.x0 : found.anchor === 'end' ? found.x0 + found.w : found.x0 + found.w / 2
        outerLabels.push({ id: n.node_id, text, full: n.libelle, tx, ty: found.y0 + size - 1, anchor: found.anchor, size, ring: 3 })
      })
    }

    // Arcs : courbes légères, toutes de même importance.
    const edges = []
    relations.forEach((r, index) => {
      const a = pos.get(r.source_id)
      const b = pos.get(r.cible_id)
      if (!a || !b) return
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
      const k = 0.14 * len
      const qx = mx - ((b.y - a.y) / len) * k
      const qy = my + ((b.x - a.x) / len) * k
      edges.push({ r, a, b, qx, qy, midX: 0.25 * a.x + 0.5 * qx + 0.25 * b.x, midY: 0.25 * a.y + 0.5 * qy + 0.25 * b.y, key: `${r.relation_id || index}` })
    })

    return { W, H, cx, cy, pos, radius, labels, outerLabels, hidden, edges, hubId, deg, top, bottom, rx3, ry3, loneCount: lone.length }
  }, [size, adjacency, focusId, nodes, relations, fontsReady, showNames])

  // ------------------------------------------------------ interactions
  const nodeAt = event => {
    const svg = svgRef.current
    const ctm = groupRef.current?.getScreenCTM?.()
    const M = model || ov
    if (!svg || !ctm || !M) return null
    const pt = svg.createSVGPoint()
    pt.x = event.clientX
    pt.y = event.clientY
    const w = pt.matrixTransform(ctm.inverse())
    const k = Math.hypot(ctm.a, ctm.b) || 1
    let best = null
    let bestD = Infinity
    nodes.forEach(n => {
      const p = M.pos.get(n.node_id)
      if (!p) return
      const d = Math.hypot(p.x - w.x, p.y - w.y) * k
      const reach = M.radius(n) * k + (p.ring === 3 ? 7 : 9)
      if (d <= reach && d < bestD) { best = n; bestD = d }
    })
    return best
  }

  const onPointerDown = e => {
    if (e.button !== 0 || e.target.closest?.('.orbit-pill')) return
    dragRef.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y, moved: 0 }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = e => {
    const d = dragRef.current
    if (d && d.id === e.pointerId) {
      d.moved = Math.max(d.moved, Math.hypot(e.clientX - d.sx, e.clientY - d.sy))
      setPan({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) })
      return
    }
    if (e.target.closest?.('.orbit-pill')) return
    const n = nodeAt(e)
    const id = n ? n.node_id : null
    if (id !== hoverId) setHoverId(id)
  }
  const onPointerUp = e => {
    const d = dragRef.current
    if (!d || d.id !== e.pointerId) return
    movedRef.current = d.moved
    dragRef.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }
  const onClick = e => {
    if (e.target.closest?.('.orbit-pill')) return
    if (movedRef.current > 5) return
    const n = nodeAt(e)
    if (n && n.node_id !== focusId) onFocus?.(n)
  }
  const zoom = f => setScale(s => clamp(s * f, 0.6, 3.2))

  const gradientDefs = (
    <defs>
      {Object.entries(ORBIT_TYPES).map(([k, [, c]]) => (
        <React.Fragment key={k}>
          <radialGradient id={`ob-core-${k.replace(/\W/g, '')}`} cx="42%" cy="40%" r="62%">
            <stop offset="0" stopColor="#fff" />
            <stop offset=".3" stopColor="#fff" stopOpacity=".9" />
            <stop offset=".56" stopColor={c} />
            <stop offset="1" stopColor={c} />
          </radialGradient>
          <radialGradient id={`ob-halo-${k.replace(/\W/g, '')}`}>
            <stop offset="0" stopColor={c} stopOpacity=".5" />
            <stop offset=".36" stopColor={c} stopOpacity=".16" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </radialGradient>
        </React.Fragment>
      ))}
    </defs>
  )
  const zoomControls = (
    <div className="orbit-zoom" aria-label="Zoom">
      <button type="button" onClick={() => zoom(1.18)} aria-label="Zoom avant" title="Zoom avant">+</button>
      <button type="button" onClick={() => zoom(0.85)} aria-label="Zoom arrière" title="Zoom arrière">−</button>
      <button type="button" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }) }} aria-label="Recentrer" title="Recentrer">⌾</button>
      <button
        type="button"
        className={`orbit-names-toggle ${showNames ? 'is-on' : ''}`}
        onClick={toggleNames}
        aria-pressed={showNames}
        title={showNames ? 'Ne nommer que les éléments principaux' : 'Afficher les noms de tous les éléments'}
      >
        Noms
      </button>
    </div>
  )

  if (ov) {
    const { W, H, cx, cy, pos, radius, labels, outerLabels, hidden, edges, hubId, deg } = ov
    const t = `translate(${cx + pan.x} ${cy + pan.y}) scale(${scale}) translate(${-cx} ${-cy})`
    const hoverNode = hoverId ? byId.get(hoverId) : null
    const hoverPos = hoverNode ? pos.get(hoverId) : null
    const near = new Set(hoverId ? [hoverId, ...(adjacency.get(hoverId) || []).map(x => x.other)] : [])
    const hoverEdges = hoverId ? edges.filter(e => e.r.source_id === hoverId || e.r.cible_id === hoverId) : []
    const pillFont = `600 11.5px ${FONT}`
    return (
      <div className="orbit-wrap" ref={wrapRef}>
        <svg
          ref={svgRef}
          className={`orbit-svg orbit-overview${hoverId ? ' has-hover' : ''}`}
          width={W}
          height={H - STRIP_H}
          viewBox={`0 0 ${W} ${H - STRIP_H}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => !dragRef.current && setHoverId(null)}
          onClick={onClick}
          onWheel={e => zoom(e.deltaY < 0 ? 1.08 : 0.92)}
          style={hoverId ? { cursor: 'pointer' } : undefined}
          role="img"
          aria-label={`Vue d’ensemble du graphe : ${nodes.length} éléments et ${relations.length} liens`}
        >
          {gradientDefs}
          <g ref={groupRef} transform={t}>
            {ov.loneCount > 0 && <ellipse className="orbit-ring outer" cx={cx} cy={cy} rx={ov.rx3} ry={ov.ry3} />}

            <g key="ov-edges" className="orbit-edges">
              {edges.map(e => {
                const on = near.size && (e.r.source_id === hoverId || e.r.cible_id === hoverId)
                const src = byId.get(e.r.source_id)
                return (
                  <path
                    key={e.key}
                    className={`orbit-edge ov${on ? ' is-on' : ''}${near.size && !on ? ' is-dim' : ''}`}
                    d={`M${e.a.x},${e.a.y} Q${e.qx},${e.qy} ${e.b.x},${e.b.y}`}
                    stroke={typeColor(normalizeType(src?.type_noeud))}
                  />
                )
              })}
            </g>

            <g className="orbit-nodes">
              {nodes.map(n => {
                const p = pos.get(n.node_id)
                if (!p) return null
                const type = normalizeType(n.type_noeud)
                const gid = (ORBIT_TYPES[type] ? type : 'notion_idee').replace(/\W/g, '')
                const r = radius(n)
                const dim = near.size && !near.has(n.node_id)
                const op = dim ? 0.22 : p.ring === 3 ? (n.node_id === hoverId ? 1 : 0.55) : 1
                return (
                  <g
                    key={n.node_id}
                    className={`orbit-node ring-${p.ring}${n.node_id === hubId ? ' is-hub' : ''}`}
                    data-node-id={n.node_id}
                    style={{ transform: `translate(${p.x}px, ${p.y}px)`, opacity: op }}
                  >
                    {p.ring === 1 && <circle r={r * 2.6} fill={`url(#ob-halo-${gid})`} />}
                    {highlight.has(n.node_id) && <circle className="orbit-highlight" r={r + 9} />}
                    <circle className="orbit-core" r={r} fill={`url(#ob-core-${gid})`} stroke={typeColor(type)} />
                    <circle
                      r={Math.max(r, 6)}
                      fill="transparent"
                      pointerEvents="none"
                      tabIndex="0"
                      role="button"
                      aria-label={`${n.libelle} (${deg.get(n.node_id) || 0} lien${(deg.get(n.node_id) || 0) > 1 ? 's' : ''})`}
                      onFocus={() => setHoverId(n.node_id)}
                      onBlur={() => setHoverId(null)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFocus?.(n) } }}
                    />
                  </g>
                )
              })}
            </g>

            <g key="ov-labels" className={`orbit-labels${near.size ? ' is-dim' : ''}`}>
              {outerLabels.map(L => (
                <text key={`outer-${L.id}`} className={`orbit-label orbit-label-outer ring-3${near.size && !near.has(L.id) ? ' is-dim' : ''}`} x={L.tx} y={L.ty} textAnchor={L.anchor} style={{ fontSize: `${L.size}px` }}>
                  <title>{L.full}</title>
                  {L.text}
                </text>
              ))}
              {[...labels.entries()].map(([id, L]) => (
                <text key={id} className={`orbit-label${near.size && !near.has(id) ? ' is-dim' : ''}`} x={L.tx} y={L.ty} textAnchor={L.anchor} style={{ fontSize: `${L.size}px` }}>
                  {L.lines.map((line, i) => <tspan key={i} x={L.tx} dy={i ? L.lineH : 0}>{line}</tspan>)}
                </text>
              ))}
            </g>

            {hoverEdges.map(e => {
              const text = verbLabel(e.r.type_relation)
              const w = measure(text, pillFont) + 14
              return (
                <g key={`verb-${e.key}`} className="orbit-pill orbit-pill-static" pointerEvents="none">
                  <rect x={e.midX - w / 2} y={e.midY - 10} width={w} height="20" rx="10" stroke={typeColor(normalizeType(byId.get(e.r.source_id)?.type_noeud))} />
                  <text x={e.midX} y={e.midY + 4} textAnchor="middle">{text}</text>
                </g>
              )
            })}

            {hoverNode && hoverPos && (() => {
              const L = labels.get(hoverId)
              if (L && L.lines.join(' ') === hoverNode.libelle) return null
              const lines = wrap(hoverNode.libelle, 220, `600 13px ${FONT}`)
              const w = Math.max(...lines.map(l => measure(l, `600 13px ${FONT}`))) + 18
              const h = lines.length * 17 + 12
              const r = radius(hoverNode)
              const x = clamp(hoverPos.x - w / 2, 6, W - w - 6)
              const y = hoverPos.y - r - h - 10 < 4 ? hoverPos.y + r + 10 : hoverPos.y - r - h - 10
              return (
                <g className="orbit-tip" pointerEvents="none">
                  <rect x={x} y={y} width={w} height={h} rx="9" stroke={typeColor(normalizeType(hoverNode.type_noeud))} />
                  <text x={x + 9} y={y + 19}>
                    {lines.map((l, i) => <tspan key={i} x={x + 9} dy={i ? 17 : 0}>{l}</tspan>)}
                  </text>
                </g>
              )
            })()}
          </g>
        </svg>

        {zoomControls}

        <p className="orbit-names-hint orbit-ov-hint" aria-live="polite">
          Cliquez sur un élément pour l’explorer.
          {ov.loneCount > 0 ? ' En périphérie : les éléments sans lien.' : ''}
          {hidden > 0 ? ` ${hidden} nom${hidden > 1 ? 's' : ''} masqué${hidden > 1 ? 's' : ''} : zoomez ou survolez les points.` : ''}
        </p>
      </div>
    )
  }

  if (!model) {
    return <div className="orbit-wrap" ref={wrapRef}><p className="orbit-empty">Aucune entité à afficher avec les filtres actuels.</p></div>
  }

  const { W, H, cx, cy, pos, ring1, ring1Map, radius, labels, pills, outerLabels, outerHidden, edges, focus, focusLines, focusBox, dense } = model
  const t = `translate(${cx + pan.x} ${cy + pan.y}) scale(${scale}) translate(${-cx} ${-cy})`
  const hoverNode = hoverId ? byId.get(hoverId) : null
  const hoverPos = hoverNode ? pos.get(hoverId) : null
  const hoverRels = hoverNode ? ring1Map.get(hoverId) : null
  const hoverVerb = hoverRels && hoverRels.length && !pills.some(pl => pl.id === hoverId)
    ? verbLabel(hoverRels[0].type_relation) + (hoverRels.length > 1 ? ` (+${hoverRels.length - 1})` : '')
    : null
  const showHoverLabel = hoverNode && hoverId !== focusId && (!labels.has(hoverId) || hoverVerb)

  return (
    <div className="orbit-wrap" ref={wrapRef}>
      <svg
        ref={svgRef}
        className="orbit-svg"
        width={W}
        height={H - STRIP_H}
        viewBox={`0 0 ${W} ${H - STRIP_H}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => !dragRef.current && setHoverId(null)}
        onClick={onClick}
        onWheel={e => zoom(e.deltaY < 0 ? 1.08 : 0.92)}
        style={hoverId && hoverId !== focusId ? { cursor: 'pointer' } : undefined}
        role="img"
        aria-label={`Graphe de la publication centré sur : ${focus.libelle}`}
      >
        {gradientDefs}

        <g ref={groupRef} transform={t}>
          <ellipse className="orbit-ring" cx={cx} cy={cy} rx={model.rx1} ry={model.ry1} />
          <ellipse className="orbit-ring outer" cx={cx} cy={cy} rx={model.rx2} ry={model.ry2} />
          <circle cx={cx} cy={cy} r={model.rx1 * 0.5} fill={`url(#ob-halo-${normalizeType(focus.type_noeud).replace(/\W/g, '')})`} opacity=".35" />

          <g key={`edges-${focusId}`} className="orbit-edges">
            {edges.map(({ r, a, b, level, key }) => {
              const other = byId.get(r.source_id === focusId ? r.cible_id : r.source_id)
              const color = level === 1 ? typeColor(normalizeType(other?.type_noeud)) : '#8fbccc'
              return (
                <line
                  key={key}
                  className={`orbit-edge l${level}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={color}
                />
              )
            })}
          </g>

          <g className="orbit-nodes">
            {nodes.map(n => {
              const p = pos.get(n.node_id)
              if (!p) return null
              const type = normalizeType(n.type_noeud)
              const gid = (ORBIT_TYPES[type] ? type : 'notion_idee').replace(/\W/g, '')
              const r = radius(n)
              const isFocus = n.node_id === focusId
              const isHover = n.node_id === hoverId
              const op = p.ring === 3 ? 0.5 : p.ring === 2 ? 0.62 : 1
              return (
                <g
                  key={n.node_id}
                  className={`orbit-node ring-${p.ring}`}
                  data-node-id={n.node_id}
                  style={{ transform: `translate(${p.x}px, ${p.y}px)`, opacity: isHover ? 1 : op }}
                >
                  {p.ring <= 2 && <circle r={r * (isFocus ? 3.2 : 2.8)} fill={`url(#ob-halo-${gid})`} />}
                  {highlight.has(n.node_id) && <circle className="orbit-highlight" r={r + 9} />}
                  <circle className="orbit-core" r={r} fill={`url(#ob-core-${gid})`} stroke={typeColor(type)} />
                  {isFocus && <circle className="orbit-focus-ring" r={r + 9} />}
                  <circle
                    r={Math.max(r, 6)}
                    fill="transparent"
                    pointerEvents="none"
                    tabIndex="0"
                    role="button"
                    aria-label={n.libelle}
                    onFocus={() => setHoverId(n.node_id)}
                    onBlur={() => setHoverId(null)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFocus?.(n) } }}
                  />
                </g>
              )
            })}
          </g>

          <g key={`labels-${focusId}`} className="orbit-labels">
            {outerLabels.map(L => (
              <text key={`outer-${L.id}`} className={`orbit-label orbit-label-outer ring-${L.ring}`} x={L.tx} y={L.ty} textAnchor={L.anchor} style={{ fontSize: `${L.size}px` }}>
                <title>{L.full}</title>
                {L.text}
              </text>
            ))}
            {ring1.map(n => {
              const L = labels.get(n.node_id)
              if (!L) return null
              return (
                <text key={n.node_id} className="orbit-label" x={L.tx} y={L.ty} textAnchor={L.anchor} style={{ fontSize: `${L.size}px` }}>
                  {L.lines.map((line, i) => <tspan key={i} x={L.tx} dy={i ? L.lineH : 0}>{line}</tspan>)}
                </text>
              )
            })}

            {pills.map(pl => (
              <g
                key={pl.id}
                className="orbit-pill"
                role="button"
                tabIndex="0"
                aria-label={`Voir la preuve de la relation : ${pl.text}`}
                onClick={() => onOpenRelation?.(pl.rel)}
                onKeyDown={e => { if (e.key === 'Enter') onOpenRelation?.(pl.rel) }}
              >
                <rect x={pl.x - pl.w / 2} y={pl.y - 11} width={pl.w} height="22" rx="11" stroke={typeColor(normalizeType(byId.get(pl.id)?.type_noeud))} />
                <text x={pl.x} y={pl.y + 4.2} textAnchor="middle">{pl.text}</text>
              </g>
            ))}

            <g className="orbit-focus-label">
              <rect x={focusBox.x0} y={focusBox.y0} width={focusBox.x1 - focusBox.x0} height={focusBox.y1 - focusBox.y0} rx="12" stroke={typeColor(normalizeType(focus.type_noeud))} />
              <text x={cx} y={focusBox.y0 + 26} textAnchor="middle">
                {focusLines.map((l, i) => <tspan key={i} x={cx} dy={i ? 23 : 0}>{l}</tspan>)}
              </text>
            </g>
          </g>

          {showHoverLabel && hoverPos && (() => {
            const lines = wrap(hoverNode.libelle, 220, `600 13px ${FONT}`)
            const verbLine = hoverVerb ? `${focus.libelle.length > 26 ? 'sujet' : focus.libelle} · ${hoverVerb}` : null
            const w = Math.max(...lines.map(l => measure(l, `600 13px ${FONT}`)), verbLine ? measure(verbLine, `600 12px ${FONT}`) : 0) + 18
            const h = lines.length * 17 + 12 + (verbLine ? 18 : 0)
            const x = clamp(hoverPos.x - w / 2, 6, W - w - 6)
            const y = hoverPos.y - radius(hoverNode) - h - 10 < 4 ? hoverPos.y + radius(hoverNode) + 10 : hoverPos.y - radius(hoverNode) - h - 10
            return (
              <g className="orbit-tip" pointerEvents="none">
                <rect x={x} y={y} width={w} height={h} rx="9" stroke={typeColor(normalizeType(hoverNode.type_noeud))} />
                {verbLine && <text x={x + 9} y={y + 17} className="orbit-tip-verb">{verbLine}</text>}
                <text x={x + 9} y={y + 19 + (verbLine ? 18 : 0)}>
                  {lines.map((l, i) => <tspan key={i} x={x + 9} dy={i ? 17 : 0}>{l}</tspan>)}
                </text>
              </g>
            )
          })()}
        </g>
      </svg>

      {zoomControls}

      {showNames && outerHidden > 0 && (
        <p className="orbit-names-hint" aria-live="polite">
          {outerHidden} nom{outerHidden > 1 ? 's' : ''} masqué{outerHidden > 1 ? 's' : ''} pour rester lisible : zoomez ou survolez les points.
        </p>
      )}

    </div>
  )
}

