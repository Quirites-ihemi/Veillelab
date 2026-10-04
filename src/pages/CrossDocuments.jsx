import React, { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { useChronologyData } from '../hooks/useChronologyData.js'
import './cross-documents.css'

const ELIGIBLE_PUBLICATIONS = ['PUB006', 'PUB012']

const NAT_LABELS = {
  evenement: 'Événement',
  jalon: 'Jalon',
  emergence: 'Émergence',
  tendance: 'Tendance',
  rupture_inflexion: 'Rupture / inflexion',
  sequence_historique: 'Séquence historique',
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

function CrossDocumentsHome({ onOpenChronology, publicationCount }) {
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
  return <CrossDocumentsHome publicationCount={publicationCount} onOpenChronology={() => setView('chronology')} />
}
