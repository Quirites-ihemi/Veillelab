import React, { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import DocumentLinksWorkspace from './DocumentLinksWorkspace.jsx'
import { useChronologyData } from '../hooks/useChronologyData.js'
import './cross-documents.css'
import '../crossdoc-espace.css'
import '../crossdoc-accueil.css'
import recommendationsCatalog from '../recommendationsCatalog.json'

const ELIGIBLE_PUBLICATIONS = ['PUB006', 'PUB012', 'PUB113']


const TRANSVERSAL_NOTIONS = [
  {
    id: 'criminalites',
    label: 'Criminalités',
    icon: 'graph',
    accent: '#2f7ee6',
    selections: {
      PUB006: ['N0092','N0095','N0103','N0104'],
      PUB007: ['N0182'],
      PUB015: ['N0433','N0436','N0441','N0443','N0457'],
      PUB024: ['N0598','N0599','N0600','N0605','N0612','N0610','N0630','N0632'],
      PUB025: ['N0666','N0671','N0676','N0677','N0678'],
      PUB057: ['N0925','N0931','N0936','N0940','N0941','N0944','N0953'],
    },
  },
  {
    id: 'ia',
    label: 'Intelligence artificielle',
    icon: 'spark',
    accent: '#176fd0',
    selections: {
      PUB005: ['N0122','N0123','N0124','N0132','N0133','N0136'],
      PUB006: ['N0096'],
      PUB033: ['N1115','N1116','N1120','N1128'],
    },
  },
  {
    id: 'violences-sexuelles',
    label: 'Violences sexuelles',
    icon: 'target',
    accent: '#2d83cc',
    selections: {
      PUB008: ['N0220','N0222','N0224','N0247','N0248'],
      PUB031: ['N1088','N1089','N1091','N1093'],
      PUB090: ['N1156','N1157'],
    },
  },
  {
    id: 'stupefiants',
    label: 'Stupéfiants',
    icon: 'layers',
    accent: '#208c67',
    selections: {
      PUB008: ['N0227','N0228','N0229','N0239','N0250','N0257'],
      PUB014: ['N0396','N0401'],
      PUB025: ['N0666','N0671','N0676','N0677','N0678'],
    },
  },
  {
    id: 'chien',
    label: 'Chien',
    icon: 'target',
    accent: '#4f86c6',
    selections: {
      PUB012: ['N0661','N0639','N0642','N0652'],
      PUB113: ['N1284'],
    },
  },
  {
    id: 'gestion-crise',
    label: 'Gestion de crise',
    icon: 'compass',
    accent: '#5577b7',
    selections: {
      PUB010: ['N0269'],
      PUB054: ['N0915'],
      PUB113: ['N1267'],
      PUB005: ['N0129'],
      PUB118: ['N1443'],
    },
  },
]

const TYPE_LABELS = {
  notion_idee: 'Notion / idée',
  probleme: 'Problème',
  action: 'Action',
  acteur: 'Acteur',
  expert_public: 'Expert public',
  localisation: 'Localisation',
  signal_faible: 'Signal faible',
  recommandation: 'Recommandation',
  tendance: 'Tendance',
  instrument_dispositif: 'Instrument / dispositif',
}

const NAT_LABELS = {
  evenement: 'Événement',
  jalon: 'Jalon',
  emergence: 'Émergence',
  tendance: 'Tendance',
  rupture_inflexion: 'Rupture / inflexion',
  sequence_historique: 'Séquence historique',
}

const NOTION_BRANCH_LAYOUTS = {
  1: [[50, 50]],
  2: [[20, 50], [80, 50]],
  3: [[20, 24], [80, 24], [50, 82]],
  4: [[20, 24], [80, 24], [20, 78], [80, 78]],
  5: [[18, 20], [82, 20], [16, 77], [50, 84], [84, 77]],
  6: [[16, 18], [50, 15], [84, 18], [16, 80], [50, 85], [84, 80]],
}

function notionBranchPosition(index, count) {
  const layout = NOTION_BRANCH_LAYOUTS[Math.min(6, Math.max(1, count))] || NOTION_BRANCH_LAYOUTS[6]
  const point = layout[index % layout.length] || [50, 50]
  return { x: point[0], y: point[1] }
}

function buildCircularJourneyPositions(count) {
  if (!count) return []
  const radiusX = 26
  const radiusY = 39
  const startAngle = -150
  const step = 360 / count
  return Array.from({ length: count }, (_, index) => {
    const angle = startAngle + (step * index)
    const radians = angle * (Math.PI / 180)
    return {
      angle,
      x: 50 + (Math.cos(radians) * radiusX),
      y: 50 + (Math.sin(radians) * radiusY),
    }
  })
}

function buildContributionOrbit(count) {
  const presets = [
    { x: -150, y: -90 },
    { x: 0, y: -145 },
    { x: 150, y: -90 },
    { x: 170, y: 40 },
    { x: 0, y: 150 },
    { x: -170, y: 40 },
    { x: -120, y: 120 },
    { x: 120, y: 120 },
  ]
  return Array.from({ length: count }, (_, index) => presets[index % presets.length])
}

function publicationImageSrc(imagePath = '', publicationId = '') {
  const base = import.meta.env.BASE_URL || '/'
  const raw = String(imagePath || '').trim()
  if (/^https?:\/\//i.test(raw)) return raw
  const normalized = raw
    ? raw.replace(/^\/+/, '')
    : `images/publications/${publicationId}.png`
  return `${base}${normalized}`
}

function formatPublicationDate(publication = {}) {
  const candidates = [
    publication.date_publication,
    publication.date,
    publication.date_source,
    publication.date_document,
    publication.date_debut,
    publication['année_publication'],
    publication.annee,
  ].filter(Boolean)
  if (!candidates.length) return ''
  return String(candidates[0])
}

function journeyZone(point = { x: 50, y: 50 }) {
  if (point.y <= 32) return 'top'
  if (point.y >= 68) return 'bottom'
  if (point.x <= 32) return 'left'
  if (point.x >= 68) return 'right'
  return 'center'
}

function buildLocalContributionOffsets(count, zone = 'top') {
  const layouts = {
    top: [
      [-174, 12], [174, 12], [-184, 158], [0, 216], [184, 158], [0, 340],
    ],
    bottom: [
      [-174, -12], [174, -12], [-184, -158], [0, -216], [184, -158], [0, -340],
    ],
    left: [
      [24, -170], [24, 170], [172, -182], [232, 0], [172, 182], [338, 0],
    ],
    right: [
      [-24, -170], [-24, 170], [-172, -182], [-232, 0], [-172, 182], [-338, 0],
    ],
    center: [
      [-188, -84], [0, -200], [188, -84], [-188, 116], [0, 208], [188, 116],
    ],
  }
  const selected = layouts[zone] || layouts.center
  return Array.from({ length: count }, (_, index) => ({
    x: selected[index % selected.length][0],
    y: selected[index % selected.length][1],
  }))
}

function buildRibbonPositions(count) {
  if (!count) return []
  if (count === 1) return [{ x: 50, y: 17 }]
  const left = 10
  const right = 90
  const step = (right - left) / (count - 1)
  return Array.from({ length: count }, (_, index) => {
    const x = left + (step * index)
    const wave = Math.sin((index / Math.max(1, count - 1)) * Math.PI * 1.8 - Math.PI / 2)
    return { x, y: 17 + (wave * 3.1) }
  })
}

function buildTreeOffsets(count) {
  const presets = [
    { x: -118, y: 34 },
    { x: 118, y: 34 },
    { x: -168, y: 156 },
    { x: 0, y: 194 },
    { x: 168, y: 156 },
    { x: -88, y: 286 },
    { x: 88, y: 286 },
    { x: -226, y: 266 },
    { x: 226, y: 266 },
  ]
  return Array.from({ length: count }, (_, index) => presets[index % presets.length])
}

function cleanUrl(value = '') {
  const first = String(value || '').split(/\s+/).find(x => /^https?:\/\//i.test(x))
  return first || ''
}

function temporalValueFromNormalized(rawValue = '') {
  const raw = String(rawValue || '')
  const match = raw.match(/(15|16|17|18|19|20|21)\d{2}/)
  if (!match) return null
  const year = Number(match[0])
  const month = Number((raw.match(/^\d{4}-(\d{2})/) || [])[1] || 1)
  const day = Number((raw.match(/^\d{4}-\d{2}-(\d{2})/) || [])[1] || 1)
  return year + ((month - 1) / 12) + ((day - 1) / 365)
}

function temporalValue(element) {
  return temporalValueFromNormalized(element.date_debut_normalisee)
}

const TIMELINE_CARD_WIDTH = 165
const TIMELINE_CARD_GAP = 18
const TIMELINE_LANE_HEIGHT = 76
const TIMELINE_CARD_TOP = 82
const TIMELINE_HORIZONTAL_PADDING = 58
const TIMELINE_TARGET_MAX_LANES = 5
const TIMELINE_MAX_WIDTH = 9500

function rangeYears(elements) {
  const values = []
  elements.forEach(element => {
    const start = temporalValue(element)
    const end = temporalValueFromNormalized(element.date_fin_normalisee)
    if (start !== null) values.push(start)
    if (end !== null) values.push(end)
  })
  if (!values.length) return { min: 0, max: 1 }
  let min = Math.floor(Math.min(...values))
  let max = Math.ceil(Math.max(...values))
  if (min === max) { min -= 1; max += 1 }
  return { min, max }
}

function timelineX(value, range, width) {
  const span = Math.max(1, range.max - range.min)
  const usableWidth = Math.max(1, width - TIMELINE_HORIZONTAL_PADDING * 2)
  const ratio = Math.max(0, Math.min(1, (value - range.min) / span))
  return TIMELINE_HORIZONTAL_PADDING + ratio * usableWidth
}

function packTimeline(elements, range, width) {
  const laneEnds = []
  const placements = {}

  elements.forEach(element => {
    const value = temporalValue(element)
    if (value === null) return

    const x = timelineX(value, range, width)
    const cardStart = x - 6
    const cardEnd = cardStart + TIMELINE_CARD_WIDTH
    let lane = laneEnds.findIndex(lastEnd => cardStart >= lastEnd + TIMELINE_CARD_GAP)

    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(cardEnd)
    } else {
      laneEnds[lane] = cardEnd
    }

    placements[element.chrono_id] = { x, lane }
  })

  return { placements, laneCount: Math.max(1, laneEnds.length) }
}

function buildTimelineLayout(elements, range) {
  const rangeSpan = Math.max(1, range.max - range.min)
  const densityWidth = elements.length * 72
  const temporalWidth = rangeSpan * 22 + 250
  let width = Math.max(1400, Math.min(TIMELINE_MAX_WIDTH, Math.max(densityWidth, temporalWidth)))
  let packed = packTimeline(elements, range, width)
  let guard = 0

  while (packed.laneCount > TIMELINE_TARGET_MAX_LANES && width < TIMELINE_MAX_WIDTH && guard < 6) {
    width = Math.min(TIMELINE_MAX_WIDTH, Math.round(width * 1.25))
    packed = packTimeline(elements, range, width)
    guard += 1
  }

  return {
    width,
    height: Math.max(370, TIMELINE_CARD_TOP + packed.laneCount * TIMELINE_LANE_HEIGHT + 28),
    ...packed,
  }
}

function sourcePassageKey(prov) {
  return `${prov.publication_id || ''}:${prov.chunk_id || ''}`
}

function SourceExcerpt({ text, expression, active, transferred, onClick }) {
  const source = String(text || '')
  const needle = String(expression || '').trim()
  if (!needle) return <p>{source}</p>

  const at = source.toLocaleLowerCase('fr').indexOf(needle.toLocaleLowerCase('fr'))
  if (at < 0) return <p>{source}</p>

  return <p>
    {source.slice(0, at)}
    <button
      type="button"
      className={`chrono-source-mark ${active ? 'active' : ''} ${transferred ? 'transferred' : ''}`}
      onClick={onClick}
      title="Repère temporel"
    >
      {source.slice(at, at + needle.length)}
    </button>
    {source.slice(at + needle.length)}
  </p>
}

/* ==========================================================================
   ACCUEIL DE L'ONGLET — le triptyque
   Trois fonctionnalités présentées à égalité, chacune avec un aperçu
   construit sur les données réelles du corpus. Les fonctionnalités
   elles-mêmes ne sont pas modifiées : chaque bouton ouvre l'écran existant.
   ========================================================================== */
const XDA_TREE_SOURCE = 'PUB008'
const XDA_NOTION_ID = 'violences-sexuelles'

function XdaFrise({ chronology }) {
  const years = useMemo(() => {
    const els = (chronology?.elements || []).filter(e => e.decision_post_traitement === 'retenu' && temporalValue(e) !== null)
    const byPub = {}
    for (const e of els) (byPub[e.publication_id] ||= []).push(e)
    const best = Object.entries(byPub).sort((a, b) => b[1].length - a[1].length)[0]
    if (!best) return []
    const counts = {}
    for (const e of best[1]) { const y = Math.floor(temporalValue(e)); counts[y] = (counts[y] || 0) + 1 }
    return Object.entries(counts).map(([y, c]) => [Number(y), c]).sort((a, b) => b[1] - a[1]).slice(0, 9).sort((a, b) => a[0] - b[0])
  }, [chronology])
  if (!years.length) return null
  const H = 250, x0 = 200, step = (H - 50) / Math.max(1, years.length - 1)
  return <>
    <path className="xda-grow" style={{ '--len': 400 }} d={`M${x0},18 L${x0},${H - 18}`} stroke="#c8d3e0" strokeWidth="3" strokeLinecap="round" fill="none"/>
    {years.map(([y, c], i) => {
      const yy = 25 + i * step, left = i % 2 === 0, r = 4 + Math.sqrt(c) * 1.6
      return <g key={y} className="xda-pop" style={{ '--d': `${0.2 + i * 0.09}s` }}>
        <circle cx={x0} cy={yy} r={r} fill="#e3a73b" opacity=".9"/>
        <text x={left ? x0 - 14 - r : x0 + 14 + r} y={yy + 4} className="xda-svg-year" textAnchor={left ? 'end' : 'start'}>{y}</text>
        <text x={left ? x0 - 52 - r : x0 + 52 + r} y={yy + 4} className="xda-svg-note" textAnchor={left ? 'end' : 'start'}>{c} élément{c > 1 ? 's' : ''}</text>
      </g>
    })}
  </>
}

function XdaNotion({ publications }) {
  const notion = TRANSVERSAL_NOTIONS.find(n => n.id === XDA_NOTION_ID) || TRANSVERSAL_NOTIONS[0]
  const hot = Object.keys(notion.selections)
  const cx = 200, cy = 125, R = 95
  const pos = {}
  publications.forEach((p, i) => { const a = i / publications.length * Math.PI * 2 - Math.PI / 2; pos[p.publication_id] = [cx + R * Math.cos(a), cy + R * Math.sin(a)] })
  const pts = hot.map(id => pos[id]).filter(Boolean)
  let d = pts.length ? `M${pts[0][0]},${pts[0][1]}` : ''
  for (let i = 1; i < pts.length; i++) { const [a, b] = pts[i - 1], [c, e] = pts[i]; d += ` Q${cx + (a + c - 2 * cx) * 0.1},${cy + (b + e - 2 * cy) * 0.1} ${c},${e}` }
  const byId = Object.fromEntries(publications.map(p => [p.publication_id, p]))
  return <>
    <circle cx={cx} cy={cy} r={R} fill="none" stroke="#dbe3ec" strokeWidth="1.5"/>
    {publications.filter(p => !hot.includes(p.publication_id)).map(p => { const [x, y] = pos[p.publication_id]; return <rect key={p.publication_id} x={x - 4} y={y - 5.5} width="8" height="11" rx="1.5" fill="#c9d4e2"/> })}
    {d && <path className="xda-grow" style={{ '--len': 900, '--d': '.3s' }} d={d} stroke="#0b8f8a" strokeWidth="3" fill="none" strokeLinecap="round"/>}
    {hot.filter(id => pos[id]).map((id, i) => { const [x, y] = pos[id]; const p = byId[id]; return <g key={id} className="xda-pop" style={{ '--d': `${0.2 + i * 0.35}s` }}>
      <rect x={x - 14} y={y - 19} width="28" height="38" rx="3" fill="#fff" stroke="#0b8f8a" strokeWidth="2"/>
      {p?.has_image !== false && <image href={publicationImageSrc(p?.image_path, id)} x={x - 12} y={y - 17} width="24" height="34" preserveAspectRatio="xMidYMid slice"/>}
    </g> })}
    <text x={cx} y={cy - R - 13} textAnchor="middle" className="xda-svg-notion">{notion.label}</text>
  </>
}

function XdaTree({ publications }) {
  const [leaves, setLeaves] = useState(null)
  useEffect(() => {
    let alive = true
    const base = import.meta.env.BASE_URL || '/'
    const read = suffix => fetch(`${base}recommendations/${XDA_TREE_SOURCE}_${suffix}.json`).then(r => r.ok ? r.json() : null).catch(() => null)
    Promise.all([read('document_links'), read('thematic_extensions')]).then(([blue, green]) => {
      if (!alive) return
      const pick = (payload, kind) => (payload?.leaves || []).map(l => ({ kind, decision: l.decision, target: l.target_publication_id }))
      setLeaves([...pick(blue, 'raccord'), ...pick(green, 'prolongement')])
    })
    return () => { alive = false }
  }, [])
  const byId = useMemo(() => Object.fromEntries(publications.map(p => [p.publication_id, p])), [publications])
  const W = 400, H = 250, cx = W / 2, base = H - 30, fork = H * 0.6, rx = W * 0.38, ry = fork - 30, cyc = fork + 6
  const cover = (id, x, y, w, h) => byId[id]?.has_image === false ? null : <image href={publicationImageSrc(byId[id]?.image_path, id)} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice"/>
  const side = (arr, dir, grad, color, a0, a1) => {
    const lx = cx + dir * W * 0.14, ly = fork - H * 0.16
    return <g key={grad}>
      <path className="xda-grow" style={{ '--len': 600, '--d': '.35s' }} d={`M${cx},${fork} C${cx + dir * W * 0.08},${fork - 6} ${lx},${ly + 24} ${lx},${ly}`} stroke={`url(#${grad})`} strokeWidth="7" fill="none" strokeLinecap="round"/>
      {arr.map((l, i) => {
        const a = (arr.length === 1 ? (a0 + a1) / 2 : a0 + (a1 - a0) * i / (arr.length - 1)) * Math.PI / 180
        const tx = cx + rx * Math.cos(a), ty = cyc - ry * Math.sin(a), w = 26, h = 35
        return <g key={`${l.target}-${i}`}>
          <path className="xda-grow" style={{ '--len': 600, '--d': `${0.7 + i * 0.08}s` }} d={`M${lx},${ly} C${lx + dir * 10},${ly - 20} ${tx - dir * 24},${ty + 10} ${tx},${ty}`} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <g className="xda-pop" style={{ '--d': `${1.05 + i * 0.08}s` }}>
            <rect x={tx - w / 2 - 2} y={ty - h / 2 - 2} width={w + 4} height={h + 4} rx="3" fill="#fff" stroke={color} strokeWidth="2" strokeDasharray={l.decision === 'RETENIR' ? undefined : '3 2'}/>
            {cover(l.target, tx - w / 2, ty - h / 2, w, h)}
          </g>
        </g>
      })}
    </g>
  }
  const raccords = (leaves || []).filter(l => l.kind === 'raccord'), prolongements = (leaves || []).filter(l => l.kind === 'prolongement')
  return <>
    <defs>
      <linearGradient id="xda-gl" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#7a6650"/><stop offset=".6" stopColor="#2552c4"/></linearGradient>
      <linearGradient id="xda-gr" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#7a6650"/><stop offset=".6" stopColor="#0b8f8a"/></linearGradient>
    </defs>
    <path className="xda-grow" style={{ '--len': 600 }} d={`M${cx},${base - 24} L${cx},${fork}`} stroke="#7a6650" strokeWidth="14" fill="none" strokeLinecap="round"/>
    {leaves && side(raccords, -1, 'xda-gl', '#2552c4', 172, 118)}
    {leaves && side(prolongements, 1, 'xda-gr', '#0b8f8a', 72, 8)}
    <g className="xda-pop">
      <rect x={cx - 17} y={base - 24} width="34" height="46" rx="3" fill="#fff" stroke="#7a6650" strokeWidth="2"/>
      {cover(XDA_TREE_SOURCE, cx - 15, base - 22, 30, 42)}
    </g>
  </>
}

function CrossDocumentsHome({ data, onOpenChronology, onOpenNotions, onOpenRecommendations }) {
  const { chronology } = useChronologyData(true)
  const [replay, setReplay] = useState({})
  const publications = useMemo(() => (data?.publications || []).filter(p => p.has_graph).sort((a, b) => a.publication_id.localeCompare(b.publication_id)), [data])
  const chronoStats = useMemo(() => {
    const els = (chronology?.elements || []).filter(e => e.decision_post_traitement === 'retenu' && temporalValue(e) !== null)
    return { publications: new Set(els.map(e => e.publication_id)).size, elements: els.length }
  }, [chronology])

  const features = [
    { key: 'chrono', color: '#e3a73b', tag: 'Chronologie · bêta', title: 'Du texte à la frise',
      lead: 'Faites apparaître la trame temporelle d’une publication : jalons, événements, tendances et inflexions replacés dans le temps et reliés à leur preuve.',
      you: 'Une publication datée', get: 'Sa frise, chaque élément relié à sa preuve',
      meta: chronology ? `${chronoStats.publications} publications · ${chronoStats.elements} éléments positionnés dans le temps` : 'Chargement de la chronologie…',
      open: onOpenChronology, visual: <XdaFrise chronology={chronology}/> },
    { key: 'notion', color: '#0b8f8a', tag: 'Vue transversale', title: 'Suivre une notion',
      lead: 'Choisissez une notion et regardez-la passer d’une publication à l’autre. Aucun rapprochement nouveau : chaque élément reste relié à sa page et à sa preuve.',
      you: 'Une notion', get: 'Son parcours à travers le corpus',
      meta: `${TRANSVERSAL_NOTIONS.length} notions · éléments déjà validés`,
      open: onOpenNotions, visual: <XdaNotion publications={publications}/> },
    { key: 'reco', color: '#2552c4', tag: 'Recommandations', title: 'L’arbre des lectures',
      lead: 'Partez d’une publication : ses fils de lecture se séparent en raccords documentaires et en prolongements thématiques, chacun justifié par les passages des deux documents.',
      you: 'Une publication', get: 'Son arbre de recommandations, relié aux passages sources',
      meta: `${recommendationsCatalog.length} publications · raccords et prolongements précalculés`,
      open: onOpenRecommendations, visual: <XdaTree publications={publications}/> },
  ]

  return <main className="xda-screen">
    <div className="xda-wrap">
      <header className="xda-head">
        <div>
          <div className="xda-kicker">Explorations transpublications</div>
          <h1>D’un document à l’autre</h1>
          <p>Trois façons de traverser le corpus sans jamais perdre le passage source.</p>
        </div>
        <div className="xda-corpus"><b>{publications.length} publications</b>du bulletin de veille</div>
      </header>
      <section className="xda-cols" aria-label="Fonctionnalités">
        {features.map(f => <button key={f.key} type="button" className="xda-card" style={{ '--c': f.color }} onClick={f.open}
          onMouseEnter={() => setReplay(r => ({ ...r, [f.key]: (r[f.key] || 0) + 1 }))}>
          <span className="xda-vis" aria-hidden="true"><svg key={replay[f.key] || 0} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid meet">{f.visual}</svg></span>
          <span className="xda-body">
            <span className="xda-tag"><i/>{f.tag}</span>
            <span className="xda-title">{f.title}</span>
            <span className="xda-lead">{f.lead}</span>
            <span className="xda-io">
              <span><em>Vous choisissez</em><strong>{f.you}</strong></span>
              <span><em>Vous obtenez</em><strong>{f.get}</strong></span>
            </span>
            <span className="xda-meta">{f.meta}</span>
            <span className="xda-open">Ouvrir le dispositif <Icon name="chevron" size={16}/></span>
          </span>
        </button>)}
      </section>
    </div>
  </main>
}

function NotionWorkspace({ data, onBack }) {
  const [selectedNotionId, setSelectedNotionId] = useState(null)
  const [phase, setPhase] = useState('library')
  const [activePublicationId, setActivePublicationId] = useState(null)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [isPaused, setIsPaused] = useState(false)

  const publicationsById = useMemo(
    () => Object.fromEntries((data.publications || []).map(p => [p.publication_id, p])),
    [data.publications]
  )
  const nodesById = useMemo(
    () => Object.fromEntries((data.nodes || []).map(n => [n.node_id, n])),
    [data.nodes]
  )
  const contentsById = useMemo(
    () => Object.fromEntries((data.contents || []).map(c => [c.chunk_id, c])),
    [data.contents]
  )

  const selectedNotion = TRANSVERSAL_NOTIONS.find(n => n.id === selectedNotionId) || null
  const selectedPublicationIds = useMemo(
    () => selectedNotion ? Object.keys(selectedNotion.selections) : [],
    [selectedNotion]
  )

  const visibleLibrary = useMemo(() => {
    const preferred = ['PUB005','PUB006','PUB007','PUB008','PUB010','PUB012','PUB014','PUB015','PUB024','PUB025','PUB031','PUB033','PUB054','PUB057','PUB090','PUB113','PUB118']
    return preferred.map(id => publicationsById[id]).filter(Boolean)
  }, [publicationsById])

  const publicationJourney = useMemo(() => {
    if (!selectedNotion) return []
    return selectedPublicationIds.map(publicationId => {
      const publication = publicationsById[publicationId]
      const nodes = (selectedNotion.selections[publicationId] || [])
        .map(nodeId => nodesById[nodeId])
        .filter(Boolean)
      return { publicationId, publication, nodes }
    })
  }, [selectedNotion, selectedPublicationIds, publicationsById, nodesById])

  const activePublication = useMemo(
    () => publicationJourney.find(item => item.publicationId === activePublicationId) || publicationJourney[0] || null,
    [publicationJourney, activePublicationId]
  )

  const activePublicationIndex = useMemo(
    () => Math.max(0, publicationJourney.findIndex(item => item.publicationId === (activePublication?.publicationId || activePublicationId))),
    [publicationJourney, activePublication, activePublicationId]
  )

  const activeNodes = activePublication?.nodes || []

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null
    return activeNodes.find(node => node.node_id === selectedNodeId) || null
  }, [activeNodes, selectedNodeId])

  const proofChunks = useMemo(() => {
    if (!selectedNode) return []
    return String(selectedNode.chunk_id_source || '')
      .split(';')
      .map(x => x.trim())
      .filter(Boolean)
      .map(id => contentsById[id])
      .filter(Boolean)
  }, [selectedNode, contentsById])

  const ribbonPositions = useMemo(
    () => buildRibbonPositions(publicationJourney.length),
    [publicationJourney.length]
  )

  const activeStation = ribbonPositions[activePublicationIndex] || { x: 50, y: 20 }
  const focusX = 30 + (((activeStation.x - 8) / 84) * 40)
  const focusY = 54
  const treeOffsets = useMemo(() => buildTreeOffsets(activeNodes.length), [activeNodes.length])

  function chooseNotion(id) {
    const notion = TRANSVERSAL_NOTIONS.find(item => item.id === id)
    const firstPublicationId = notion ? Object.keys(notion.selections)[0] || null : null
    setSelectedNodeId(null)
    setIsPaused(false)
    setSelectedNotionId(id)
    setActivePublicationId(firstPublicationId)
    setPhase('filtering')
  }

  function resetNotion() {
    setSelectedNodeId(null)
    setSelectedNotionId(null)
    setActivePublicationId(null)
    setIsPaused(false)
    setPhase('library')
  }

  function selectPublication(publicationId) {
    setActivePublicationId(publicationId)
    setSelectedNodeId(null)
  }

  function chooseNode(nodeId) {
    setSelectedNodeId(current => {
      const next = current === nodeId ? null : nodeId
      if (next) setIsPaused(true)
      return next
    })
  }

  useEffect(() => {
    if (!selectedNotionId) return undefined
    const passingTimer = window.setTimeout(() => setPhase('passing'), 650)
    const finalTimer = window.setTimeout(() => setPhase('final'), 1800)
    return () => {
      window.clearTimeout(passingTimer)
      window.clearTimeout(finalTimer)
    }
  }, [selectedNotionId])

  useEffect(() => {
    if (!publicationJourney.length) return
    if (!activePublicationId) setActivePublicationId(publicationJourney[0].publicationId)
  }, [publicationJourney, activePublicationId])

  useEffect(() => {
    if (phase !== 'final' || publicationJourney.length <= 1 || isPaused) return undefined
    const timer = window.setInterval(() => {
      setActivePublicationId(current => {
        const currentIndex = publicationJourney.findIndex(item => item.publicationId === current)
        const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % publicationJourney.length
        return publicationJourney[nextIndex].publicationId
      })
      setSelectedNodeId(null)
    }, 4600)
    return () => window.clearInterval(timer)
  }, [phase, publicationJourney, isPaused])

  return <main className="page notion-workspace ribbon-version">
    <button className="chrono-return" type="button" onClick={onBack}><Icon name="back" size={15}/> D’un document à l’autre</button>

    <header className="notion-hero ribbon-hero">
      <div className="crossdoc-kicker">D’UN DOCUMENT À L’AUTRE</div>
      <div className="notion-title-row">
        <h1>Suivre une notion</h1>
        <span className="crossdoc-beta notion-beta-inline">BÊTA</span>
      </div>
      <p className="ribbon-intro">La notion se déplace d’une publication à l’autre, puis déploie localement ses déclinaisons.</p>
    </header>

    <section className="notion-selector ribbon-selector" aria-label="Choisir une notion transversale">
      <div className="notion-choice-grid ribbon-choice-grid">
        {TRANSVERSAL_NOTIONS.map(notion => {
          const publicationCount = Object.keys(notion.selections).length
          const elementCount = Object.values(notion.selections).reduce((sum, ids) => sum + ids.length, 0)
          return <button key={notion.id} type="button" className={`notion-choice-card ${selectedNotionId === notion.id ? 'selected' : ''}`} onClick={() => chooseNotion(notion.id)} style={{'--notion-accent': notion.accent}}>
            <strong>{notion.label}</strong>
            <small>{publicationCount} publication{publicationCount > 1 ? 's' : ''} · {elementCount} éléments</small>
          </button>
        })}
      </div>
    </section>

    <section className={`notion-passage-stage ribbon-stage phase-${phase}`}>
      <div className="ribbon-stage-head">
        <div className="ribbon-stage-caption"><span>2</span><div><strong>{!selectedNotion ? 'Choisissez une notion' : 'La notion se déplace entre les publications'}</strong><small>{!selectedNotion ? 'Le parcours s’ouvrira ici.' : 'La publication active se distingue ; son arbre de déclinaisons se déploie sous elle.'}</small></div></div>
        {selectedNotion && <div className="ribbon-actions">
          <button type="button" className="notion-motion-button primary" onClick={() => setIsPaused(true)} disabled={isPaused}><span className="notion-motion-glyph">❚❚</span> Arrêter l’animation</button>
          <button type="button" className="notion-motion-button" onClick={() => setIsPaused(false)} disabled={!isPaused}><span className="notion-motion-glyph">▶</span> Reprendre</button>
          <button type="button" className="notion-reset" onClick={resetNotion}><Icon name="reset" size={15}/> Revenir au corpus</button>
        </div>}
      </div>

      {selectedNotion && phase === 'final' ? <div className={`ribbon-shell ${selectedNode ? 'detail-open' : 'detail-closed'}`}>
        <div className="ribbon-layout">
          <div className="ribbon-scene" style={{'--notion-accent': selectedNotion.accent}}>
            <svg className="ribbon-svg" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="ribbonGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0b62bd"/>
                  <stop offset="18%" stopColor="#188ee2"/>
                  <stop offset="42%" stopColor="#45c0f5"/>
                  <stop offset="58%" stopColor="#6ed7ff"/>
                  <stop offset="78%" stopColor="#249ee8"/>
                  <stop offset="100%" stopColor="#0b62bd"/>
                </linearGradient>
                <linearGradient id="ribbonShade" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity=".10"/>
                  <stop offset="48%" stopColor="#0a6fc9" stopOpacity=".04"/>
                  <stop offset="100%" stopColor="#063e81" stopOpacity=".30"/>
                </linearGradient>
                <filter id="ribbonGlow" x="-25%" y="-80%" width="150%" height="260%">
                  <feGaussianBlur stdDeviation="11"/>
                </filter>
              </defs>
              <g className="ribbon-band">
                <path className="ribbon-shadow" d="M-45 162 C 85 232, 205 86, 344 151 C 478 214, 585 228, 706 157 C 822 89, 918 102, 1045 157"/>
                <path className="ribbon-main" d="M-45 162 C 85 232, 205 86, 344 151 C 478 214, 585 228, 706 157 C 822 89, 918 102, 1045 157"/>
                <path className="ribbon-depth" d="M-45 171 C 85 241, 205 95, 344 160 C 478 223, 585 237, 706 166 C 822 98, 918 111, 1045 166"/>
                <path className="ribbon-topline" d="M-45 144 C 85 214, 205 68, 344 133 C 478 196, 585 210, 706 139 C 822 71, 918 84, 1045 139"/>
                <path className={`ribbon-light-runner ${isPaused ? 'paused' : ''}`} d="M-45 162 C 85 232, 205 86, 344 151 C 478 214, 585 228, 706 157 C 822 89, 918 102, 1045 157"/>
              </g>
            </svg>

            {publicationJourney.map((item, index) => {
              const position = ribbonPositions[index] || { x: 50, y: 20 }
              const isActive = item.publicationId === activePublication?.publicationId
              return <button
                key={item.publicationId}
                type="button"
                className={`ribbon-publication ${isActive ? 'active' : ''}`}
                style={{left: `${position.x}%`, top: `${position.y}%`}}
                onClick={() => selectPublication(item.publicationId)}
                title={item.publication?.titre || item.publicationId}
              >
                {item.publication?.has_image !== false ? <img src={publicationImageSrc(item.publication?.image_path, item.publicationId)} alt=""/> : <div className="notion-publication-cover-placeholder">{item.publicationId}</div>}
                <div>
                  <strong>{item.publication?.titre || item.publicationId}</strong>
                  <span>{formatPublicationDate(item.publication)}</span>
                </div>
                {isActive && <b className="ribbon-step-badge">{activePublicationIndex + 1}</b>}
              </button>
            })}

            <div className="ribbon-travel-dot" style={{left: `${activeStation.x}%`, top: `calc(${activeStation.y}% + 86px)`}} aria-hidden="true"></div>
            <div className="ribbon-drop-line" style={{left: `${activeStation.x}%`, top: `calc(${activeStation.y}% + 92px)`, height: `${Math.max(70, (focusY - activeStation.y) * 8)}px`}} aria-hidden="true"></div>

            <div className="ribbon-tree" key={activePublication?.publicationId || 'none'}>
              <div className="ribbon-core" style={{left: `${focusX}%`, top: `${focusY}%`, '--notion-accent': selectedNotion.accent}}>
                <Icon name={selectedNotion.icon} size={31}/>
                <strong>{selectedNotion.label}</strong>
                <span>{activePublicationIndex + 1} / {publicationJourney.length}</span>
              </div>

              {activeNodes.map((node, index) => {
                const offset = treeOffsets[index] || {x:0,y:0}
                return <button
                  key={node.node_id}
                  type="button"
                  className={`ribbon-declination ${selectedNode?.node_id === node.node_id ? 'selected' : ''}`}
                  style={{left: `calc(${focusX}% + ${offset.x}px)`, top: `calc(${focusY}% + ${offset.y}px)`, '--decl-index': index}}
                  onClick={() => chooseNode(node.node_id)}
                  title={node.libelle}
                >
                  <span>{node.libelle}</span>
                </button>
              })}
            </div>

            <div className={`ribbon-eclaireur ${selectedNode ? 'active' : ''}`}>
              <div className="ribbon-eclaireur-title">L’Éclaireur</div>
              <p>{selectedNode ? 'Source retrouvée dans le document actif.' : 'Cliquez sur un terme pour accéder à la source.'}</p>
            </div>
          </div>

          {selectedNode && <aside className="notion-journey-panel ribbon-detail-panel">
            <div className="notion-journey-panel-block">
              <div className="notion-panel-title">Publication et preuve</div>
              {activePublication && <div className="notion-panel-publication-card">
                {activePublication.publication?.has_image !== false ? <img src={publicationImageSrc(activePublication.publication?.image_path, activePublication.publicationId)} alt=""/> : <div className="notion-publication-cover-placeholder">{activePublication.publicationId}</div>}
                <div>
                  <small>{activePublication.publicationId}</small>
                  <strong>{activePublication.publication?.titre || activePublication.publicationId}</strong>
                  <span>{formatPublicationDate(activePublication.publication)}</span>
                </div>
              </div>}
            </div>
            <div className="notion-journey-panel-block">
              <div className="notion-panel-title">Élément sélectionné</div>
              <button type="button" className="notion-panel-chip selected single">{selectedNode.libelle}</button>
              <div className="notion-panel-meta">
                <div><b>Type</b><span>{TYPE_LABELS[selectedNode.type_noeud] || selectedNode.type_noeud || '—'}</span></div>
                <div><b>Pages</b><span>{selectedNode.page_source || '—'}</span></div>
                <div><b>Chunks</b><span>{selectedNode.chunk_id_source || '—'}</span></div>
              </div>
            </div>
            <div className="notion-journey-panel-block">
              <div className="notion-panel-title">Preuve principale</div>
              <div className="notion-panel-proof-list">
                {proofChunks.length ? proofChunks.map(chunk => <article key={chunk.chunk_id}>
                  <header><b>{chunk.chunk_id}</b><span>{chunk.section || `p. ${chunk.page_debut || ''}`}</span></header>
                  <p>{chunk.texte}</p>
                </article>) : <p className="notion-no-proof">Aucun extrait source disponible dans les données chargées.</p>}
              </div>
              {activePublication?.publication && cleanUrl(activePublication.publication.url_contenu || activePublication.publication.url_source)
                ? <a className="notion-source-link" href={cleanUrl(activePublication.publication.url_contenu || activePublication.publication.url_source)} target="_blank" rel="noreferrer"><Icon name="external" size={16}/> Ouvrir la source</a>
                : null}
            </div>
          </aside>}
        </div>
      </div> : <div className="notion-stage-canvas ribbon-loading-canvas">
        {phase !== 'final' && <div className="notion-library">
          {visibleLibrary.map((publication, index) => {
            const relevant = selectedPublicationIds.includes(publication.publication_id)
            return <article key={publication.publication_id} className={`notion-source-card ${selectedNotion ? (relevant ? 'relevant' : 'dimmed') : ''}`} style={{'--source-index': index}}>
              {publication.has_image !== false ? <img src={publicationImageSrc(publication.image_path, publication.publication_id)} alt=""/> : <div className="notion-publication-cover-placeholder">{publication.publication_id}</div>}
              <div><small>{publication.publication_id}</small><strong>{publication.titre}</strong><span>{publication.organisme_producteur || publication.type_document}</span></div>
            </article>
          })}
        </div>}
        {selectedNotion && phase !== 'final' && <div className="notion-passage-status"><b>Le parcours se construit</b><span>Les publications concernées restent au premier plan.</span></div>}
      </div>}
    </section>
  </main>
}

