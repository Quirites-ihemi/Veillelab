import React, { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { analyzeScenarioFraming, analyzeScenarioAxes, analyzeScenarioAxisSupport, analyzeScenarioDynamics } from '../services/reflectionApi.js'
import { exportScenarioWord, exportScenarioExcel } from '../utils/scenarioExport.js'
import scenarioHero from '../header-corpus-securite.png'
import './scenario-workspace.css'

const STEPS = [
  { id: 1, label: 'Formuler le besoin' },
  { id: 2, label: 'Choisir des axes de veille' },
  { id: 3, label: 'Objets de la veille' },
  { id: 4, label: 'Finaliser le scénario' },
]

const clip = (value, max = 420) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, '')}…`
}

const statusLabel = status => ({
  non_evalue: 'Documentation après choix',
  documente: 'Corpus · plusieurs sources',
  partiellement_documente: 'Corpus · couverture partielle',
  a_instruire: 'À instruire',
  indisponible: 'Documentation indisponible',
}[status] || 'Documentation après choix')

const statusClass = status => ({
  non_evalue: 'pending',
  documente: 'documented',
  partiellement_documente: 'partial',
  a_instruire: 'investigate',
  indisponible: 'unavailable',
}[status] || 'pending')

const normalizeTitle = value => String(value || '').trim().toLowerCase()

function sourceUrl(source = {}) {
  const raw = String(source.url || '').trim()
  if (!raw) return ''
  const locator = String(source.repere || source.locator || '').trim()
  if (/\.pdf(?:$|[?#])/i.test(raw) && /^\d+$/.test(locator)) return `${raw.split('#')[0]}#page=${locator}`
  return raw
}

function sourceLabel(source = {}) {
  return [
    source.publication_id,
    source.titre || source.title,
    source.organisme_producteur || source.organisation,
    source.annee_publication || source.year,
    (source.repere || source.locator) ? `repère ${source.repere || source.locator}` : '',
  ].filter(Boolean).join(' · ')
}

function flattenStructurationAxes(structurations = []) {
  const seen = new Set()
  const flattened = []

  structurations.forEach((structure, structureIndex) => {
    ;(structure.axes || []).forEach((axis, axisIndex) => {
      const key = normalizeTitle(axis.titre)
      if (seen.has(key)) return
      seen.add(key)
      flattened.push({
        ...axis,
        structure_id: structure.structure_id,
        structure_title: structure.titre,
        display_order: flattened.length,
        suggested: structureIndex === 0 || axisIndex < 2,
      })
    })
  })

  return flattened
}

function axisIcon(axis = {}) {
  const text = `${axis.titre || ''} ${axis.objectif_surveillance || ''}`.toLowerCase()
  if (text.includes('territ')) return '⌖'
  if (text.includes('socio') || text.includes('acteur') || text.includes('réponse')) return '👥'
  if (text.includes('numér') || text.includes('technolog')) return '⌘'
  if (text.includes('intens') || text.includes('trajectoire')) return '◎'
  if (text.includes('rupture')) return '↯'
  return '▥'
}

function SourceList({ sources = [], compact = false }) {
  if (!sources.length) return null
  return <details className={`qvl-t06-sources ${compact ? 'compact' : ''}`}>
    <summary>{sources.length === 1 ? 'Source' : `Sources (${sources.length})`}</summary>
    <div className="qvl-t06-source-list">
      {sources.map((source, index) => {
        const href = sourceUrl(source)
        return <div className="qvl-t06-source" key={`${source.material_id || source.publication_id || index}-${index}`}>
          <strong>{sourceLabel(source) || source.libelle || 'Source du corpus'}</strong>
          <div className="qvl-t06-source-meta">
            {source.provenance_level && <span>Provenance {source.provenance_level}</span>}
            {source.kind && <span>{source.kind}</span>}
          </div>
          {source.extrait && !compact && <p>{clip(source.extrait, 460)}</p>}
          {href && <a href={href} target="_blank" rel="noreferrer"><Icon name="external" size={14}/> Ouvrir la source</a>}
        </div>
      })}
    </div>
  </details>
}

