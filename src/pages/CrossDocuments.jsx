import React, { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { useChronologyData } from '../hooks/useChronologyData.js'
import './cross-documents.css'

const NAT_LABELS = {
  evenement: 'Événement',
  jalon: 'Jalon',
  emergence: 'Émergence',
  tendance: 'Tendance',
  rupture_inflexion: 'Rupture / inflexion',
  sequence_historique: 'Séquence historique',
}

const NAT_ORDER = ['evenement', 'jalon', 'emergence', 'tendance', 'rupture_inflexion', 'sequence_historique']

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .toLowerCase()
}

function cleanUrl(value = '') {
  const first = String(value || '').split(/\s+/).find(x => /^https?:\/\//i.test(x))
  return first || ''
}

function yearFromNormalized(value = '') {
  const m = String(value || '').match(/(18|19|20|21)\d{2}/)
  return m ? Number(m[0]) : null
}

function temporalValueFromNormalized(rawValue = '') {
  const raw = String(rawValue || '')
  const y = yearFromNormalized(raw)
  if (!y) return null
  const month = Number((raw.match(/^\d{4}-(\d{2})/) || [])[1] || 1)
  const day = Number((raw.match(/^\d{4}-\d{2}-(\d{2})/) || [])[1] || 1)
  return y + ((month - 1) / 12) + ((day - 1) / 365)
}

function temporalValue(element) {
  return temporalValueFromNormalized(element.date_debut_normalisee)
}

function rangeYears(elements) {
  const vals = elements.map(temporalValue).filter(v => v !== null)
  if (!vals.length) return { min: 0, max: 1 }
  let min = Math.floor(Math.min(...vals))
  let max = Math.ceil(Math.max(...vals))
  if (min === max) { min -= 1; max += 1 }
  return { min, max }
}

function sourcePassageKey(prov) {
  return `${prov.publication_id || ''}:${prov.chunk_id || ''}`
}

function markRanges(text, needles, activeNeedle = '') {
  if (!text || !needles.length) return [{ text, kind: '' }]
  const source = String(text)
  const normalized = normalizeText(source)
  const matches = []

  needles.forEach((needle, idx) => {
    const n = normalizeText(needle)
    if (!n || n.length < 2) return
    let start = 0
    while (start < normalized.length) {
      const at = normalized.indexOf(n, start)
      if (at < 0) break
      matches.push({ start: at, end: at + n.length, needle, active: normalizeText(needle) === normalizeText(activeNeedle), idx })
      start = at + Math.max(1, n.length)
    }
  })

  if (!matches.length) return [{ text: source, kind: '' }]
  matches.sort((a, b) => a.start - b.start || b.end - a.end)
  const kept = []
  for (const m of matches) {
    const prev = kept[kept.length - 1]
    if (prev && m.start < prev.end) {
      if (m.active && !prev.active) kept[kept.length - 1] = m
      continue
    }
    kept.push(m)
  }

  const parts = []
  let pos = 0
  kept.forEach((m) => {
    if (m.start > pos) parts.push({ text: source.slice(pos, m.start), kind: '' })
    parts.push({ text: source.slice(m.start, m.end), kind: m.active ? 'active' : 'mark' })
    pos = m.end
  })
  if (pos < source.length) parts.push({ text: source.slice(pos), kind: '' })
  return parts
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
  const [publicationId, setPublicationId] = useState('PUB012')
  const [nature, setNature] = useState('all')
  const [knowledge, setKnowledge] = useState('all')
  const [phase, setPhase] = useState('ready')
  const [revealed, setRevealed] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const passageRefs = useRef({})

  const publications = useMemo(() => Object.fromEntries((data.publications || []).map(p => [p.publication_id, p])), [data.publications])
  const contents = useMemo(() => Object.fromEntries((data.contents || []).map(c => [c.chunk_id, c])), [data.contents])

  const chronoPublications = useMemo(() => {
    if (!chronology) return []
    return [...new Set(chronology.elements.map(e => e.publication_id))]
      .map(id => publications[id] || { publication_id: id, titre: id })
      .sort((a, b) => String(a.publication_id).localeCompare(String(b.publication_id)))
  }, [chronology, publications])

  const allElements = useMemo(() => chronology?.elements.filter(e => e.publication_id === publicationId) || [], [chronology, publicationId])
  const filteredElements = useMemo(() => allElements.filter(e => {
    if (nature !== 'all' && e.nature_chronologique !== nature) return false
    if (knowledge !== 'all' && e.statut_connaissance !== knowledge) return false
    return true
  }), [allElements, nature, knowledge])

  const positionable = useMemo(() => filteredElements
    .filter(e => e.decision_post_traitement === 'retenu' && temporalValue(e) !== null)
    .sort((a, b) => temporalValue(a) - temporalValue(b) || a.chrono_id.localeCompare(b.chrono_id)), [filteredElements])

  const nonPositionable = useMemo(() => filteredElements.filter(e => e.decision_post_traitement === 'non_positionnable'), [filteredElements])
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
    const map = new Map()
    filteredElements.forEach(e => {
      ;(provenancesByElement[e.chrono_id] || []).forEach(p => {
        const key = sourcePassageKey(p)
        const chunk = contents[p.chunk_id]
        if (!chunk || map.has(key)) return
        map.set(key, {
          key,
          chunk,
          expressions: [],
          elementIds: [],
        })
      })
    })
    filteredElements.forEach(e => {
      ;(provenancesByElement[e.chrono_id] || []).forEach(p => {
        const item = map.get(sourcePassageKey(p))
        if (!item) return
        const expression = p.expression_temporelle_source || e.expression_temporelle_source
        if (expression && !item.expressions.includes(expression)) item.expressions.push(expression)
        if (!item.elementIds.includes(e.chrono_id)) item.elementIds.push(e.chrono_id)
      })
    })
    return [...map.values()].sort((a, b) => Number(a.chunk.ordre || 0) - Number(b.chunk.ordre || 0))
  }, [filteredElements, provenancesByElement, contents])

  const visibleElements = useMemo(() => {
    if (phase === 'complete') return transformSequence
    if (phase === 'building') return transformSequence.slice(0, revealed)
    return []
  }, [phase, transformSequence, revealed])

  const visibleIds = useMemo(() => new Set(visibleElements.map(e => e.chrono_id)), [visibleElements])
  const currentElement = phase === 'building' ? transformSequence[Math.min(revealed, transformSequence.length - 1)] : null
  const selected = selectedId ? allElements.find(e => e.chrono_id === selectedId) : null
  const selectedProvs = selected ? provenancesByElement[selected.chrono_id] || [] : []

  useEffect(() => {
    setPhase('ready')
    setRevealed(0)
    setSelectedId(null)
  }, [publicationId, nature, knowledge])

  useEffect(() => {
    if (phase !== 'building') return
    if (!transformSequence.length) {
      setPhase('complete')
      return
    }
    if (revealed >= transformSequence.length) {
      const done = window.setTimeout(() => setPhase('complete'), 450)
      return () => window.clearTimeout(done)
    }
    const delay = transformSequence.length <= 8 ? 760 : transformSequence.length <= 25 ? 310 : 95
    const timer = window.setTimeout(() => setRevealed(v => v + 1), delay)
    return () => window.clearTimeout(timer)
  }, [phase, revealed, transformSequence.length])

  useEffect(() => {
    if (!selectedProvs.length) return
    const key = sourcePassageKey(selectedProvs[0])
    const node = passageRefs.current[key]
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [selectedId])

  if (error) return <main className="page chronology-workspace"><button className="back-link" onClick={onBack}><Icon name="back"/>Retour</button><div className="chrono-error"><strong>Chronologie indisponible</strong><p>{error.message}</p></div></main>
  if (!chronology) return <main className="page chronology-workspace"><button className="back-link" onClick={onBack}><Icon name="back"/>Retour</button><div className="chrono-loading"><div className="loader"></div><span>Chargement de la chronologie…</span></div></main>

  const pub = publications[publicationId] || { publication_id: publicationId, titre: publicationId }
  const total = transformSequence.length
  const progress = total ? Math.round((Math.min(revealed, total) / total) * 100) : 100
  const range = rangeYears(positionable)
  const timelineWidth = Math.max(1180, Math.min(9600, positionable.length * 150))
  const tickStep = Math.max(1, Math.ceil((range.max - range.min) / 8))
  const ticks = []
  for (let y = range.min; y <= range.max; y += tickStep) ticks.push(y)
  if (ticks[ticks.length - 1] !== range.max) ticks.push(range.max)

  const startTransform = () => {
    setSelectedId(null)
    setRevealed(0)
    setPhase('building')
  }

  const chooseElement = (e) => {
    setSelectedId(e.chrono_id)
  }

  const sourceUrl = cleanUrl(pub.url_source) || cleanUrl(pub.url_contenu)

  return <main className="page chronology-workspace">
    <div className="chrono-topline">
      <button className="back-link chrono-back" onClick={onBack}><Icon name="back"/>D’un document à l’autre</button>
      <span className="chrono-version">Chronologie · Bêta · restitution déterministe</span>
    </div>

    <header className="chrono-heading">
      <div>
        <div className="crossdoc-kicker">TRANSFORMATION DOCUMENTAIRE</div>
        <div className="chrono-title-row"><h1>Chronologie</h1><span className="chrono-beta-badge">BÊTA</span></div>
        <p>Du texte à la frise, sans perdre la source.</p>
      </div>
      <div className="chrono-legend" aria-label="Légende">
        <span><i className="dot observed"></i>Observé</span>
        <span><i className="diamond prospective"></i>Prospectif</span>
        <span><i className="dash unpositionable"></i>Non positionnable</span>
      </div>
    </header>


    <section className="chrono-intro" aria-label="Présentation de la fonction Chronologie">
      <div>
        <strong>Explorer la dimension temporelle d’une publication</strong>
        <p>Les repères chronologiques identifiés dans le document sont organisés dans une frise interactive et restent reliés à leur preuve source.</p>
      </div>
      <div>
        <strong>Une restitution entièrement déterministe</strong>
        <p>Aucune interprétation n’est réalisée au moment de la consultation. Les repères insuffisamment précis sont conservés hors de l’axe plutôt que datés artificiellement.</p>
      </div>
      <div className="chrono-intro-beta">
        <strong>Version Bêta</strong>
        <p>La fonction est actuellement disponible pour deux publications validées. Son périmètre sera étendu progressivement.</p>
      </div>
    </section>

    <section className="chrono-controls">
      <label>
        <span>Document</span>
        <select value={publicationId} onChange={e => setPublicationId(e.target.value)}>
          {chronoPublications.map(p => <option key={p.publication_id} value={p.publication_id}>{p.publication_id} — {p.titre}</option>)}
        </select>
      </label>
      <label>
        <span>Nature</span>
        <select value={nature} onChange={e => setNature(e.target.value)}>
          <option value="all">Toutes les natures</option>
          {NAT_ORDER.filter(n => allElements.some(e => e.nature_chronologique === n)).map(n => <option key={n} value={n}>{NAT_LABELS[n]}</option>)}
        </select>
      </label>
      <label>
        <span>Statut</span>
        <select value={knowledge} onChange={e => setKnowledge(e.target.value)}>
          <option value="all">Observé + prospectif</option>
          <option value="observe">Observé</option>
          <option value="prospectif">Prospectif</option>
        </select>
      </label>
      <div className="chrono-counts">
        <strong>{positionable.length}</strong><span>positionnables</span>
        <strong>{nonPositionable.length}</strong><span>non positionnables</span>
      </div>
    </section>

    <section className="chrono-publication-strip">
      <div>
        <strong>{publicationId}</strong>
        <h2>{pub.titre}</h2>
        <p>{[pub.organisme_producteur, pub.année_publication, pub.type_document].filter(Boolean).join(' · ')}</p>
      </div>
      {sourceUrl && <a className="chrono-source-link" href={sourceUrl} target="_blank" rel="noreferrer"><Icon name="external" size={15}/>Voir le document source</a>}
    </section>

    <section className="chrono-transform-layout">
      <div className="chrono-source-panel">
        <div className="chrono-panel-head">
          <div><span>1</span><strong>Le texte reste premier</strong></div>
          <small>{passages.length} passage{passages.length > 1 ? 's' : ''} porteur{passages.length > 1 ? 's' : ''} d’un repère temporel</small>
        </div>
        <div className="chrono-passages">
          {passages.map(item => {
            const activeExpression = currentElement && item.elementIds.includes(currentElement.chrono_id)
              ? ((provenancesByElement[currentElement.chrono_id] || []).find(p => p.chunk_id === item.chunk.chunk_id)?.expression_temporelle_source || currentElement.expression_temporelle_source)
              : (selected && item.elementIds.includes(selected.chrono_id)
                ? ((provenancesByElement[selected.chrono_id] || []).find(p => p.chunk_id === item.chunk.chunk_id)?.expression_temporelle_source || selected.expression_temporelle_source)
                : '')
            const isActive = Boolean(activeExpression)
            const parts = markRanges(item.chunk.texte, item.expressions, activeExpression)
            return <article
              key={item.key}
              ref={node => { passageRefs.current[item.key] = node }}
              className={`chrono-passage ${isActive ? 'active' : ''}`}
            >
              <header><span>Page {item.chunk.page_debut}{item.chunk.page_fin && item.chunk.page_fin !== item.chunk.page_debut ? `–${item.chunk.page_fin}` : ''}</span><b>{item.chunk.section}</b><em>{item.chunk.chunk_id}</em></header>
              <p>{parts.map((part, idx) => part.kind ? <mark key={idx} className={part.kind === 'active' ? 'active-mark' : ''}>{part.text}</mark> : <React.Fragment key={idx}>{part.text}</React.Fragment>)}</p>
            </article>
          })}
        </div>
      </div>

      <div className="chrono-visual-panel">
        <div className="chrono-panel-head">
          <div><span>2</span><strong>Transformation en frise</strong></div>
          {phase === 'ready' && <small>La frise n’est pas encore construite</small>}
          {phase === 'building' && <small>Transformation {Math.min(revealed, total)} / {total}</small>}
          {phase === 'complete' && <small>Transformation terminée</small>}
        </div>

        {phase === 'ready' && <div className="chrono-start-state">
          <div className="chrono-start-glyph" aria-hidden="true"><span></span><span></span><span></span><i></i></div>
          <h3>Le document contient {total} repère{total > 1 ? 's' : ''} temporel{total > 1 ? 's' : ''} dans ce filtre.</h3>
          <p>Déclenchez la transformation : les marqueurs du texte vont apparaître progressivement sur la frise. Les formulations imprécises resteront volontairement hors de l’axe.</p>
          <button type="button" className="chrono-transform-button" onClick={startTransform} disabled={!total}><Icon name="spark" size={18}/>Transformer en chronologie</button>
        </div>}

        {phase !== 'ready' && <>
          <div className="chrono-progress"><span style={{ width: `${phase === 'complete' ? 100 : progress}%` }}></span></div>
          <div className="chrono-timeline-scroll">
            <div className="chrono-timeline" style={{ width: timelineWidth }}>
              <div className="chrono-axis"></div>
              {ticks.map(y => {
                const left = ((y - range.min) / (range.max - range.min)) * 100
                return <div key={y} className="chrono-tick" style={{ left: `${left}%` }}><span>{y}</span></div>
              })}
              {positionable.map((e, idx) => {
                const val = temporalValue(e)
                const left = ((val - range.min) / (range.max - range.min)) * 100
                const lane = idx % 6
                const visible = visibleIds.has(e.chrono_id)
                const endVal = temporalValueFromNormalized(e.date_fin_normalisee)
                const isClosedPeriod = e.statut_temporel === 'periode_fermee' && endVal !== null && endVal > val
                const isOpenPeriod = e.statut_temporel === 'periode_ouverte'
                const availableYears = Math.max(1, range.max - range.min)
                const spanYears = isClosedPeriod
                  ? Math.max(0, endVal - val)
                  : (isOpenPeriod ? Math.max(0, range.max - val) : 0)
                const spanPx = spanYears
                  ? Math.max(20, (spanYears / availableYears) * Math.max(1000, timelineWidth - 80))
                  : 0
                const periodClass = isClosedPeriod ? 'period closed-period' : (isOpenPeriod ? 'period open-period' : 'point')
                return <button
                  key={e.chrono_id}
                  type="button"
                  className={`chrono-event ${periodClass} ${visible ? 'visible' : ''} ${e.statut_connaissance === 'prospectif' ? 'prospective' : 'observed'} ${selectedId === e.chrono_id ? 'selected' : ''}`}
                  style={{ left: `${left}%`, top: `${73 + lane * 78}px` }}
                  onClick={() => chooseElement(e)}
                  disabled={!visible}
                  title={e.libelle}
                >
                  {spanPx > 0 && <span className="chrono-period-track" style={{ width: `${spanPx}px` }} aria-hidden="true"></span>}
                  <i></i>
                  <span className="chrono-event-date">{e.expression_temporelle_source || e.date_debut_normalisee}</span>
                  <strong>{e.libelle}</strong>
                  <small>{NAT_LABELS[e.nature_chronologique] || e.nature_chronologique}</small>
                </button>
              })}
            </div>
          </div>

          <div className={`chrono-unpositionable ${phase === 'complete' || nonPositionable.some(e => visibleIds.has(e.chrono_id)) ? 'visible' : ''}`}>
            <div className="chrono-unpositionable-title"><Icon name="warning" size={17}/><div><strong>Repères temporels non positionnables</strong><span>Conservés sans leur attribuer artificiellement une année.</span></div></div>
            <div className="chrono-unpositionable-list">
              {nonPositionable.map(e => <button key={e.chrono_id} className={visibleIds.has(e.chrono_id) ? 'visible' : ''} onClick={() => chooseElement(e)} disabled={!visibleIds.has(e.chrono_id)}>
                <b>{e.expression_temporelle_source}</b><span>{e.libelle}</span>
              </button>)}
            </div>
          </div>

          {phase === 'complete' && <button className="chrono-replay" type="button" onClick={startTransform}><Icon name="reset" size={15}/>Rejouer la transformation</button>}
        </>}
      </div>
    </section>

    {selected && <section className="chrono-detail" aria-live="polite">
      <div className="chrono-detail-head">
        <div><span className={`chrono-nature-pill ${selected.nature_chronologique}`}>{NAT_LABELS[selected.nature_chronologique] || selected.nature_chronologique}</span>{selected.sous_type && <span className="chrono-subtype-pill">{selected.sous_type.replaceAll('_', ' ')}</span>}<span className={`chrono-status-pill ${selected.statut_connaissance}`}>{selected.statut_connaissance === 'prospectif' ? 'Prospectif' : 'Observé'}</span></div>
        <button type="button" onClick={() => setSelectedId(null)} aria-label="Fermer le détail"><Icon name="close" size={17}/></button>
      </div>
      <div className="chrono-detail-grid">
        <div>
          <span className="chrono-detail-label">REPÈRE TEMPOREL</span>
          <h3>{selected.expression_temporelle_source}</h3>
          <h2>{selected.libelle}</h2>
          <p className="chrono-justification">{selected.justification_chronologique}</p>
        </div>
        <div className="chrono-proof-stack">
          {(selectedProvs.length ? selectedProvs : [{ preuve: selected.preuve, niveau_confiance: selected.niveau_confiance }]).map((proof, proofIndex) => <div className="chrono-proof-card" key={`${selected.chrono_id}-${proof.chunk_id || 'proof'}-${proofIndex}`}>
            <span className="chrono-detail-label">{selectedProvs.length > 1 ? `PREUVE SOURCE ${proofIndex + 1} / ${selectedProvs.length}` : 'PREUVE SOURCE'}</span>
            <blockquote>{proof.preuve || selected.preuve}</blockquote>
            <div className="chrono-proof-meta">
              <b>{publicationId}</b>
              {proof.page_source && <span>Page {proof.page_source}</span>}
              {proof.chunk_id && <span>Chunk {proof.chunk_id}</span>}
              <span>Confiance : {proof.niveau_confiance || selected.niveau_confiance}</span>
            </div>
            {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer">Voir le document source <Icon name="external" size={14}/></a>}
          </div>)}
        </div>
      </div>
    </section>}
  </main>
}

export default function CrossDocuments({ data }) {
  const [view, setView] = useState('home')
  const { chronology } = useChronologyData(view === 'home')
  const publicationCount = chronology
    ? new Set(chronology.elements.map(e => e.publication_id)).size
    : 0

  if (view === 'chronology') return <ChronologyWorkspace data={data} onBack={() => setView('home')} />
  return <CrossDocumentsHome publicationCount={publicationCount} onOpenChronology={() => setView('chronology')} />
}