function ChronologyWorkspace({ data, onBack }) {
  const { chronology, error } = useChronologyData(true)
  const [publicationId, setPublicationId] = useState(null)
  const [phase, setPhase] = useState('ready')
  const [revealed, setRevealed] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [passageIndex, setPassageIndex] = useState(0)
  const [sourceCollapsed, setSourceCollapsed] = useState(false)
  const [nonPositionableOpen, setNonPositionableOpen] = useState(true)
  const timelineScrollRef = useRef(null)
  const timelineEventRefs = useRef({})
  const choiceRef = useRef(null)

  const publications = useMemo(
    () => Object.fromEntries((data.publications || []).map(p => [p.publication_id, p])),
    [data.publications]
  )
  const contents = useMemo(
    () => Object.fromEntries((data.contents || []).map(c => [c.chunk_id, c])),
    [data.contents]
  )

  const publicationChoices = useMemo(() => ELIGIBLE_PUBLICATIONS
    .filter(id => chronology?.elements.some(e => e.publication_id === id))
    .map(id => publications[id] || { publication_id: id, titre: id }),
  [chronology, publications])

  const allElements = useMemo(
    () => publicationId ? (chronology?.elements.filter(e => e.publication_id === publicationId) || []) : [],
    [chronology, publicationId]
  )

  const positionable = useMemo(() => allElements
    .filter(e => e.decision_post_traitement === 'retenu' && temporalValue(e) !== null)
    .sort((a, b) => temporalValue(a) - temporalValue(b) || a.chrono_id.localeCompare(b.chrono_id)),
  [allElements])

  const nonPositionable = useMemo(
    () => allElements.filter(e => e.decision_post_traitement === 'non_positionnable'),
    [allElements]
  )

  const transformSequence = useMemo(() => [...positionable, ...nonPositionable], [positionable, nonPositionable])

  const provenancesByElement = useMemo(() => {
    const map = {}
    ;(chronology?.provenances || []).forEach(p => {
      if (p.publication_id !== publicationId) return
      ;(map[p.chrono_id] ||= []).push(p)
    })
    return map
  }, [chronology, publicationId])

  const passages = useMemo(() => {
    if (!publicationId) return []
    const map = new Map()
    allElements.forEach(element => {
      ;(provenancesByElement[element.chrono_id] || []).forEach(prov => {
        const key = sourcePassageKey(prov)
        const chunk = contents[prov.chunk_id]
        if (!map.has(key)) {
          map.set(key, {
            key,
            chunkId: prov.chunk_id,
            pageSource: prov.page_source || chunk?.page_debut || '',
            section: prov.section || chunk?.section || '',
            order: Number(chunk?.ordre || 9999),
            proofs: [],
          })
        }
        map.get(key).proofs.push({
          chronoId: element.chrono_id,
          proof: prov.preuve || element.preuve,
          expression: prov.expression_temporelle_source || element.expression_temporelle_source,
          confidence: prov.niveau_confiance || element.niveau_confiance,
        })
      })
    })
    return [...map.values()].sort((a, b) => a.order - b.order || a.chunkId.localeCompare(b.chunkId))
  }, [publicationId, allElements, provenancesByElement, contents])

  const visibleElements = useMemo(() => {
    if (phase === 'complete') return transformSequence
    if (phase === 'building') return transformSequence.slice(0, revealed)
    return []
  }, [phase, transformSequence, revealed])

  const visibleIds = useMemo(() => new Set(visibleElements.map(e => e.chrono_id)), [visibleElements])
  const selected = selectedId ? allElements.find(e => e.chrono_id === selectedId) : null
  const currentElement = phase === 'building' && revealed < transformSequence.length
    ? transformSequence[revealed]
    : null
  const activeElement = selected || currentElement

  const currentPassage = passages[Math.min(passageIndex, Math.max(0, passages.length - 1))] || null

  useEffect(() => {
    setPhase('ready')
    setRevealed(0)
    setSelectedId(null)
    setPassageIndex(0)
    setSourceCollapsed(false)
    setNonPositionableOpen(true)
  }, [publicationId])

  useEffect(() => {
    if (phase !== 'building') return
    if (!transformSequence.length || revealed >= transformSequence.length) {
      const done = window.setTimeout(() => setPhase('complete'), 380)
      return () => window.clearTimeout(done)
    }
    const timer = window.setTimeout(() => setRevealed(v => v + 1), 245)
    return () => window.clearTimeout(timer)
  }, [phase, revealed, transformSequence.length])

  useEffect(() => {
    if (!activeElement) return
    const prov = (provenancesByElement[activeElement.chrono_id] || [])[0]
    if (prov) {
      const key = sourcePassageKey(prov)
      const idx = passages.findIndex(p => p.key === key)
      if (idx >= 0) setPassageIndex(idx)
    }

    if (visibleIds.has(activeElement.chrono_id)) {
      const eventNode = timelineEventRefs.current[activeElement.chrono_id]
      const scroller = timelineScrollRef.current
      if (eventNode && scroller) {
        const targetLeft = Math.max(0, eventNode.offsetLeft - scroller.clientWidth * 0.48)
        const targetTop = Math.max(0, eventNode.offsetTop - scroller.clientHeight * 0.34)
        scroller.scrollTo({ left: targetLeft, top: targetTop, behavior: 'smooth' })
      }
    }
  }, [activeElement?.chrono_id, passages, provenancesByElement, visibleIds])

  useEffect(() => {
    if (phase !== 'building' || revealed <= 0) return
    const latest = transformSequence[revealed - 1]
    if (!latest || temporalValue(latest) === null) return

    const eventNode = timelineEventRefs.current[latest.chrono_id]
    const scroller = timelineScrollRef.current
    if (!eventNode || !scroller) return

    const targetLeft = Math.max(0, eventNode.offsetLeft - scroller.clientWidth * 0.48)
    const targetTop = Math.max(0, eventNode.offsetTop - scroller.clientHeight * 0.34)
    scroller.scrollTo({ left: targetLeft, top: targetTop, behavior: 'smooth' })
  }, [phase, revealed, transformSequence])

  if (error) return <main className="page chronology-workspace"><button className="back-link" onClick={onBack}><Icon name="back"/>Retour</button><div className="chrono-error"><strong>Chronologie indisponible</strong><p>{error.message}</p></div></main>
  if (!chronology) return <main className="page chronology-workspace"><button className="back-link" onClick={onBack}><Icon name="back"/>Retour</button><div className="chrono-loading"><div className="loader"></div><span>Chargement de la chronologie…</span></div></main>

  const pub = publicationId ? (publications[publicationId] || { publication_id: publicationId, titre: publicationId }) : null
  const total = transformSequence.length
  const progress = total ? Math.round((Math.min(revealed, total) / total) * 100) : 0
  const range = rangeYears(positionable)
  const timelineLayout = buildTimelineLayout(positionable, range)
  const timelineWidth = timelineLayout.width
  const timelineHeight = timelineLayout.height
  const tickStep = Math.max(1, Math.ceil((range.max - range.min) / 10))
  const ticks = []
  for (let y = range.min; y <= range.max; y += tickStep) ticks.push(y)
  if (ticks.length && ticks[ticks.length - 1] !== range.max) ticks.push(range.max)

  const startTransform = () => {
    if (!publicationId || !total) return
    setSelectedId(null)
    setRevealed(0)
    setPassageIndex(0)
    setSourceCollapsed(false)
    setPhase('building')
  }

  const chooseElement = (element) => {
    setSelectedId(element.chrono_id)
    setSourceCollapsed(false)
    const prov = (provenancesByElement[element.chrono_id] || [])[0]
    if (prov) {
      const idx = passages.findIndex(p => p.key === sourcePassageKey(prov))
      if (idx >= 0) setPassageIndex(idx)
    }
  }

  const choosePublication = (id) => setPublicationId(id)
  const changePublication = () => {
    setPublicationId(null)
    window.setTimeout(() => choiceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  const sourceUrl = pub ? (cleanUrl(pub.url_source) || cleanUrl(pub.url_contenu)) : ''
  const activeExpression = activeElement
    ? ((provenancesByElement[activeElement.chrono_id] || [])[0]?.expression_temporelle_source || activeElement.expression_temporelle_source)
    : ''

  return <main className="page chronology-workspace">
    <button className="chrono-return" type="button" onClick={onBack}><Icon name="back" size={16}/>D’un document à l’autre</button>

    <header className="chrono-hero">
      <div className="chrono-title-line">
        <h1>Du texte à la frise, sans perdre la source</h1>
        <span className="chrono-beta-badge">BÊTA</span>
      </div>
      <p className="chrono-subtitle">Une publication <b>→</b> ses repères temporels <b>→</b> une frise interactive</p>

      <div className="chrono-steps" aria-label="Fonctionnement de la chronologie">
        <div className="chrono-step"><span>1</span><div><strong>Choisissez une publication</strong><p>Sélectionnez un document dont la chronologie a été préalablement validée.</p></div></div>
        <div className="chrono-step"><span>2</span><div><strong>Regardez les repères apparaître</strong><p>Dates, périodes, émergences, jalons et tendances sont repérés dans les passages sources.</p></div></div>
        <div className="chrono-step"><span>3</span><div><strong>Transformez le texte en frise</strong><p>Chaque élément rejoint sa position temporelle sans perdre son lien avec la preuve.</p></div></div>
      </div>

      <div className="chrono-deterministic-note"><Icon name="info" size={18}/><span><strong>Restitution déterministe</strong> — aucune interprétation n’est effectuée pendant la consultation. La frise restitue uniquement les données chronologiques validées.</span></div>
    </header>

    <section className="chrono-publication-choice" ref={choiceRef}>
      <div className="chrono-section-title"><span>1</span><h2>Choisissez une publication à explorer</h2></div>
      <div className="chrono-publication-cards">
        {publicationChoices.map(choice => {
          const selectedChoice = publicationId === choice.publication_id
          const elementCount = chronology.elements.filter(e => e.publication_id === choice.publication_id).length
          return <button
            type="button"
            key={choice.publication_id}
            className={`chrono-publication-card ${selectedChoice ? 'selected' : ''}`}
            onClick={() => choosePublication(choice.publication_id)}
          >
            {choice.has_image ? <img src={publicationImageSrc(choice.image_path, choice.publication_id)} alt=""/> : <div className="chrono-publication-cover-placeholder">{choice.publication_id}</div>}
            <div>
              <b>{choice.publication_id}</b>
              <strong>{choice.titre}</strong>
              <span>{choice.organisme_producteur || 'Publication du corpus'}</span>
              <small>{choice['année_publication'] || ''}{choice.type_document ? ` · ${choice.type_document}` : ''} · {elementCount} repères validés</small>
            </div>
          </button>
        })}
      </div>
    </section>

    {publicationId && <section className="chrono-transform-section">
      <div className="chrono-transform-titlebar">
        <div className="chrono-section-title"><span>2</span><h2>Explorez le texte et transformez-le en chronologie</h2></div>
        <div className="chrono-main-actions">
          <button type="button" className="chrono-primary-action" onClick={startTransform} disabled={phase === 'building' || !total}>
            <span className="play-triangle">▶</span>{phase === 'complete' ? 'Rejouer la transformation' : 'Transformer en chronologie'}
          </button>
          <button type="button" className="chrono-secondary-action" onClick={changePublication}><Icon name="reset" size={16}/>Changer de publication</button>
        </div>
      </div>

      <div className={`chrono-transform-grid ${sourceCollapsed ? 'source-collapsed' : ''}`}>
        {!sourceCollapsed && <aside className="chrono-source-panel">
          <div className="chrono-panel-heading">
            <strong>Texte source (extraits)</strong>
            <div className="chrono-source-nav">
              {currentPassage && <span>Page {currentPassage.pageSource || '—'} · {passageIndex + 1}/{passages.length}</span>}
              <button type="button" onClick={() => setPassageIndex(i => Math.max(0, i - 1))} disabled={passageIndex <= 0} aria-label="Extrait précédent">‹</button>
              <button type="button" onClick={() => setPassageIndex(i => Math.min(passages.length - 1, i + 1))} disabled={passageIndex >= passages.length - 1} aria-label="Extrait suivant">›</button>
              <button type="button" className="chrono-collapse-source" onClick={() => setSourceCollapsed(true)} aria-label="Replier le volet texte"><span>Replier</span>‹</button>
            </div>
          </div>

          <div className="chrono-source-body">
            {currentPassage ? <>
              <div className="chrono-source-meta"><b>{currentPassage.section || 'Extrait source'}</b><span>{currentPassage.chunkId}</span></div>
              {currentPassage.proofs.map((proof, idx) => {
                const isActive = activeElement?.chrono_id === proof.chronoId
                return <div key={`${proof.chronoId}-${idx}`} className={`chrono-source-proof ${isActive ? 'active' : ''}`}>
                  <SourceExcerpt
                    text={proof.proof}
                    expression={proof.expression}
                    active={isActive}
                    transferred={visibleIds.has(proof.chronoId)}
                    onClick={() => {
                      const element = allElements.find(e => e.chrono_id === proof.chronoId)
                      if (element && visibleIds.has(element.chrono_id)) chooseElement(element)
                    }}
                  />
                </div>
              })}
              <div className="chrono-source-footer">
                <span>Preuve issue de {publicationId}</span>
                {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer">Voir le document source <Icon name="external" size={13}/></a>}
              </div>
            </> : <div className="chrono-empty-source">Aucun extrait source disponible.</div>}
          </div>
        </aside>}

        {sourceCollapsed && <button type="button" className="chrono-expand-source" onClick={() => setSourceCollapsed(false)}><span>Afficher le texte source</span>›</button>}

        <section className="chrono-timeline-panel">
          <div className="chrono-panel-heading chrono-timeline-heading">
            <strong>Frise chronologique</strong>
            <div className="chrono-timeline-legend">
              <span><i className="legend-dot"></i>Événement / jalon</span>
              <span><i className="legend-period"></i>Période</span>
              <span><i className="legend-open"></i>Période ouverte</span>
            </div>
          </div>

          {phase === 'ready' && <div className="chrono-timeline-empty">
            <div className="chrono-empty-axis"><i></i><i></i><i></i><i></i></div>
            <strong>La frise attend la transformation du texte.</strong>
            <p>Les repères surlignés à gauche rejoindront progressivement leur position temporelle.</p>
          </div>}

          {phase !== 'ready' && <>
            <div className="chrono-progress"><span style={{ width: `${phase === 'complete' ? 100 : progress}%` }}></span></div>
            <div
              className="chrono-timeline-scroll"
              ref={timelineScrollRef}
              style={{ height: `${Math.min(560, Math.max(385, timelineHeight + 12))}px` }}
            >
              <div className="chrono-timeline" style={{ width: timelineWidth, height: timelineHeight }}>
                <div className="chrono-axis"></div>
                {ticks.map(year => {
                  const x = timelineX(year, range, timelineWidth)
                  return <div key={year} className="chrono-tick" style={{ left: `${x}px` }}><span>{year}</span></div>
                })}

                {positionable.map(element => {
                  const value = temporalValue(element)
                  const placement = timelineLayout.placements[element.chrono_id] || { x: TIMELINE_HORIZONTAL_PADDING, lane: 0 }
                  const visible = visibleIds.has(element.chrono_id)
                  const endValue = temporalValueFromNormalized(element.date_fin_normalisee)
                  const isClosedPeriod = element.statut_temporel === 'periode_fermee' && endValue !== null && endValue > value
                  const isOpenPeriod = element.statut_temporel === 'periode_ouverte'
                  const endX = isClosedPeriod && endValue !== null
                    ? timelineX(endValue, range, timelineWidth)
                    : (isOpenPeriod ? timelineWidth - TIMELINE_HORIZONTAL_PADDING : placement.x)
                  const spanPx = (isClosedPeriod || isOpenPeriod) ? Math.max(24, endX - placement.x) : 0
                  return <button
                    key={element.chrono_id}
                    ref={node => { timelineEventRefs.current[element.chrono_id] = node }}
                    type="button"
                    className={`chrono-event ${visible ? 'visible' : ''} ${selectedId === element.chrono_id ? 'selected' : ''} nature-${element.nature_chronologique} ${isClosedPeriod ? 'period closed-period' : isOpenPeriod ? 'period open-period' : 'point'} ${activeElement?.chrono_id === element.chrono_id ? 'transforming' : ''}`}
                    style={{ left: `${placement.x}px`, top: `${TIMELINE_CARD_TOP + placement.lane * TIMELINE_LANE_HEIGHT}px` }}
                    onClick={() => visible && chooseElement(element)}
                    disabled={!visible}
                    title={element.libelle}
                  >
                    {spanPx > 0 && <span className="chrono-period-track" style={{ width: `${spanPx}px` }} aria-hidden="true"></span>}
                    <i></i>
                    <span className="chrono-event-date">{element.expression_temporelle_source || element.date_debut_normalisee}</span>
                    <strong>{element.libelle}</strong>
                    <small>{NAT_LABELS[element.nature_chronologique] || element.nature_chronologique}</small>
                  </button>
                })}
              </div>
            </div>
          </>}

          <div className={`chrono-unpositionable ${phase === 'complete' || nonPositionable.some(e => visibleIds.has(e.chrono_id)) ? 'visible' : ''}`}>
            <button type="button" className="chrono-unpositionable-head" onClick={() => setNonPositionableOpen(v => !v)}>
              <span><strong>Éléments non positionnables dans le temps ({nonPositionable.length})</strong><small>Conservés sans date artificielle</small></span>
              <b className={nonPositionableOpen ? 'open' : ''}>⌄</b>
            </button>
            {nonPositionableOpen && <div className="chrono-unpositionable-list">
              {nonPositionable.map(element => <button
                key={element.chrono_id}
                className={visibleIds.has(element.chrono_id) ? 'visible' : ''}
                onClick={() => visibleIds.has(element.chrono_id) && chooseElement(element)}
                disabled={!visibleIds.has(element.chrono_id)}
              >
                <b>{element.expression_temporelle_source || 'Repère relatif'}</b>
                <span>{element.libelle}</span>
              </button>)}
            </div>}
          </div>
        </section>

        {phase === 'building' && currentElement && !sourceCollapsed && <div key={currentElement.chrono_id} className={`chrono-flight nature-${currentElement.nature_chronologique}`} aria-hidden="true">
          <span>{activeExpression || currentElement.date_debut_normalisee || 'repère'}</span>
        </div>}
      </div>
    </section>}
  </main>
}

export default function CrossDocuments({ data }) {
  const [view, setView] = useState('home')

  if (view === 'recommendations') return <DocumentLinksWorkspace data={data} onBack={() => setView('home')} />
  if (view === 'chronology') return <ChronoFrise data={data} onBack={() => setView('home')} />
  if (view === 'notions') return <NotionSpace data={data} onBack={() => setView('home')} />
  return <CrossDocumentsHome
    data={data}
    onOpenChronology={() => setView('chronology')}
    onOpenNotions={() => setView('notions')}
    onOpenRecommendations={() => setView('recommendations')}
  />
}

/* ==========================================================================
   SUIVRE UNE NOTION — l'espace documentaire (version 2)
   Les publications du corpus forment un cercle ; la notion voyage d'une
   publication à l'autre et fait apparaître ses dimensions à chaque escale.
   Données identiques à la version précédente : TRANSVERSAL_NOTIONS,
   nœuds, extraits. Aucun nouveau rapprochement n'est créé.
   ========================================================================== */
const XD_TYPE_ORDER = ['probleme', 'notion_idee', 'tendance', 'signal_faible', 'acteur', 'action', 'recommandation', 'instrument_dispositif', 'expert_public', 'localisation']
const XD_TRAVEL = 1100
const XD_CONDENSE = 700
const xdDwell = count => 2200 + count * 650
const xdTypeVar = type => `var(--xd-t-${TYPE_LABELS[type] ? type : 'notion_idee'})`

function useStageSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref])
  return size
}