function OriginBadge({ origin }) {
  if (origin === 'corpus') return <span className="qvl-t06-origin corpus">Corpus</span>
  if (origin === 'enrichissement_controle') return <span className="qvl-t06-origin enrichment">Enrichissement contrôlé</span>
  if (origin === 'utilisateur') return <span className="qvl-t06-origin user">Votre choix</span>
  return <span className="qvl-t06-origin ai">Proposition IA à valider</span>
}

function ReflexiveLine({ children }) {
  return <div className="qvl-t06-reflexive"><Icon name="info" size={17}/><span>{children}</span></div>
}

function PreviewBlock({ title, children }) {
  return <section className="qvl-t06-preview-block"><h3>{title}</h3>{children}</section>
}

function WorkflowPanel() {
  const items = [
    {
      id: 1,
      icon: '🗎',
      title: 'Vous formulez votre besoin',
      text: 'Vous décrivez le sujet ou la question que vous souhaitez suivre.',
    },
    {
      id: 2,
      icon: '▥',
      title: 'Quiritès propose des axes de veille',
      text: 'Les axes de veille sont des angles de lecture du besoin. Ils servent à structurer la veille.',
    },
    {
      id: 3,
      icon: '◫',
      title: 'Le corpus documente des objets de veille',
      text: 'Pour chaque axe retenu, le corpus apporte des tendances, des signes de changement et des sources.',
    },
    {
      id: 4,
      icon: '✓',
      title: 'Vous finalisez votre scénario',
      text: 'Vous retenez les axes et objets utiles, puis vous obtenez un scénario de veille.',
    },
  ]

  return <section className="qvl-t06-dispositif">
    <div className="qvl-t06-dispositif-head">
      <div className="qvl-t06-dispositif-icon">⚙</div>
      <div>
        <h3>Comment fonctionne le dispositif ?</h3>
        <p>En quelques étapes, de votre besoin à un scénario de veille adapté.</p>
      </div>
    </div>
    <div className="qvl-t06-mini-steps">
      {items.map((item, index) => <React.Fragment key={item.id}>
        <article className="qvl-t06-mini-step">
          <div className="qvl-t06-mini-step-number">{item.id}</div>
          <div className="qvl-t06-mini-step-icon" aria-hidden="true">{item.icon}</div>
          <div>
            <strong>{item.title}</strong>
            <p>{item.text}</p>
          </div>
        </article>
        {index < items.length - 1 && <div className="qvl-t06-mini-arrow" aria-hidden="true">→</div>}
      </React.Fragment>)}
    </div>
  </section>
}

function DefinitionsPanel() {
  return <div className="qvl-t06-definitions-grid">
    <article className="qvl-t06-definition-card axis">
      <div className="qvl-t06-definition-icon" aria-hidden="true">▥</div>
      <div>
        <h3>Axe de veille</h3>
        <p>Un axe de veille est un angle de lecture du besoin. Il sert à structurer la veille.</p>
        <span>Exemple : dynamiques territoriales</span>
      </div>
    </article>
    <article className="qvl-t06-definition-card object">
      <div className="qvl-t06-definition-icon" aria-hidden="true">◫</div>
      <div>
        <h3>Objet de veille</h3>
        <p>Un objet de veille est un élément concret à suivre dans un axe retenu. Il est documenté par le corpus.</p>
        <span>Exemple : concentration locale de certains faits</span>
      </div>
    </article>
  </div>
}

function AxisCard({ axis, checked, onToggle }) {
  return <article className={`qvl-t06-axis-card ${checked ? 'selected' : ''}`}>
    <button type="button" className="qvl-t06-axis-card-check" onClick={onToggle} aria-pressed={checked} aria-label={`${checked ? 'Retirer' : 'Retenir'} ${axis.titre}`}>
      {checked ? '✓' : '○'}
    </button>
    <div className="qvl-t06-axis-card-icon" aria-hidden="true">{axisIcon(axis)}</div>
    <div className="qvl-t06-axis-card-body">
      <div className="qvl-t06-axis-card-head">
        <h4>{axis.titre}</h4>
        <span className={`qvl-t06-status ${statusClass(axis.corpus_status)}`}>{statusLabel(axis.corpus_status)}</span>
      </div>
      <p className="qvl-t06-axis-card-objective">{axis.objectif_surveillance}</p>
      <p className="qvl-t06-axis-card-why"><strong>Pourquoi le proposer :</strong> {axis.pourquoi}</p>
    </div>
  </article>
}

