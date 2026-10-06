import React, { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { useChronologyData } from '../hooks/useChronologyData.js'
import './cross-documents.css'

const ELIGIBLE_PUBLICATIONS = ['PUB006', 'PUB012']


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

function cleanUrl(value = '') {
  const first = String(value || '').split(/\s+/).find(x => /^https?:\/\//i.test(x))
  return first || ''
}

function temporalValueFromNormalized(rawValue = '') {
  const raw = String(rawValue || '')
  const match = raw.match(/(18|19|20|21)\d{2}/)
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

function CrossDocumentsHome({ onOpenChronology, onOpenNotions, publicationCount }) {
  return <main className="page crossdoc-home">
    <header className="crossdoc-heading">
      <div className="crossdoc-kicker">EXPLORATIONS TRANSPUBLICATIONS</div>
      <h1>D’un document à l’autre</h1>
      <p>Changez de point de vue sur le corpus tout en conservant un retour direct aux documents et à leurs preuves sources.</p>
    </header>

    <section className="crossdoc-card-grid" aria-label="Fonctions disponibles">
      <button className="crossdoc-feature-card chronology-card" type="button" onClick={onOpenChronology}>
        <div className="crossdoc-feature-visual" aria-hidden="true">
          <div className="mini-source-lines"><span></span><span></span><span></span><span></span></div>
          <div className="mini-transfer"><i></i><i></i><i></i></div>
          <div className="mini-timeline"><b></b><b></b><b></b><b></b></div>
        </div>
        <div className="crossdoc-feature-copy">
          <div className="crossdoc-feature-topline">
            <span>CHRONOLOGIE</span>
            <em className="crossdoc-beta">BÊTA · {publicationCount || 0} publications</em>
          </div>
          <h2>Du texte à la frise, sans perdre la source</h2>
          <p>Faites apparaître la trame temporelle d’une publication : événements, jalons, émergences, tendances et inflexions sont replacés dans le temps et reliés à leur preuve source.</p>
          <div className="crossdoc-feature-action">Explorer une chronologie <Icon name="chevron" size={17}/></div>
        </div>
      </button>

      <button className="crossdoc-feature-card notion-feature-card" type="button" onClick={onOpenNotions}>
        <div className="crossdoc-feature-visual notion-mini-visual" aria-hidden="true">
          <div className="notion-mini-library"><span></span><span></span><span></span><span></span></div>
          <div className="notion-mini-flow"><i></i><i></i><i></i></div>
          <div className="notion-mini-center">N</div>
        </div>
        <div className="crossdoc-feature-copy">
          <div className="crossdoc-feature-topline"><span>VUE TRANSVERSALE</span><em className="crossdoc-beta">4 notions</em></div>
          <h2>Suivre une notion</h2>
          <p className="notion-home-explanation">Partez des publications du corpus, choisissez une notion, puis regardez les éléments déjà validés se détacher de leurs documents d’origine et se recomposer en un parcours transversal. Aucun nouveau rapprochement n’est créé : chaque nœud reste relié à sa publication, sa page, son chunk et sa preuve.</p>
          <div className="crossdoc-feature-action">Voir le corpus se transformer <Icon name="chevron" size={17}/></div>
        </div>
      </button>
    </section>
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
    const preferred = ['PUB005','PUB006','PUB007','PUB008','PUB014','PUB015','PUB024','PUB025','PUB031','PUB033','PUB057','PUB090']
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
    if (!selectedNodeId || !activeNodes.length) return null
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

  const circularPositions = useMemo(
    () => buildCircularJourneyPositions(publicationJourney.length),
    [publicationJourney.length]
  )

  const activePublicationPosition = circularPositions[activePublicationIndex] || { x: 50, y: 50, angle: -90 }
  const zone = journeyZone(activePublicationPosition)

  const activeCorePosition = useMemo(() => {
    const dx = 50 - activePublicationPosition.x
    const dy = 50 - activePublicationPosition.y
    const length = Math.hypot(dx, dy) || 1
    const distance = 22
    return {
      x: activePublicationPosition.x + ((dx / length) * distance),
      y: activePublicationPosition.y + ((dy / length) * distance),
    }
  }, [activePublicationPosition])

  const contributionOffsets = useMemo(
    () => buildLocalContributionOffsets(activeNodes.length, zone),
    [activeNodes.length, zone]
  )

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
    const passingTimer = window.setTimeout(() => setPhase('passing'), 700)
    const finalTimer = window.setTimeout(() => setPhase('final'), 2200)
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
    }, 4200)
    return () => window.clearInterval(timer)
  }, [phase, publicationJourney, isPaused])

  return <main className="page notion-workspace">
    <button className="chrono-return" type="button" onClick={onBack}><Icon name="back" size={15}/> D’un document à l’autre</button>

    <header className="notion-hero">
      <div className="crossdoc-kicker">D’UN DOCUMENT À L’AUTRE</div>
      <div className="notion-title-row">
        <h1>Suivre une notion</h1>
        <span className="crossdoc-beta notion-beta-inline">BÊTA</span>
      </div>
      <div className="notion-purpose">
        <div className="notion-purpose-icon"><Icon name="layers" size={31}/></div>
        <div>
          <strong>Suivre une même notion d’une publication à l’autre.</strong>
          <p>La notion circule entre les publications qui la documentent. À chaque étape, seule la publication active est mise en évidence ; autour d’elle apparaissent les éléments validés qui montrent ce que ce document apporte à la notion.</p>
        </div>
      </div>
    </header>

    <section className="notion-selector" aria-label="Choisir une notion transversale">
      <div className="notion-selector-title"><span>1</span><div><strong>Choisissez la notion à suivre</strong><small>Quatre notions transversales ont été préparées à partir de rattachements fixes.</small></div></div>
      <div className="notion-choice-grid">
        {TRANSVERSAL_NOTIONS.map(notion => {
          const publicationCount = Object.keys(notion.selections).length
          const elementCount = Object.values(notion.selections).reduce((sum, ids) => sum + ids.length, 0)
          return <button key={notion.id} type="button" className={`notion-choice-card ${selectedNotionId === notion.id ? 'selected' : ''}`} onClick={() => chooseNotion(notion.id)} style={{'--notion-accent': notion.accent}}>
            <span className="notion-choice-icon"><Icon name={notion.icon} size={26}/></span>
            <strong>{notion.label}</strong>
            <small>{publicationCount} publication{publicationCount > 1 ? 's' : ''} · {elementCount} éléments validés</small>
          </button>
        })}
      </div>
    </section>

    <section className={`notion-passage-stage phase-${phase}`}>
      <div className="notion-stage-heading">
        <div className="notion-selector-title"><span>2</span><div><strong>{!selectedNotion ? 'Le corpus dans sa forme documentaire' : phase === 'final' ? 'La notion se déplace entre les publications' : 'Le passage est en cours'}</strong><small>{!selectedNotion ? 'Les documents restent autonomes tant qu’aucune notion n’est choisie.' : 'La publication active se distingue nettement et le détail n’apparaît qu’au clic sur un élément.'}</small></div></div>
        {selectedNotion && <button type="button" className="notion-reset" onClick={resetNotion}><Icon name="reset" size={15}/> Revenir au corpus</button>}
      </div>

      {selectedNotion && phase === 'final' ? <div className={`notion-journey-shell ${selectedNode ? 'detail-open' : 'detail-closed'}`}>
        <div className="notion-journey-topbar">
          <div className="notion-journey-topbar-buttons">
            <button type="button" className="notion-motion-button primary" onClick={() => setIsPaused(true)} disabled={isPaused}><span className="notion-motion-glyph">❚❚</span> Arrêter l’animation</button>
            <button type="button" className="notion-motion-button" onClick={() => setIsPaused(false)} disabled={!isPaused}><span className="notion-motion-glyph">▶</span> Reprendre</button>
          </div>
        </div>

        <div className="notion-circular-layout">
          <div className="notion-journey-scene" style={{ '--notion-accent': selectedNotion.accent }}>
            <div className="notion-journey-ring main" aria-hidden="true"></div>
            <div className="notion-journey-ring secondary" aria-hidden="true"></div>
            <div className="notion-journey-ring tertiary" aria-hidden="true"></div>

            {publicationJourney.map((item, index) => {
              const position = circularPositions[index] || { x: 50, y: 50 }
              const isActive = item.publicationId === activePublication?.publicationId
              return <button
                key={item.publicationId}
                type="button"
                className={`notion-orbit-publication ${isActive ? 'active' : ''}`}
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
                onClick={() => selectPublication(item.publicationId)}
                title={item.publication?.titre || item.publicationId}
              >
                <img src={publicationImageSrc(item.publication?.image_path, item.publicationId)} alt=""/>
                <div>
                  <small>{item.publicationId}</small>
                  <strong>{item.publication?.titre || item.publicationId}</strong>
                  <span>{formatPublicationDate(item.publication)}</span>
                </div>
                {isActive && <b className="notion-active-badge">{activePublicationIndex + 1}</b>}
              </button>
            })}

            <div className="notion-core-connector" style={{ left: `${activeCorePosition.x}%`, top: `${activeCorePosition.y}%` }} aria-hidden="true"></div>

            <div className="notion-travel-core" style={{ left: `${activeCorePosition.x}%`, top: `${activeCorePosition.y}%`, '--notion-accent': selectedNotion.accent }}>
              <Icon name={selectedNotion.icon} size={28}/>
              <strong>{selectedNotion.label}</strong>
              <span>{activePublicationIndex + 1} / {publicationJourney.length}</span>
            </div>

            <div className="notion-contribution-cloud" aria-label="Ce que ce document apporte à la notion">
              {activeNodes.map((node, index) => {
                const offset = contributionOffsets[index] || { x: 0, y: 0 }
                return <button
                  key={node.node_id}
                  type="button"
                  className={`notion-contribution-bubble ${selectedNode?.node_id === node.node_id ? 'selected' : ''}`}
                  onClick={() => chooseNode(node.node_id)}
                  title={node.libelle}
                  style={{
                    left: `calc(${activeCorePosition.x}% + ${offset.x}px)`,
                    top: `calc(${activeCorePosition.y}% + ${offset.y}px)`,
                    '--notion-accent': selectedNotion.accent,
                    '--bubble-index': index,
                  }}
                >
                  <span>{node.libelle}</span>
                </button>
              })}
            </div>
          </div>

          {!selectedNode && <div className="notion-detail-closed-tab" aria-hidden="true"><span>‹</span><b>Détail</b></div>}

          {selectedNode && <aside className="notion-journey-panel">
            <div className="notion-journey-panel-block">
              <div className="notion-panel-title">Publication et preuve</div>
              {activePublication && <div className="notion-panel-publication-card">
                <img src={publicationImageSrc(activePublication.publication?.image_path, activePublication.publicationId)} alt=""/>
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
      </div> : <div className="notion-stage-canvas">
        {phase !== 'final' && <div className="notion-library">
          {visibleLibrary.map((publication, index) => {
            const relevant = selectedPublicationIds.includes(publication.publication_id)
            const ids = selectedNotion?.selections[publication.publication_id] || []
            return <article key={publication.publication_id} className={`notion-source-card ${selectedNotion ? (relevant ? 'relevant' : 'dimmed') : ''}`} style={{'--source-index': index}}>
              <img src={publicationImageSrc(publication.image_path, publication.publication_id)} alt=""/>
              <div><small>{publication.publication_id}</small><strong>{publication.titre}</strong><span>{publication.organisme_producteur || publication.type_document}</span></div>
              {relevant && <b className="notion-source-count">{ids.length}</b>}
            </article>
          })}
        </div>}

        {selectedNotion && phase !== 'final' && <div className="notion-flow-layer" aria-hidden="true">
          {selectedPublicationIds.map((publicationId, pubIndex) => {
            const libraryIndex = Math.max(0, visibleLibrary.findIndex(p => p.publication_id === publicationId))
            const column = libraryIndex % 4
            const row = Math.floor(libraryIndex / 4)
            return (selectedNotion.selections[publicationId] || []).slice(0, 6).map((nodeId, nodeIndex) => {
              const node = nodesById[nodeId]
              const left = 6 + (column * 24) + ((nodeIndex % 2) * 2.2)
              const top = 15 + (row * 23) + (nodeIndex * 2.4)
              return <span
                key={nodeId}
                className="notion-flow-chip"
                style={{
                  left: `${left}%`,
                  top: `${Math.min(83, top)}%`,
                  animationDelay: `${(pubIndex * 110) + (nodeIndex * 75)}ms`,
                  '--flow-color': selectedNotion.accent,
                }}
              >{node?.libelle || nodeId}</span>
            })
          })}
        </div>}

        {selectedNotion && phase !== 'final' && <div className="notion-center" style={{'--notion-accent': selectedNotion.accent}}>
          <Icon name={selectedNotion.icon} size={28}/><strong>{selectedNotion.label}</strong><span>{selectedPublicationIds.length} publication{selectedPublicationIds.length > 1 ? 's' : ''} concernée{selectedPublicationIds.length > 1 ? 's' : ''}</span>
        </div>}

        {selectedNotion && phase !== 'final' && <div className="notion-passage-status">
          {phase === 'filtering'
            ? <><b>1. Le corpus se filtre</b><span>Les publications qui documentent « {selectedNotion.label} » restent au premier plan.</span></>
            : <><b>2. La notion se met en mouvement</b><span>Les publications concernées restent visibles pendant que la notion se prépare à circuler d’un document à l’autre.</span></>}
        </div>}
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
            <img src={choice.image_path || `./images/publications/${choice.publication_id}.png`} alt=""/>
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
  const { chronology } = useChronologyData(true)
  const publicationCount = chronology
    ? new Set(chronology.elements.map(e => e.publication_id)).size
    : 0

  if (view === 'chronology') return <ChronologyWorkspace data={data} onBack={() => setView('home')} />
  if (view === 'notions') return <NotionWorkspace data={data} onBack={() => setView('home')} />
  return <CrossDocumentsHome
    publicationCount={publicationCount}
    onOpenChronology={() => setView('chronology')}
    onOpenNotions={() => setView('notions')}
  />
}