function NotionSpace({ data, onBack }) {
  const stageRef = useRef(null)
  const orbRef = useRef(null)
  const trailRef = useRef(null)
  const { w, h } = useStageSize(stageRef)
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [notionId, setNotionId] = useState(null)
  const [paused, setPaused] = useState(false)
  const [run, setRun] = useState(0)
  const [state, setState] = useState({ step: -1, phase: 'idle' })
  const [viewing, setViewing] = useState(null)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const clockRef = useRef({ t: 0, last: 0, paused: false })

  const publications = useMemo(() => (data.publications || []).filter(p => p.has_graph).sort((a, b) => a.publication_id.localeCompare(b.publication_id)), [data.publications])
  const publicationsById = useMemo(() => Object.fromEntries((data.publications || []).map(p => [p.publication_id, p])), [data.publications])
  const nodesById = useMemo(() => Object.fromEntries((data.nodes || []).map(n => [n.node_id, n])), [data.nodes])
  const contentsById = useMemo(() => Object.fromEntries((data.contents || []).map(c => [c.chunk_id, c])), [data.contents])
  const notion = TRANSVERSAL_NOTIONS.find(n => n.id === notionId) || null
  const stops = useMemo(() => notion ? Object.keys(notion.selections).map(id => ({
    id, publication: publicationsById[id],
    nodes: (notion.selections[id] || []).map(n => nodesById[n]).filter(Boolean),
  })).filter(s => s.publication) : [], [notion, publicationsById, nodesById])

  // Géométrie de l'espace documentaire
  const geo = useMemo(() => {
    if (!w || !h) return null
    const cx = w / 2, cy = h / 2 + 8, R = Math.max(200, Math.min(w / 2 - 70, h / 2 - 46))
    const pos = {}
    publications.forEach((p, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / Math.max(1, publications.length)
      pos[p.publication_id] = { a, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }
    })
    const pts = stops.map(s => { const q = pos[s.id]; return { a: q.a, x: cx + (R - 34) * Math.cos(q.a), y: cy + (R - 34) * Math.sin(q.a) } })
    const segs = pts.map((p, i) => {
      const s = i ? pts[i - 1] : { x: cx, y: cy, a: p.a + Math.PI }
      const d = Math.abs(Math.atan2(Math.sin(p.a - s.a), Math.cos(p.a - s.a)))
      const f = .3 + .55 * (1 - d / Math.PI), mx = (s.x + p.x) / 2, my = (s.y + p.y) / 2
      return `M${s.x},${s.y} Q${cx + (mx - cx) * f},${cy + (my - cy) * f} ${p.x},${p.y}`
    })
    const dots = stops.map((s, i) => s.nodes.map((node, k) => {
      const m = s.nodes.length, spread = Math.min(.09, .5 / m), ang = pts[i].a + (k - (m - 1) / 2) * spread, rr = R * (k % 2 ? .6 : .7)
      return { x: cx + rr * Math.cos(ang), y: cy + rr * Math.sin(ang) }
    }))
    return { cx, cy, R, pos, pts, segs, dots }
  }, [w, h, publications, stops])

  // Calendrier de l'animation (déterministe : un temps qui n'avance pas pendant la pause)
  const schedule = useMemo(() => {
    let t = 0
    return stops.map(s => { const start = t; t += XD_TRAVEL + xdDwell(s.nodes.length) + XD_CONDENSE; return { start, travelEnd: start + XD_TRAVEL, dwellEnd: start + XD_TRAVEL + xdDwell(s.nodes.length), end: t } })
  }, [stops])
  const total = schedule.length ? schedule[schedule.length - 1].end : 0

  useEffect(() => { clockRef.current.paused = paused }, [paused])
  useEffect(() => {
    if (!notion || !geo) return
    const clock = clockRef.current
    clock.t = reduceMotion ? total : 0
    clock.last = performance.now()
    setViewing(null); setSelectedNodeId(null)
    const lengths = geo.segs.map(d => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); return { p, len: p.getTotalLength() } })
    let raf = 0, current = ''
    const frame = now => {
      if (!clock.paused) clock.t = Math.min(total, clock.t + (now - clock.last))
      clock.last = now
      const t = clock.t
      let step = schedule.findIndex(s => t < s.end); if (step < 0) step = schedule.length
      let phase = 'done'
      if (step < schedule.length) { const s = schedule[step]; phase = t < s.travelEnd ? 'travel' : t < s.dwellEnd ? 'dwell' : 'condense' }
      // sphère et tracé
      let drawn = lengths.slice(0, Math.min(step, lengths.length)).reduce((a, x) => a + x.len, 0)
      let orb = step === 0 && phase === 'travel' ? { x: geo.cx, y: geo.cy } : geo.pts[Math.min(step, geo.pts.length - 1)]
      if (step < schedule.length && phase === 'travel') {
        const k = (t - schedule[step].start) / XD_TRAVEL, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
        orb = lengths[step].p.getPointAtLength(lengths[step].len * e); drawn += lengths[step].len * e
      } else if (step < schedule.length) drawn += lengths[step].len
      if (orbRef.current && orb) { orbRef.current.style.left = `${orb.x}px`; orbRef.current.style.top = `${orb.y}px` }
      if (trailRef.current) trailRef.current.style.strokeDasharray = `${drawn} 999999`
      const key = `${step}|${phase}`
      if (key !== current) { current = key; setState({ step, phase }) }
      if (t < total) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [notion, geo, schedule, total, run, reduceMotion])

  const done = state.phase === 'done'
  const seen = useMemo(() => {
    const upto = done ? stops.length : state.step + (state.phase === 'travel' ? 0 : 1)
    const counts = {}, firstAt = {}
    stops.slice(0, Math.max(0, upto)).forEach((s, i) => s.nodes.forEach(n => { counts[n.type_noeud] = (counts[n.type_noeud] || 0) + 1; if (firstAt[n.type_noeud] === undefined) firstAt[n.type_noeud] = i }))
    return { counts, firstAt, upto }
  }, [stops, state, done])
  const types = useMemo(() => XD_TYPE_ORDER.filter(t => stops.some(s => s.nodes.some(n => n.type_noeud === t))), [stops])
  const activeStop = viewing !== null ? viewing : (!done && state.step >= 0 && state.step < stops.length && state.phase !== 'travel' ? state.step : null)
  const showChips = activeStop !== null && (viewing !== null || state.phase === 'dwell' || state.phase === 'condense')
  const condensing = viewing === null && state.phase === 'condense'
  const selectedNode = selectedNodeId ? stops.flatMap(s => s.nodes).find(n => n.node_id === selectedNodeId) : null
  const selectedStop = selectedNode ? stops.find(s => s.nodes.includes(selectedNode)) : null
  const proofChunks = selectedNode ? String(selectedNode.chunk_id_source || '').split(';').map(x => contentsById[x.trim()]).filter(Boolean) : []
  const sourceUrl = selectedStop ? cleanUrl(selectedStop.publication.url_contenu || selectedStop.publication.url_source) : ''

  const chooseNotion = id => { setNotionId(id); setPaused(false); setRun(r => r + 1) }
  const replay = () => { setPaused(false); setRun(r => r + 1) }
  const overview = () => { clockRef.current.t = total; setPaused(false); setViewing(null) }
  const revisit = i => { if (!done) return; setViewing(i); setSelectedNodeId(null); if (orbRef.current && geo) { orbRef.current.style.left = `${geo.pts[i].x}px`; orbRef.current.style.top = `${geo.pts[i].y}px` } }

  // Fiches de l'escale : libellés affichés en entier (pas de troncature), en une ou deux colonnes.
  const chips = activeStop !== null && geo ? (() => {
    const s = stops[activeStop], m = s.nodes.length, cols = m > 4 ? 2 : 1, gap = 10
    const cw = cols === 2 ? Math.min(280, (Math.min(w - 40, geo.R * 2.1) - gap) / 2) : Math.min(340, geo.R * 1.6)
    const perLine = Math.max(16, Math.floor((cw - 23) / 6.9))
    const heightOf = node => 8 + 17 + Math.ceil(String(node.libelle || '').length / perLine) * 17.2 + 10
    const colH = Array(cols).fill(0), placed = s.nodes.map((node, k) => { const c = k % cols, y = colH[c]; colH[c] += heightOf(node) + gap; return { node, c, y } })
    const totalH = Math.max(...colH) - gap, x0 = geo.cx - (cols * cw + (cols - 1) * gap) / 2, y0 = Math.max(12, geo.cy - totalH / 2)
    return placed.map(({ node, c, y }, k) => ({ node, w: cw, x: x0 + c * (cw + gap), y: y0 + y, dot: geo.dots[activeStop][k] }))
  })() : []

  return <main className="xd-screen xd-notion">
    <header className="xd-bar">
      <button type="button" className="xd-back" onClick={onBack}><Icon name="back" size={16}/>D’un document à l’autre</button>
      <h1>Suivre une notion</h1>
      <span className="xd-beta">Bêta</span>
      <span className="xd-spacer"/>
      {notion && <div className="xd-actions">
        <button type="button" className="xd-btn primary" onClick={replay}><Icon name="reset" size={15}/>Rejouer</button>
        <button type="button" className="xd-btn" onClick={() => setPaused(p => !p)} disabled={done} aria-pressed={paused}>{paused ? <>▶ Reprendre</> : <>❚❚ Pause</>}</button>
        <button type="button" className="xd-btn" onClick={overview} disabled={done}>Vue d’ensemble</button>
      </div>}
    </header>
    <nav className="xd-notions" aria-label="Choisir une notion">
      <span>Notion</span>
      {TRANSVERSAL_NOTIONS.map(n => {
        const count = Object.values(n.selections).reduce((a, x) => a + x.length, 0)
        return <button key={n.id} type="button" className={`xd-notion-chip ${notionId === n.id ? 'on' : ''}`} onClick={() => chooseNotion(n.id)}>
          {n.label}<small>{Object.keys(n.selections).length} publications · {count} éléments</small>
        </button>
      })}
    </nav>
    <div className="xd-body">
      <section className="xd-stage" ref={stageRef}>
        {geo && <svg className="xd-layer" width={w} height={h} aria-hidden="true">
          <defs>
            <radialGradient id="xd-space"><stop offset="0" stopColor="#e9eeff" stopOpacity=".9"/><stop offset="1" stopColor="#e9eeff" stopOpacity="0"/></radialGradient>
            <linearGradient id="xd-trail" x1="0" x2="1"><stop offset="0" stopColor="#3d6bff" stopOpacity=".3"/><stop offset="1" stopColor="#3d6bff" stopOpacity=".85"/></linearGradient>
          </defs>
          <circle cx={geo.cx} cy={geo.cy} r={geo.R} fill="url(#xd-space)" stroke="#cfd6e3" strokeWidth="1.5" strokeDasharray="2 6"/>
          <circle cx={geo.cx} cy={geo.cy} r={geo.R * .64} fill="none" stroke="#e3e7ef"/>
          {notion && <path ref={trailRef} d={geo.segs.join(' ')} fill="none" stroke="url(#xd-trail)" strokeWidth="3" strokeLinecap="round" style={{ strokeDasharray: '0 999999' }}/>}
        </svg>}
        {geo && publications.map(p => {
          const q = geo.pos[p.publication_id], stopIndex = stops.findIndex(s => s.id === p.publication_id)
          const visited = stopIndex >= 0 && (done || stopIndex < seen.upto)
          const active = stopIndex >= 0 && stopIndex === activeStop
          return <button key={p.publication_id} type="button"
            className={`xd-pub ${stopIndex >= 0 ? 'in-notion' : ''} ${visited ? 'visited' : ''} ${active ? 'active' : ''}`}
            style={{ left: q.x, top: q.y, '--rot': `${(q.a + Math.PI / 2) * 180 / Math.PI}deg` }}
            title={`${p.publication_id} · ${p.titre}`} aria-label={`${p.publication_id} · ${p.titre}`} onClick={() => stopIndex >= 0 && revisit(stopIndex)} tabIndex={stopIndex >= 0 && done ? 0 : -1}>
            {p.has_image !== false ? <img src={publicationImageSrc(p.image_path, p.publication_id)} alt=""/> : <span aria-hidden="true"/>}
          </button>
        })}
        {geo && <div className={`xd-core ${showChips ? 'hidden' : ''}`} style={{ left: geo.cx, top: geo.cy }}>
          {notion ? <><strong>{notion.label}</strong><small>{stops.length} escales · {stops.reduce((a, s) => a + s.nodes.length, 0)} éléments</small></>
            : <><strong>Espace documentaire</strong><small>{publications.length} publications · choisissez une notion</small></>}
        </div>}
        {geo && notion && stops.map((s, i) => s.nodes.map((node, k) => {
          const visible = done ? true : i < state.step || (i === state.step && state.phase === 'done')
          const d = geo.dots[i][k]
          return <button key={node.node_id} type="button" className={`xd-dot ${visible ? '' : 'hidden'} ${selectedNodeId === node.node_id ? 'sel' : ''}`}
            style={{ left: d.x, top: d.y, '--c': xdTypeVar(node.type_noeud) }} title={node.libelle}
            onClick={() => { if (!done) return; revisit(i); setSelectedNodeId(node.node_id) }} tabIndex={visible && done ? 0 : -1}/>
        }))}
        {showChips && chips.map(({ node, w: cw, x, y, dot }) => <XdChip key={`${activeStop}-${node.node_id}-${run}`} node={node} width={cw} from={geo.pts[activeStop]} to={{ x, y }} back={condensing ? dot : null}
          selected={selectedNodeId === node.node_id} onClick={() => setSelectedNodeId(node.node_id)}/>)}
        {notion && <div ref={orbRef} className="xd-orb" aria-hidden="true"/>}
        {notion && activeStop !== null && <div className="xd-caption">
          <small>Escale {activeStop + 1} sur {stops.length} · {stops[activeStop].id} · {stops[activeStop].publication['année_publication']}</small>
          <strong>{stops[activeStop].publication.titre}</strong>
          <span>{stops[activeStop].publication.organisme_producteur}</span>
        </div>}
        {notion && done && viewing === null && <div className="xd-caption">
          <small>Parcours complet</small>
          <strong>{notion.label} : {stops.length} escales, {types.length} dimensions</strong>
          <span>Cliquez sur une publication éclairée, un point ou une escale pour revoir ses éléments.</span>
        </div>}
        {!notion && <div className="xd-caption"><small>Espace documentaire</small><strong>Les {publications.length} publications du corpus forment le cercle.</strong><span>Choisissez une notion : elle voyagera d’une publication à l’autre et fera apparaître ses dimensions.</span></div>}
      </section>
      <aside className="xd-side">
        {!notion ? <><h2>Suivre une notion</h2><p className="xd-hint">La notion se déplace d’une publication à l’autre. À chaque escale, ses éléments déjà validés apparaissent. Aucun nouveau rapprochement n’est créé : chaque élément reste relié à sa publication, sa page, son extrait et sa preuve.</p></> : <>
          <h2>{notion.label}</h2>
          <p className="xd-hint">Les dimensions de la notion s’allument au fil des escales.</p>
          <h3>Dimensions apparues</h3>
          <div className="xd-dims">{types.map(t => {
            const on = seen.counts[t] > 0, fresh = !done && seen.firstAt[t] === state.step && state.phase !== 'travel'
            return <div key={t} className={`xd-dim ${on ? 'on' : ''} ${fresh ? 'new' : ''}`} style={{ '--c': xdTypeVar(t) }}>
              <i/><span>{TYPE_LABELS[t] || t}{fresh && <em>nouvelle</em>}</span><b>{seen.counts[t] || ''}</b>
            </div>
          })}</div>
          <h3>Escales</h3>
          <div className="xd-stops">{stops.map((s, i) => <button key={s.id} type="button" className={`xd-stop ${done || i < seen.upto ? 'done' : ''} ${i === activeStop ? 'now' : ''}`} onClick={() => revisit(i)} disabled={!done}>
            <b>{i + 1}</b><span>{s.id} · {s.publication.titre}</span>
          </button>)}</div>
          {selectedNode && <div className="xd-detail" style={{ '--c': xdTypeVar(selectedNode.type_noeud) }}>
            <h3>Élément sélectionné</h3>
            <span className="xd-type">{TYPE_LABELS[selectedNode.type_noeud] || selectedNode.type_noeud}</span>
            <strong>{selectedNode.libelle}</strong>
            <dl><dt>Publication</dt><dd>{selectedStop?.id} · {selectedStop?.publication.titre}</dd><dt>Pages</dt><dd>{selectedNode.page_source || '—'}</dd><dt>Extraits</dt><dd>{selectedNode.chunk_id_source || '—'}</dd></dl>
            <h3>Preuve principale</h3>
            {proofChunks.length ? proofChunks.map(chunk => <article key={chunk.chunk_id} className="xd-proof">
              <header><b>{chunk.chunk_id}</b><span>{chunk.section || `p. ${chunk.page_debut || ''}`}</span></header><p>{chunk.texte}</p>
            </article>) : <p className="xd-hint">Aucun extrait source disponible dans les données chargées.</p>}
            {sourceUrl && <a className="xd-source" href={sourceUrl} target="_blank" rel="noreferrer"><Icon name="external" size={15}/>Ouvrir la source</a>}
          </div>}
        </>}
      </aside>
    </div>
  </main>
}