function WatchItem({ type, item, selected, onToggle }) {
  const isTrend = type === 'trend'
  const icon = isTrend ? '✓' : '◉'
  return <article className={`qvl-t06-object-item ${type} ${selected ? 'selected' : ''}`}>
    <button type="button" className="qvl-t06-object-toggle" onClick={onToggle} aria-pressed={selected} aria-label={`${selected ? 'Retirer' : 'Retenir'} ${item.label}`}>
      <span className="qvl-t06-object-icon" aria-hidden="true">{selected ? icon : '○'}</span>
      <span className="qvl-t06-object-copy">
        <strong>{item.label}</strong>
        {isTrend && item.synthese && <small>{clip(item.synthese, 170)}</small>}
        {!isTrend && item.pourquoi_guetter && <small>{clip(item.pourquoi_guetter, 150)}</small>}
      </span>
    </button>
    <SourceList sources={item.sources || []} compact />
  </article>
}

function WatchSource({ item, selected, onToggle }) {
  return <article className={`qvl-t06-object-item source ${selected ? 'selected' : ''}`}>
    <button type="button" className="qvl-t06-object-toggle" onClick={onToggle} aria-pressed={selected} aria-label={`${selected ? 'Retirer' : 'Retenir'} ${item.label}`}>
      <span className="qvl-t06-object-icon" aria-hidden="true">{selected ? '↗' : '○'}</span>
      <span className="qvl-t06-object-copy"><strong>{item.label}</strong>{item.raison && <small>{clip(item.raison, 150)}</small>}</span>
    </button>
    <SourceList sources={item.sources || []} compact />
  </article>
}