function XdChip({ node, width, from, to, back, selected, onClick }) {
  const [entered, setEntered] = useState(false)
  useEffect(() => { const r = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true))); return () => cancelAnimationFrame(r) }, [])
  const target = back ? { x: back.x - 20, y: back.y - 10 } : (entered ? to : { x: from.x - width / 2, y: from.y - 20 })
  return <button type="button" className={`xd-chip ${entered && !back ? '' : 'faded'} ${selected ? 'sel' : ''}`}
    style={{ left: target.x, top: target.y, width, '--c': xdTypeVar(node.type_noeud), transform: entered && !back ? 'none' : back ? 'scale(.15)' : 'scale(.4)' }}
    onClick={onClick}>
    <span className="xd-chip-type">{TYPE_LABELS[node.type_noeud] || node.type_noeud}</span>
    <span className="xd-chip-label">{node.libelle}</span>
  </button>
}

/* ==========================================================================
   CHRONOLOGIE — frise verticale lisible (version 2)
   Mêmes règles de restitution que la version précédente : seuls les repères
   « retenu » dotés d'une date sont placés ; les « non_positionnable » sont
   conservés à part, sans date inventée.
   ========================================================================== */
const XD_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const XD_SUBTYPES = { realisation_operationnelle: 'réalisation opérationnelle', institutionnel: 'institutionnel', reglementaire: 'réglementaire', structurant: 'structurant' }
const xdNatVar = nature => `var(--xd-n-${NAT_LABELS[nature] ? nature : 'evenement'})`
const xdCap = s => s ? s[0].toUpperCase() + s.slice(1) : s

function xdFormatDate(raw, precision) {
  const m = String(raw || '').match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/)
  if (!m) return String(raw || '')
  const [, y, mo, d] = m
  if (precision === 'jour' && d) return `${Number(d)} ${XD_MONTHS[Number(mo) - 1]} ${y}`
  if ((precision === 'mois' || precision === 'jour') && mo) return `${xdCap(XD_MONTHS[Number(mo) - 1])} ${y}`
  return y
}
function xdDateLabel(e) {
  const a = xdFormatDate(e.date_debut_normalisee, e.precision_temporelle)
  const b = e.date_fin_normalisee ? xdFormatDate(e.date_fin_normalisee, e.precision_temporelle) : ''
  if (e.statut_temporel === 'periode_ouverte') return { main: `Depuis ${a}`, sub: 'période ouverte' }
  if (e.statut_temporel === 'periode_fermee' && b && b !== a) return { main: a, sub: `→ ${b}` }
  return { main: a, sub: '' }
}
function XdHighlight({ text, expression }) {
  const t = String(text || ''), x = String(expression || '')
  const i = x ? t.toLowerCase().indexOf(x.toLowerCase()) : -1
  if (i < 0) return t
  return <>{t.slice(0, i)}<mark>{t.slice(i, i + x.length)}</mark>{t.slice(i + x.length)}</>
}