export default function ScenarioWorkspace({ onBack }) {
  const [step, setStep] = useState(1)
  const [need, setNeed] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [framing, setFraming] = useState(null)
  const [axesMeta, setAxesMeta] = useState(null)
  const [axesList, setAxesList] = useState([])
  const [selectedAxisIds, setSelectedAxisIds] = useState(new Set())
  const [dynamicsData, setDynamicsData] = useState(null)
  const [selectedWatch, setSelectedWatch] = useState(new Set())
  const [finalized, setFinalized] = useState(false)

  const clearAfterNeed = value => {
    setNeed(value)
    setFraming(null)
    setAxesMeta(null)
    setAxesList([])
    setSelectedAxisIds(new Set())
    setDynamicsData(null)
    setSelectedWatch(new Set())
    setFinalized(false)
    setStep(1)
    setError('')
  }

  const selectedAxes = useMemo(() => axesList.filter(axis => selectedAxisIds.has(axis.axis_id)), [axesList, selectedAxisIds])

  const toggleSetKey = key => setSelectedWatch(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const runNeedAnalysis = async () => {
    if (!need.trim() || loading) return
    setLoading(true)
    setError('')
    setFinalized(false)

    try {
      const framingResult = await analyzeScenarioFraming(need.trim())
      const axesResult = await analyzeScenarioAxes(need.trim(), framingResult, [])
      const flatAxes = flattenStructurationAxes(axesResult?.structurations || [])

      setFraming(framingResult)
      setAxesMeta(axesResult)
      setAxesList(flatAxes)
      setSelectedAxisIds(new Set(flatAxes.map(axis => axis.axis_id)))
      setDynamicsData(null)
      setSelectedWatch(new Set())
      setStep(2)
    } catch (e) {
      setError(e.message || 'Impossible d’analyser ce besoin pour le moment.')
    } finally {
      setLoading(false)
    }
  }

  const toggleAxis = axisId => setSelectedAxisIds(prev => {
    const next = new Set(prev)
    if (next.has(axisId)) next.delete(axisId)
    else next.add(axisId)
    return next
  })

  const buildWatch = async () => {
    if (!selectedAxes.length || loading) return
    setLoading(true)
    setError('')

    try {
      const support = await analyzeScenarioAxisSupport(need.trim(), framing, [], selectedAxes)
      const documentedAxes = Array.isArray(support?.axes) ? support.axes : []
      setAxesList(prev => prev.map(axis => documentedAxes.find(item => item.axis_id === axis.axis_id) || axis))

      if (support?.documentation_available === false) {
        setError('La documentation du corpus n’a pas pu être établie pour au moins un axe en raison d’une indisponibilité technique. Ce message ne signifie pas que le corpus est lacunaire. Vous pouvez relancer la construction des objets de veille.')
        return
      }

      const result = await analyzeScenarioDynamics(need.trim(), framing, [], documentedAxes)
      setDynamicsData(result)
      setSelectedWatch(new Set())
      setStep(3)
    } catch (e) {
      setError(e.message || 'Impossible de construire les objets de veille.')
    } finally {
      setLoading(false)
    }
  }

  const retainAllAxisWatch = axis => {
    setSelectedWatch(prev => {
      const next = new Set(prev)
      ;(axis.tendances || []).forEach(x => next.add(`trend:${x.trend_id}`))
      ;(axis.signes_a_guetter || []).forEach(x => next.add(`sign:${x.sign_id}`))
      ;(axis.sources_a_surveiller || []).forEach(x => next.add(`src:${x.source_watch_id}`))
      return next
    })
  }

  const preview = useMemo(() => {
    if (!axesMeta) return null
    const watchAxes = (dynamicsData?.axes || []).map(axis => ({
      axis_id: axis.axis_id,
      axis_title: axis.titre,
      trends: (axis.tendances || []).filter(x => selectedWatch.has(`trend:${x.trend_id}`)),
      watch_signs: (axis.signes_a_guetter || []).filter(x => selectedWatch.has(`sign:${x.sign_id}`)),
      sources_to_watch: (axis.sources_a_surveiller || []).filter(x => selectedWatch.has(`src:${x.source_watch_id}`)),
    }))

    return {
      need_original: need.trim(),
      clarifications: [],
      structure: null,
      axes: selectedAxes.map(a => ({
        axis_id: a.axis_id,
        title: a.titre,
        objective: a.objectif_surveillance,
        why: a.pourquoi,
        questions: [],
        corpus_status: a.corpus_status,
        origin: a.origin || 'proposition_ia',
        corpus_contribution: a.apport_corpus || '',
        corpus_limit: a.limite_corpus || '',
        sources: a.sources || [],
      })),
      watch: watchAxes,
      methodology: dynamicsData?.methodological_reference || null,
      generated_at: new Date().toISOString(),
      traceability: {
        framing_engine: framing?.engine || '',
        axes_engine: axesMeta?.engine || '',
        watch_engine: dynamicsData?.engine || '',
      }
    }
  }, [axesMeta, dynamicsData, selectedAxes, selectedWatch, need, framing])

  return <div className="qvl-t06-page">
    <button type="button" className="qvl-t06-back" onClick={onBack}><Icon name="back" size={16}/> Retour à l’atelier</button>

    <header className="qvl-t06-hero">
      <div>
        <span>ATELIER DE VEILLE</span>
        <h1>Scénario de veille</h1>
        <p>Du besoin exprimé par le veilleur à un dispositif de veille structuré, sourcé et exportable.</p>
      </div>
      <img src={scenarioHero} alt="Bibliothèque documentaire de Quiritès Veille Lab"/>
    </header>

    <nav className="qvl-t06-steps" aria-label="Étapes du scénario de veille">
      {STEPS.map(item => <div key={item.id} className={`${step === item.id ? 'active' : ''} ${step > item.id ? 'done' : ''}`}><span>{item.id}</span><strong>{item.label}</strong></div>)}
    </nav>

    {error && <div className="qvl-t06-error">{error}</div>}
    {loading && <div className="qvl-t06-loading"><span className="qvl-t06-spinner"/> Quiritès prépare cette étape…</div>}

    {step === 1 && <section className="qvl-t06-section qvl-t06-step1">
      <div className="qvl-t06-section-head">
        <div>
          <h2>1. Formuler le besoin</h2>
          <p>Présentez votre besoin. Quiritès vous proposera ensuite des axes de veille, puis des objets de veille à suivre.</p>
        </div>
      </div>

      <WorkflowPanel />
      <DefinitionsPanel />

      <section className="qvl-t06-need-panel">
        <div className="qvl-t06-need-panel-head">
          <div className="qvl-t06-need-panel-title">
            <div className="qvl-t06-need-panel-icon" aria-hidden="true">🗎</div>
            <div>
              <h3>Votre besoin de veille</h3>
              <p>Décrivez en quelques phrases le sujet de votre veille.</p>
            </div>
          </div>
          <span className="qvl-t06-counter">{need.length} / 2000</span>
        </div>
        <textarea value={need} maxLength={2000} onChange={e => clearAfterNeed(e.target.value)} placeholder="Décrivez ici le sujet ou la question que vous souhaitez suivre…"/>
      </section>

      <div className="qvl-t06-step1-actions">
        <button type="button" className="qvl-t06-secondary"><span aria-hidden="true">◔</span> Voir un exemple</button>
        <button type="button" className="qvl-t06-primary" onClick={runNeedAnalysis} disabled={!need.trim() || loading}>Analyser mon besoin <Icon name="chevron" size={16}/></button>
      </div>

      <ReflexiveLine>Le corpus n’analyse pas à votre place : il aide à documenter les objets de veille retenus.</ReflexiveLine>
    </section>}

    {step === 2 && axesMeta && <section className="qvl-t06-section qvl-t06-step2">
      <div className="qvl-t06-section-head">
        <div>
          <h2>2. Choisir des axes de veille</h2>
          <p>Quiritès propose des axes de veille à partir de votre besoin. Un axe structure la veille ; les objets de veille seront proposés ensuite.</p>
        </div>
        <OriginBadge origin="proposition_ia"/>
      </div>

      <div className="qvl-t06-current-need"><strong>Besoin de veille</strong><span>{need}</span></div>

      <div className="qvl-t06-axes-grid">
        {axesList.map(axis => <AxisCard key={axis.axis_id} axis={axis} checked={selectedAxisIds.has(axis.axis_id)} onToggle={() => toggleAxis(axis.axis_id)} />)}
      </div>

      <ReflexiveLine>À cette étape, vous choisissez des axes de veille. Les objets de veille — tendances, signes de changement et sources à surveiller — seront proposés à l’étape suivante pour les seuls axes retenus.</ReflexiveLine>

      <div className="qvl-t06-next">
        <button type="button" className="qvl-t06-secondary" onClick={() => setStep(1)}><Icon name="back" size={16}/> Retour au besoin</button>
        <button type="button" className="qvl-t06-primary" onClick={buildWatch} disabled={!selectedAxes.length || loading}>Construire les objets de veille <Icon name="chevron" size={16}/></button>
      </div>
    </section>}

    {step === 3 && dynamicsData && <section className="qvl-t06-section qvl-t06-objects-section">
      <div className="qvl-t06-section-head"><div><h2>3. Objets de la veille</h2><p>Le corpus apporte des repères utiles pour chaque axe, sous une forme volontairement synthétique.</p></div></div>
      <div className="qvl-t06-current-need qvl-t06-current-need-objects"><strong>Besoin de veille</strong><span>{need}</span></div>
      <div className="qvl-t06-watch-axes">
        {(dynamicsData.axes || []).map((axis, axisIndex) => <section className="qvl-t06-watch-axis qvl-t06-object-axis" key={axis.axis_id}>
          <div className="qvl-t06-watch-axis-head qvl-t06-object-axis-head"><div><span>Axe {axisIndex + 1}</span><h3>{axis.titre}</h3><p>{axis.objectif_surveillance}</p></div><button type="button" onClick={() => retainAllAxisWatch(axis)}>Tout retenir pour cet axe</button></div>
          <div className="qvl-t06-objects-grid">
            <div className="qvl-t06-object-column trend">
              <h4><span aria-hidden="true">▤</span> Tendances documentées</h4>
              {axis.tendances?.length ? axis.tendances.map(item => <WatchItem key={item.trend_id} type="trend" item={item} selected={selectedWatch.has(`trend:${item.trend_id}`)} onToggle={() => toggleSetKey(`trend:${item.trend_id}`)}/>) : <div className="qvl-t06-empty">Aucune tendance suffisamment étayée par plusieurs publications.</div>}
            </div>
            <div className="qvl-t06-object-column sign">
              <h4><span aria-hidden="true">◉</span> Signes de changement à guetter</h4>
              {axis.signes_a_guetter?.length ? axis.signes_a_guetter.map(item => <WatchItem key={item.sign_id} type="sign" item={item} selected={selectedWatch.has(`sign:${item.sign_id}`)} onToggle={() => toggleSetKey(`sign:${item.sign_id}`)}/>) : <div className="qvl-t06-empty">Aucun signe proposé pour cet axe.</div>}
            </div>
            <div className="qvl-t06-object-column source">
              <h4><span aria-hidden="true">↗</span> Sources à surveiller</h4>
              {axis.sources_a_surveiller?.length ? axis.sources_a_surveiller.map(item => <WatchSource key={item.source_watch_id} item={item} selected={selectedWatch.has(`src:${item.source_watch_id}`)} onToggle={() => toggleSetKey(`src:${item.source_watch_id}`)}/>) : <div className="qvl-t06-empty">Aucune source supplémentaire proposée pour cet axe.</div>}
            </div>
          </div>
        </section>)}
      </div>
      <ReflexiveLine>Ces objets de veille visent à nourrir le travail du veilleur, sans se substituer à son analyse.</ReflexiveLine>
      <div className="qvl-t06-next"><button type="button" className="qvl-t06-secondary" onClick={() => setStep(2)}><Icon name="back" size={16}/> Axe précédent</button><button type="button" className="qvl-t06-primary" onClick={() => setStep(4)}>Poursuivre vers le scénario <Icon name="chevron" size={16}/></button></div>
    </section>}

    {step === 4 && preview && <section className="qvl-t06-section">
      <div className="qvl-t06-section-head"><div><h2>4. Finaliser le scénario</h2><p>Cette page assemble uniquement les choix effectués dans les étapes précédentes. Aucun nouveau contenu n’est généré ici.</p></div></div>
      <div className="qvl-t06-preview">
        <PreviewBlock title="Besoin de veille"><p>{preview.need_original}</p></PreviewBlock>
        <PreviewBlock title="Axes de veille">{preview.axes.map(axis => <div className="qvl-t06-preview-axis" key={axis.axis_id}><div><OriginBadge origin={axis.origin}/><span className={`qvl-t06-status ${statusClass(axis.corpus_status)}`}>{statusLabel(axis.corpus_status)}</span></div><strong>{axis.title}</strong><p>{axis.objective}</p><p><strong>Pourquoi le proposer :</strong> {axis.why}</p><SourceList sources={axis.sources || []} compact/></div>)}</PreviewBlock>
        <PreviewBlock title="Objets de la veille">{preview.watch.map(axis => <div className="qvl-t06-preview-watch" key={axis.axis_id}><h4>{axis.axis_title}</h4>{axis.trends.map(x => <div className="qvl-t06-preview-object" key={x.trend_id}><p><strong>Tendance :</strong> {x.label}</p><SourceList sources={x.sources || []} compact/></div>)}{axis.watch_signs.map(x => <div className="qvl-t06-preview-object" key={x.sign_id}><p><strong>Signe à guetter :</strong> {x.label}</p><SourceList sources={x.sources || []} compact/></div>)}{axis.sources_to_watch.map(x => <div className="qvl-t06-preview-object" key={x.source_watch_id}><p><strong>Source à surveiller :</strong> {x.label}</p><SourceList sources={x.sources || []} compact/></div>)}</div>)}</PreviewBlock>
      </div>
      <ReflexiveLine>Avant l’export : ce scénario correspond-il encore à votre besoin initial ? Les sources associées vous paraissent-elles suffisantes pour l’usage visé ?</ReflexiveLine>
      <div className="qvl-t06-next"><button type="button" className="qvl-t06-secondary" onClick={() => setStep(3)}><Icon name="back" size={16}/> Étape précédente</button>{!finalized ? <button type="button" className="qvl-t06-primary" onClick={() => setFinalized(true)}><Icon name="spark" size={16}/> Générer le livrable</button> : <><button type="button" className="qvl-t06-secondary" onClick={() => exportScenarioWord(preview)}><Icon name="file" size={16}/> Exporter Word</button><button type="button" className="qvl-t06-secondary" onClick={() => exportScenarioExcel(preview)}><Icon name="layers" size={16}/> Exporter les données</button></>}</div>
      {finalized && <div className="qvl-t06-final">Le livrable reprend uniquement les éléments que vous avez retenus. La provenance et le statut de chaque proposition sont conservés dans les exports.</div>}
    </section>}
  </div>
}