function ChronoFrise({ data, onBack }) {
  const { chronology, error } = useChronologyData(true)
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [publicationId, setPublicationId] = useState(ELIGIBLE_PUBLICATIONS[0])
  const [count, setCount] = useState(0)          // repères déjà placés (ordre du document)
  const [sub, setSub] = useState('idle')         // idle | show | place | done
  const [paused, setPaused] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [dimmed, setDimmed] = useState(() => new Set())
  const rowRefs = useRef({})
  const yearRefs = useRef({})

  const publications = useMemo(() => Object.fromEntries((data.publications || []).map(p => [p.publication_id, p])), [data.publications])
  const choices = useMemo(() => ELIGIBLE_PUBLICATIONS.filter(id => chronology?.elements.some(e => e.publication_id === id)).map(id => publications[id] || { publication_id: id, titre: id }), [chronology, publications])
  const elements = useMemo(() => chronology?.elements.filter(e => e.publication_id === publicationId) || [], [chronology, publicationId])
  const positionable = useMemo(() => elements.filter(e => e.decision_post_traitement === 'retenu' && temporalValue(e) !== null)
    .sort((a, b) => temporalValue(a) - temporalValue(b) || a.chrono_id.localeCompare(b.chrono_id)), [elements])
  const nonPositionable = useMemo(() => elements.filter(e => e.decision_post_traitement === 'non_positionnable'), [elements])
  const readingOrder = useMemo(() => [...positionable, ...nonPositionable].sort((a, b) => a.chrono_id.localeCompare(b.chrono_id)), [positionable, nonPositionable])
  const provenances = useMemo(() => {
    const map = {}; (chronology?.provenances || []).forEach(p => { if (p.publication_id === publicationId) (map[p.chrono_id] ||= []).push(p) }); return map
  }, [chronology, publicationId])
  const byYear = useMemo(() => {
    const map = new Map(); positionable.forEach(e => { const y = Math.floor(temporalValue(e)); if (!map.has(y)) map.set(y, []); map.get(y).push(e) }); return map
  }, [positionable])
  const natureCounts = useMemo(() => { const c = {}; elements.filter(e => e.decision_post_traitement === 'retenu' || e.decision_post_traitement === 'non_positionnable').forEach(e => { c[e.nature_chronologique] = (c[e.nature_chronologique] || 0) + 1 }); return c }, [elements])

  const total = readingOrder.length
  const placedIds = useMemo(() => new Set(readingOrder.slice(0, count + (sub === 'place' ? 1 : 0)).map(e => e.chrono_id)), [readingOrder, count, sub])
  const current = (sub === 'show' || sub === 'place') ? readingOrder[count] : null
  const allPlaced = sub === 'idle' || sub === 'done' ? (sub === 'done') : false
  const isPlaced = id => allPlaced || placedIds.has(id)

  // Moteur de l'animation : le texte d'abord, puis la frise. Respecte la pause.
  useEffect(() => {
    if (paused || (sub !== 'show' && sub !== 'place')) return
    const slow = count < 6
    const delay = reduceMotion ? 0 : sub === 'show' ? (slow ? 1400 : 600) : (slow ? 1300 : 550)
    const id = window.setTimeout(() => {
      if (sub === 'show') setSub('place')
      else if (count + 1 >= total) { setCount(total); setSub('done') }
      else { setCount(c => c + 1); setSub('show') }
    }, delay)
    return () => window.clearTimeout(id)
  }, [sub, count, paused, total, reduceMotion])

  useEffect(() => { if (sub === 'place' && current) rowRefs.current[current.chrono_id]?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' }) }, [sub, current, reduceMotion])

  const choose = id => { setPublicationId(id); setCount(0); setSub('idle'); setSelectedId(null); setPaused(false); setDimmed(new Set()) }
  const start = () => { setSelectedId(null); setCount(0); setPaused(false); setSub(total ? 'show' : 'done') }
  const overview = () => { setCount(total); setSub('done'); setPaused(false) }
  const toggleNature = n => setDimmed(d => { const x = new Set(d); x.has(n) ? x.delete(n) : x.add(n); return x })

  const pub = publications[publicationId]
  const sourceUrl = pub ? (cleanUrl(pub.url_source) || cleanUrl(pub.url_contenu)) : ''
  const focus = current || (selectedId ? elements.find(e => e.chrono_id === selectedId) : null)
  const yearBars = [...byYear.entries()].map(([y, list]) => {
    const shown = list.filter(e => isPlaced(e.chrono_id)), counts = {}
    shown.forEach(e => { counts[e.nature_chronologique] = (counts[e.nature_chronologique] || 0) + 1 })
    return { y, n: list.length, counts }
  })

  if (error) return <main className="xd-screen"><header className="xd-bar"><button type="button" className="xd-back" onClick={onBack}><Icon name="back" size={16}/>D’un document à l’autre</button></header><div className="xd-empty"><strong>Chronologie indisponible</strong><p>{error.message}</p></div></main>
  if (!chronology) return <main className="xd-screen"><header className="xd-bar"><button type="button" className="xd-back" onClick={onBack}><Icon name="back" size={16}/>D’un document à l’autre</button></header><div className="xd-empty"><strong>Chargement de la chronologie…</strong></div></main>

  const row = (e, undated = false) => {
    const prov = (provenances[e.chrono_id] || [])[0]
    const date = undated ? null : xdDateLabel(e)
    const period = e.statut_temporel === 'periode_fermee' ? 'period' : e.statut_temporel === 'periode_ouverte' ? 'open' : ''
    const placed = isPlaced(e.chrono_id)
    return <div key={e.chrono_id} ref={el => { rowRefs.current[e.chrono_id] = el }}
      className={`xd-row ${undated ? 'undated' : ''} ${period} ${placed ? '' : 'pending'} ${current?.chrono_id === e.chrono_id && sub === 'place' ? 'new' : ''} ${selectedId === e.chrono_id ? 'sel' : ''} ${dimmed.has(e.nature_chronologique) ? 'dim' : ''}`}
      style={{ '--c': xdNatVar(e.nature_chronologique) }} aria-hidden={!placed}>
      {!undated && <div className="xd-date">{date.main}{date.sub && <small>{date.sub}</small>}</div>}
      {!undated && <div className="xd-spine"><span/></div>}
      <button type="button" className="xd-card" onClick={() => setSelectedId(e.chrono_id)} tabIndex={placed ? 0 : -1}>
        <span className="xd-nat">{NAT_LABELS[e.nature_chronologique] || e.nature_chronologique}{e.sous_type && <em>{XD_SUBTYPES[e.sous_type] || e.sous_type.replace(/_/g, ' ')}</em>}{e.statut_connaissance === 'prospectif' && <span className="xd-pro">prospectif</span>}</span>
        <span className="xd-lib">{e.libelle}</span>
        <span className="xd-src"><q>{e.expression_temporelle_source}</q>{prov?.page_source ? ` · p. ${prov.page_source}` : ''}{prov?.section ? ` · ${prov.section}` : ''}</span>
      </button>
    </div>
  }

  return <main className="xd-screen xd-chrono">
    <header className="xd-bar">
      <button type="button" className="xd-back" onClick={onBack}><Icon name="back" size={16}/>D’un document à l’autre</button>
      <h1>Du texte à la frise</h1>
      <span className="xd-beta">Bêta</span>
      <span className="xd-spacer"/>
      <div className="xd-pubs">{choices.map(c => {
        const n = chronology.elements.filter(e => e.publication_id === c.publication_id).length
        return <button key={c.publication_id} type="button" className={`xd-pubbtn ${publicationId === c.publication_id ? 'on' : ''}`} onClick={() => choose(c.publication_id)} title={c.titre}>
          {c.has_image !== false ? <img src={publicationImageSrc(c.image_path, c.publication_id)} alt=""/> : <span className="xd-ph">{c.publication_id}</span>}
          <span><b>{c.publication_id} · {n} repères</b><span>{c.titre}</span></span>
        </button>
      })}</div>
      <div className="xd-actions">
        <button type="button" className="xd-btn primary" onClick={start}><Icon name="spark" size={15}/>{sub === 'idle' ? 'Transformer en frise' : 'Rejouer'}</button>
        <button type="button" className="xd-btn" onClick={() => setPaused(p => !p)} disabled={sub !== 'show' && sub !== 'place'} aria-pressed={paused}>{paused ? <>▶ Reprendre</> : <>❚❚ Pause</>}</button>
        <button type="button" className="xd-btn" onClick={overview} disabled={sub === 'done'}>Vue d’ensemble</button>
      </div>
    </header>
    <div className="xd-years" aria-label="Années de la frise">
      <span className="xd-years-label">Années</span>
      <div className="xd-years-track">{yearBars.map((b, i) => <React.Fragment key={b.y}>
        {i > 0 && b.y - yearBars[i - 1].y > 1 && <span className="xd-gap" title={`${yearBars[i - 1].y + 1}–${b.y - 1} : aucun repère`}>⋯</span>}
        <button type="button" className="xd-year-btn" style={{ width: Math.round(30 + Math.sqrt(b.n) * 9) }} title={`${b.y} : ${b.n} repère${b.n > 1 ? 's' : ''}`} onClick={() => yearRefs.current[b.y]?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>
          <span className="xd-year-bar">{Object.entries(b.counts).map(([n, c]) => <i key={n} style={{ background: xdNatVar(n), height: `${100 * c / b.n}%` }}/>)}</span>
          <small>{b.y}</small>
        </button>
      </React.Fragment>)}</div>
    </div>
    <div className="xd-body">
      <section className="xd-frise">
        <div className="xd-legend">{Object.keys(NAT_LABELS).filter(n => natureCounts[n]).map(n => <button key={n} type="button" className={`xd-lg ${dimmed.has(n) ? 'off' : ''}`} style={{ '--c': xdNatVar(n) }} onClick={() => toggleNature(n)} aria-pressed={!dimmed.has(n)}>
          <i/>{NAT_LABELS[n]}<b>{natureCounts[n]}</b>
        </button>)}</div>
        {[...byYear.entries()].map(([y, list]) => {
          const shown = list.filter(e => isPlaced(e.chrono_id)).length
          return <React.Fragment key={y}>
            <div className={`xd-yearhead ${shown ? '' : 'empty'}`} ref={el => { yearRefs.current[y] = el }}><h2>{y}</h2><span>{list.length} repère{list.length > 1 ? 's' : ''}</span></div>
            {list.map(e => row(e))}
          </React.Fragment>
        })}
        {nonPositionable.length > 0 && <div className="xd-undated">
          <h3>Sans date positionnable ({nonPositionable.length})</h3>
          <p>Repères conservés tels quels : le texte ne permet pas de les placer précisément dans le temps. Aucune date n’est inventée.</p>
          {nonPositionable.map(e => row(e, true))}
        </div>}
      </section>
      <aside className="xd-side">
        {pub && <div className="xd-pubmini">
          {pub.has_image !== false ? <img src={publicationImageSrc(pub.image_path, pub.publication_id)} alt=""/> : <span className="xd-ph">{pub.publication_id}</span>}
          <div><b>{pub.publication_id} · {pub['année_publication']} · {pub.type_document}</b><strong>{pub.titre}</strong></div>
        </div>}
        {!focus && <>
          <h2>{sub === 'done' ? 'Frise complète' : 'Texte source'}</h2>
          <p className="xd-hint">{sub === 'done'
            ? `${total} repères validés, dont ${nonPositionable.length} sans date positionnable. Cliquez sur un repère pour retrouver son passage source.`
            : 'Lancez « Transformer en frise » : chaque repère apparaît d’abord dans son passage source, surligné, puis rejoint sa place dans le temps. Vous pouvez mettre en pause à tout moment.'}</p>
          <div className="xd-rule"><Icon name="info" size={16}/><span><b>Restitution déterministe</b> — aucune interprétation n’est effectuée pendant la consultation. La frise restitue uniquement les données chronologiques validées.</span></div>
        </>}
        {focus && <>
          {current && <div className="xd-progress"><i style={{ width: `${100 * (count + 1) / total}%` }}/></div>}
          <h2>{current ? 'Repère trouvé dans le texte' : 'Passage source'}</h2>
          <p className="xd-hint">{current ? `Repère ${count + 1} sur ${total}. L’expression surlignée devient une date sur la frise.` : 'Le repère et la preuve dont il est tiré.'}</p>
          {(provenances[focus.chrono_id] || []).map(p => <article key={p.provenance_id || p.chunk_id} className={`xd-passage ${current ? 'live' : ''}`}>
            <header><span>{p.section || 'Extrait'}</span><span>{p.page_source ? `p. ${p.page_source} · ` : ''}{p.chunk_id}</span></header>
            <p><XdHighlight text={p.preuve} expression={p.expression_temporelle_source || focus.expression_temporelle_source}/></p>
          </article>)}
          <div className="xd-arrow">↓ {focus.decision_post_traitement === 'retenu' && temporalValue(focus) !== null ? `placé en ${xdDateLabel(focus).main}${xdDateLabel(focus).sub ? ' ' + xdDateLabel(focus).sub : ''}` : 'conservé sans date positionnable'}</div>
          <div className="xd-card static" style={{ '--c': xdNatVar(focus.nature_chronologique) }}><span className="xd-nat">{NAT_LABELS[focus.nature_chronologique]}</span><span className="xd-lib">{focus.libelle}</span></div>
          <dl className="xd-kv"><dt>Précision</dt><dd>{({ annee: 'année', periode: 'période' })[focus.precision_temporelle] || focus.precision_temporelle || '—'}</dd><dt>Confiance</dt><dd>{focus.niveau_confiance || '—'}</dd></dl>
          {sourceUrl && <a className="xd-source" href={sourceUrl} target="_blank" rel="noreferrer"><Icon name="external" size={15}/>Voir le document source</a>}
        </>}
      </aside>
    </div>
  </main>
}
