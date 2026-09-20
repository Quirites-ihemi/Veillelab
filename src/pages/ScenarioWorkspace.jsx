import React, { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { analyzeScenarioFraming, analyzeScenarioAxes, analyzeScenarioAxisSupport, analyzeScenarioDynamics } from '../services/reflectionApi.js'
import { exportScenarioWord, exportScenarioExcel } from '../utils/scenarioExport.js'
import scenarioHero from '../header-corpus-securite.png'
import './scenario-workspace.css'

const STEPS = [
  { id: 1, label: 'Cadrer le besoin' },
  { id: 2, label: 'Choisir des axes de veille' },
  { id: 3, label: 'Construire la grille de guet' },
  { id: 4, label: 'Prévisualiser et générer' },
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

function sourceUrl(source = {}) {
  const raw = String(source.url || '').trim()
  if (!raw) return ''
  const locator = String(source.repere || source.locator || '').trim()
  if (/\.pdf(?:$|[?#])/i.test(raw) && /^\d+$/.test(locator)) return `${raw.split('#')[0]}#page=${locator}`
  return raw
}

function sourceLabel(source = {}) {
  return [
    source.titre || source.title,
    source.organisme_producteur || source.organisation,
    source.annee_publication || source.year,
    (source.repere || source.locator) ? `repère ${source.repere || source.locator}` : '',
  ].filter(Boolean).join(' · ')
}

function SourceList({ sources = [], compact = false }) {
  if (!sources.length) return null
  return <details className={`qvl-t06-sources ${compact ? 'compact' : ''}`}>
    <summary>{sources.length === 1 ? 'Voir la source' : `Voir les ${sources.length} sources`}</summary>
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

function ToggleButton({ active, onClick, children = 'Retenir' }) {
  return <button type="button" className={`qvl-t06-toggle ${active ? 'active' : ''}`} onClick={onClick}>{active ? '✓ Retenu' : children}</button>
}

function CoverageOverview({ coverage }) {
  if (!coverage) return null
  return <div className="qvl-t06-coverage-overview">
    <div className="qvl-t06-coverage-stats">
      <div><strong>{coverage.publication_count || 0}</strong><span>publications repérées</span></div>
      <div><strong>{coverage.material_count || 0}</strong><span>matériaux retrouvés</span></div>
      <div><strong>{coverage.years?.length || 0}</strong><span>années représentées</span></div>
    </div>
    {!!coverage.sources?.length && <div className="qvl-t06-coverage-sources">
      <strong>Quelques sources déjà présentes dans le corpus</strong>
      <div>{coverage.sources.slice(0, 3).map((source, i) => <span key={`${source.publication_id}-${i}`}>{source.titre || source.publication_id}</span>)}</div>
    </div>}
  </div>
}

function ClarifyingQuestion({ item, value, onChange }) {
  return <label className="qvl-t06-question-card">
    <span>{item.question}</span>
    <small>{item.pourquoi}</small>
    <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder="Votre réponse (facultative)" />
  </label>
}

function AxisEvidence({ axis }) {
  const pending = axis.corpus_status === 'non_evalue'
  const unavailable = axis.corpus_status === 'indisponible'
  return <details className="qvl-t06-axis-evidence">
    <summary>Ce que le corpus apporte à cet axe</summary>
    <div>
      {pending ? <p className="muted">La documentation du corpus sera lancée uniquement après le choix de la structuration et des axes.</p>
        : unavailable ? <p className="limit">La documentation du corpus n’a pas pu être établie pour des raisons techniques. Cela ne signifie pas que le corpus ne contient aucun matériau pertinent.</p>
        : axis.apport_corpus ? <p>{axis.apport_corpus}</p>
        : <p className="muted">Aucun matériau suffisamment pertinent n’a été retenu pour documenter cet axe.</p>}
      {axis.limite_corpus && <p className="limit"><strong>Limite :</strong> {axis.limite_corpus}</p>}
      <SourceList sources={axis.sources || []} compact />
    </div>
  </details>
}

function AxisRow({ axis, checked, onToggle }) {
  return <article className={`qvl-t06-axis-row ${checked ? 'selected' : ''}`}>
    <div className="qvl-t06-axis-check">
      <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`Retenir ${axis.titre}`}/>
    </div>
    <div className="qvl-t06-axis-content">
      <div className="qvl-t06-axis-head">
        <h4>{axis.titre}</h4>
        <span className={`qvl-t06-status ${statusClass(axis.corpus_status)}`}>{statusLabel(axis.corpus_status)}</span>
      </div>
      <p className="qvl-t06-axis-objective">{axis.objectif_surveillance}</p>
      <p className="qvl-t06-axis-why"><strong>Pourquoi le proposer :</strong> {axis.pourquoi}</p>
      {!!axis.questions?.length && <ul className="qvl-t06-axis-questions">{axis.questions.map((q, i) => <li key={`${axis.axis_id}-q-${i}`}>{q}</li>)}</ul>}
      <AxisEvidence axis={axis}/>
    </div>
  </article>
}

function StructureCard({ structure, selected, selectedAxisIds, onChoose, onAxisToggle }) {
  return <section className={`qvl-t06-structure ${selected ? 'selected' : ''}`}>
    <button type="button" className="qvl-t06-structure-choice" onClick={onChoose}>
      <span className="qvl-t06-structure-letter">{structure.structure_id}</span>
      <span><strong>{structure.titre}</strong><small>{structure.logique}</small></span>
      <span className="qvl-t06-radio">{selected ? '●' : '○'}</span>
    </button>
    <div className="qvl-t06-axis-list">
      {structure.axes.map(axis => <AxisRow key={axis.axis_id} axis={axis} checked={selected && selectedAxisIds.has(axis.axis_id)} onToggle={() => onAxisToggle(axis.axis_id)} />)}
    </div>
  </section>
}

function WatchItem({ type, item, selected, onToggle }) {
  const isTrend = type === 'trend'
  const isSign = type === 'sign'
  const title = isTrend ? 'Tendance documentée' : isSign ? 'Signe de changement à guetter' : 'Hypothèse de regroupement'
  return <article className={`qvl-t06-watch-card ${type} ${selected ? 'selected' : ''}`}>
    <div className="qvl-t06-watch-top"><span>{title}</span><OriginBadge origin={isTrend ? 'corpus' : 'proposition_ia'}/></div>
    <h4>{item.label}</h4>
    {isTrend && item.synthese && <p>{item.synthese}</p>}
    {isTrend && item.limite && <p className="limit"><strong>Limite :</strong> {item.limite}</p>}
    {isSign && <>
      {item.pourquoi_guetter && <p><strong>Pourquoi le guetter :</strong> {item.pourquoi_guetter}</p>}
      {item.ce_qui_confirmerait && <p className="watch-detail"><strong>Ce qui renforcerait le signal :</strong> {item.ce_qui_confirmerait}</p>}
      {item.ce_qui_affaiblirait && <p className="watch-detail"><strong>Ce qui l’affaiblirait :</strong> {item.ce_qui_affaiblirait}</p>}
    </>}
    {!isTrend && !isSign && <>
      {item.interpretation && <p>{item.interpretation}</p>}
      {item.ce_qui_invaliderait && <p className="watch-detail"><strong>Ce qui invaliderait l’hypothèse :</strong> {item.ce_qui_invaliderait}</p>}
    </>}
    <SourceList sources={item.sources || []} compact />
    <ToggleButton active={selected} onClick={onToggle}/>
  </article>
}

function WatchSource({ item, selected, onToggle }) {
  return <article className={`qvl-t06-watch-source ${selected ? 'selected' : ''}`}>
    <div><OriginBadge origin={item.origin || 'proposition_ia'}/><strong>{item.label}</strong><p>{item.raison}</p></div>
    <SourceList sources={item.sources || []} compact />
    <ToggleButton active={selected} onClick={onToggle}/>
  </article>
}

function PreviewBlock({ title, children }) {
  return <section className="qvl-t06-preview-block"><h3>{title}</h3>{children}</section>
}

export default function ScenarioWorkspace({ onBack }) {
  const [step, setStep] = useState(1)
  const [need, setNeed] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [framing, setFraming] = useState(null)
  const [answers, setAnswers] = useState({})
  const [axesData, setAxesData] = useState(null)
  const [selectedStructureId, setSelectedStructureId] = useState('')
  const [selectedAxisIds, setSelectedAxisIds] = useState(new Set())
  const [customAxisText, setCustomAxisText] = useState('')
  const [customAxes, setCustomAxes] = useState([])
  const [dynamicsData, setDynamicsData] = useState(null)
  const [selectedWatch, setSelectedWatch] = useState(new Set())
  const [finalized, setFinalized] = useState(false)

  const clearAfterNeed = value => {
    setNeed(value); setFraming(null); setAnswers({}); setAxesData(null); setSelectedStructureId(''); setSelectedAxisIds(new Set()); setCustomAxes([]); setDynamicsData(null); setSelectedWatch(new Set()); setFinalized(false); setStep(1); setError('')
  }

  const answerPayload = useMemo(() => (framing?.questions || []).map(q => ({ question_id: q.question_id, question: q.question, answer: answers[q.question_id] || '' })).filter(x => x.answer.trim()), [framing, answers])

  const chosenStructure = useMemo(() => (axesData?.structurations || []).find(s => s.structure_id === selectedStructureId) || null, [axesData, selectedStructureId])

  const selectedAxes = useMemo(() => {
    const base = chosenStructure ? chosenStructure.axes.filter(a => selectedAxisIds.has(a.axis_id)) : []
    return [...base, ...customAxes]
  }, [chosenStructure, selectedAxisIds, customAxes])

  const toggleSetKey = key => setSelectedWatch(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })

  const runFraming = async () => {
    if (!need.trim() || loading) return
    setLoading(true); setError(''); setFinalized(false)
    try {
      const result = await analyzeScenarioFraming(need.trim())
      setFraming(result); setAnswers({}); setAxesData(null); setDynamicsData(null); setStep(1)
    } catch (e) { setError(e.message || 'Impossible d’analyser ce besoin pour le moment.') }
    finally { setLoading(false) }
  }

  const buildAxes = async () => {
    if (!framing || loading) return
    setLoading(true); setError('')
    try {
      const result = await analyzeScenarioAxes(need.trim(), framing, answerPayload)
      setAxesData(result)
      const first = result?.structurations?.[0]
      if (first) {
        setSelectedStructureId(first.structure_id)
        setSelectedAxisIds(new Set(first.axes.map(a => a.axis_id)))
      }
      setDynamicsData(null); setSelectedWatch(new Set()); setStep(2)
    } catch (e) { setError(e.message || 'Impossible de proposer des axes de veille.') }
    finally { setLoading(false) }
  }

  const chooseStructure = structure => {
    setSelectedStructureId(structure.structure_id)
    setSelectedAxisIds(new Set(structure.axes.map(a => a.axis_id)))
    setCustomAxes([])
  }

  const toggleAxis = axisId => setSelectedAxisIds(prev => {
    const next = new Set(prev)
    if (next.has(axisId)) next.delete(axisId); else next.add(axisId)
    return next
  })

  const addCustomAxis = () => {
    const title = customAxisText.trim()
    if (!title) return
    const n = customAxes.length + 1
    setCustomAxes(prev => [...prev, {
      axis_id: `USR${n}`,
      titre: title,
      objectif_surveillance: title,
      pourquoi: 'Axe ajouté par le veilleur.',
      questions: [],
      requete_rag: title,
      corpus_status: 'a_instruire',
      origin: 'utilisateur',
      sources: [],
    }])
    setCustomAxisText('')
  }

  const buildWatch = async () => {
    if (!selectedAxes.length || loading) return
    setLoading(true); setError('')
    try {
      const support = await analyzeScenarioAxisSupport(need.trim(), framing, answerPayload, selectedAxes)
      const documentedAxes = Array.isArray(support?.axes) ? support.axes : []

      if (chosenStructure) {
        setAxesData(prev => ({
          ...prev,
          structurations: (prev?.structurations || []).map(structure =>
            structure.structure_id === chosenStructure.structure_id
              ? {
                  ...structure,
                  axes: structure.axes.map(axis =>
                    documentedAxes.find(item => item.axis_id === axis.axis_id) || axis
                  )
                }
              : structure
          )
        }))
      }
      setCustomAxes(prev => prev.map(axis => documentedAxes.find(item => item.axis_id === axis.axis_id) || axis))

      if (support?.documentation_available === false) {
        setError('La documentation du corpus n’a pas pu être établie pour au moins un axe en raison d’une indisponibilité technique. Ce message ne signifie pas que le corpus est lacunaire. Vous pouvez relancer la construction de la grille.')
        return
      }

      const result = await analyzeScenarioDynamics(need.trim(), framing, answerPayload, documentedAxes)
      setDynamicsData(result); setSelectedWatch(new Set()); setStep(3)
    } catch (e) { setError(e.message || 'Impossible de construire la grille de guet.') }
    finally { setLoading(false) }
  }

  const retainAllAxisWatch = axis => {
    setSelectedWatch(prev => {
      const next = new Set(prev)
      ;(axis.tendances || []).forEach(x => next.add(`trend:${x.trend_id}`))
      ;(axis.signes_a_guetter || []).forEach(x => next.add(`sign:${x.sign_id}`))
      ;(axis.hypotheses_regroupement || []).forEach(x => next.add(`hyp:${x.hypothesis_id}`))
      ;(axis.sources_a_surveiller || []).forEach(x => next.add(`src:${x.source_watch_id}`))
      return next
    })
  }

  const preview = useMemo(() => {
    if (!axesData) return null
    const watchAxes = (dynamicsData?.axes || []).map(axis => ({
      axis_id: axis.axis_id,
      axis_title: axis.titre,
      trends: (axis.tendances || []).filter(x => selectedWatch.has(`trend:${x.trend_id}`)),
      watch_signs: (axis.signes_a_guetter || []).filter(x => selectedWatch.has(`sign:${x.sign_id}`)),
      cluster_hypotheses: (axis.hypotheses_regroupement || []).filter(x => selectedWatch.has(`hyp:${x.hypothesis_id}`)),
      sources_to_watch: (axis.sources_a_surveiller || []).filter(x => selectedWatch.has(`src:${x.source_watch_id}`)),
      blind_spots: axis.angles_morts || [],
    }))
    return {
      need_original: need.trim(),
      clarifications: answerPayload,
      structure: chosenStructure ? { structure_id: chosenStructure.structure_id, title: chosenStructure.titre, logic: chosenStructure.logique } : null,
      axes: selectedAxes.map(a => ({
        axis_id: a.axis_id,
        title: a.titre,
        objective: a.objectif_surveillance,
        why: a.pourquoi,
        questions: a.questions || [],
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
        axes_engine: axesData?.engine || '',
        watch_engine: dynamicsData?.engine || '',
      }
    }
  }, [axesData, dynamicsData, chosenStructure, selectedAxes, selectedWatch, need, answerPayload, framing])

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

    {step === 1 && <section className="qvl-t06-section">
      <div className="qvl-t06-section-head"><div><h2>1. Cadrer le besoin</h2><p>Votre besoin reste intact. Quelques questions servent seulement à préciser ce qui doit réellement être surveillé.</p></div><OriginBadge origin="utilisateur"/></div>
      <label className="qvl-t06-label">Votre besoin de veille</label>
      <div className="qvl-t06-need-row">
        <textarea value={need} onChange={e => clearAfterNeed(e.target.value)} placeholder="Décrivez librement ce que vous souhaitez mettre en veille…"/>
        <button type="button" className="qvl-t06-primary" onClick={runFraming} disabled={!need.trim() || loading}><Icon name="search" size={17}/> Analyser mon besoin</button>
      </div>

      {framing && <>
        <div className="qvl-t06-section-title"><h3>Quelques questions pour préciser votre veille</h3><p>Vous pouvez répondre à celles qui vous semblent utiles et laisser les autres de côté.</p></div>
        <div className="qvl-t06-question-grid">{(framing.questions || []).map(q => <ClarifyingQuestion key={q.question_id} item={q} value={answers[q.question_id]} onChange={value => setAnswers(prev => ({ ...prev, [q.question_id]: value }))}/>)}</div>
        <CoverageOverview coverage={framing.couverture_corpus}/>
        <ReflexiveLine>Avant de continuer : ce scénario doit-il surtout aider à comprendre, anticiper, comparer, ou décider ? Les réponses ci-dessus devraient vous aider à le préciser.</ReflexiveLine>
        <div className="qvl-t06-next"><button type="button" className="qvl-t06-primary" onClick={buildAxes} disabled={loading}>Voir deux structurations possibles <Icon name="chevron" size={16}/></button></div>
      </>}
    </section>}

    {step === 2 && axesData && <section className="qvl-t06-section">
      <div className="qvl-t06-section-head"><div><h2>2. Choisir des axes de veille</h2><p>Quiritès propose deux manières différentes de structurer le même besoin. Les axes sont des hypothèses à valider, pas des constats.</p></div><OriginBadge origin="proposition_ia"/></div>
      <div className="qvl-t06-current-need"><strong>Besoin de veille</strong><span>{need}</span></div>
      <div className="qvl-t06-structures">{axesData.structurations.map(structure => <StructureCard key={structure.structure_id} structure={structure} selected={selectedStructureId === structure.structure_id} selectedAxisIds={selectedAxisIds} onChoose={() => chooseStructure(structure)} onAxisToggle={toggleAxis}/>)}</div>
      <div className="qvl-t06-custom-axis"><label>Ajouter votre propre axe</label><div><input value={customAxisText} onChange={e => setCustomAxisText(e.target.value)} placeholder="Ex. suivre les écarts entre mesure et perception locale"/><button type="button" onClick={addCustomAxis}>Ajouter</button></div>{customAxes.map(a => <span key={a.axis_id}>+ {a.titre}</span>)}</div>
      <ReflexiveLine>Le meilleur axe n’est pas forcément celui que le corpus documente le mieux. Demandez-vous surtout : si cet axe évolue, cela changera-t-il votre lecture ou votre décision ?</ReflexiveLine>
      <div className="qvl-t06-next"><button type="button" className="qvl-t06-secondary" onClick={() => setStep(1)}><Icon name="back" size={16}/> Étape précédente</button><button type="button" className="qvl-t06-primary" onClick={buildWatch} disabled={!selectedAxes.length || loading}>Construire la grille de guet <Icon name="chevron" size={16}/></button></div>
    </section>}

    {step === 3 && dynamicsData && <section className="qvl-t06-section">
      <div className="qvl-t06-section-head"><div><h2>3. Construire la grille de guet</h2><p>Pour chaque axe retenu, distinguez ce que le corpus documente déjà de ce que l’IA vous propose de surveiller.</p></div></div>
      {dynamicsData.methodological_reference && <div className="qvl-t06-method"><div><OriginBadge origin="enrichissement_controle"/><strong>{dynamicsData.methodological_reference.label}</strong></div><p>{dynamicsData.methodological_reference.usage}</p><a href={dynamicsData.methodological_reference.url} target="_blank" rel="noreferrer">Voir ESPAS Horizon <Icon name="external" size={14}/></a></div>}
      <div className="qvl-t06-watch-axes">
        {(dynamicsData.axes || []).map(axis => <section className="qvl-t06-watch-axis" key={axis.axis_id}>
          <div className="qvl-t06-watch-axis-head"><div><span>{statusLabel(axis.corpus_status)}</span><h3>{axis.titre}</h3><p>{axis.objectif_surveillance}</p></div><button type="button" onClick={() => retainAllAxisWatch(axis)}>Tout retenir pour cet axe</button></div>
          <div className="qvl-t06-watch-grid">
            <div><h4>Tendances documentées</h4>{axis.tendances?.length ? axis.tendances.map(item => <WatchItem key={item.trend_id} type="trend" item={item} selected={selectedWatch.has(`trend:${item.trend_id}`)} onToggle={() => toggleSetKey(`trend:${item.trend_id}`)}/>) : <div className="qvl-t06-empty">Aucune tendance suffisamment étayée par plusieurs publications.</div>}</div>
            <div><h4>Signes de changement à guetter</h4>{axis.signes_a_guetter?.length ? axis.signes_a_guetter.map(item => <WatchItem key={item.sign_id} type="sign" item={item} selected={selectedWatch.has(`sign:${item.sign_id}`)} onToggle={() => toggleSetKey(`sign:${item.sign_id}`)}/>) : <div className="qvl-t06-empty">Aucun signe proposé pour cet axe.</div>}</div>
            <div><h4>Hypothèses de regroupement</h4>{axis.hypotheses_regroupement?.length ? axis.hypotheses_regroupement.map(item => <WatchItem key={item.hypothesis_id} type="hyp" item={item} selected={selectedWatch.has(`hyp:${item.hypothesis_id}`)} onToggle={() => toggleSetKey(`hyp:${item.hypothesis_id}`)}/>) : <div className="qvl-t06-empty">Aucun regroupement suffisamment cohérent n’est proposé à ce stade.</div>}</div>
          </div>
          {!!axis.sources_a_surveiller?.length && <div className="qvl-t06-sources-watch"><h4>Sources à surveiller</h4>{axis.sources_a_surveiller.map(item => <WatchSource key={item.source_watch_id} item={item} selected={selectedWatch.has(`src:${item.source_watch_id}`)} onToggle={() => toggleSetKey(`src:${item.source_watch_id}`)}/>)}</div>}
          {!!axis.angles_morts?.length && <div className="qvl-t06-blindspots"><strong>Angles morts / points à instruire</strong><ul>{axis.angles_morts.map((x, i) => <li key={`${axis.axis_id}-gap-${i}`}>{x}</li>)}</ul></div>}
          <ReflexiveLine>Qu’est-ce qui vous ferait changer d’avis sur cet axe ? Une bonne grille de guet doit aussi dire ce qui affaiblirait l’hypothèse.</ReflexiveLine>
        </section>)}
      </div>
      <div className="qvl-t06-next"><button type="button" className="qvl-t06-secondary" onClick={() => setStep(2)}><Icon name="back" size={16}/> Étape précédente</button><button type="button" className="qvl-t06-primary" onClick={() => setStep(4)}>Prévisualiser le scénario <Icon name="chevron" size={16}/></button></div>
    </section>}

    {step === 4 && preview && <section className="qvl-t06-section">
      <div className="qvl-t06-section-head"><div><h2>4. Prévisualiser et générer</h2><p>Cette page assemble uniquement les choix effectués dans les étapes précédentes. Aucun nouveau contenu n’est généré ici.</p></div></div>
      <div className="qvl-t06-preview">
        <PreviewBlock title="Besoin de veille"><p>{preview.need_original}</p>{!!preview.clarifications.length && <ul>{preview.clarifications.map(a => <li key={a.question_id}><strong>{a.question}</strong><br/>{a.answer}</li>)}</ul>}</PreviewBlock>
        <PreviewBlock title="Structuration retenue">{preview.structure ? <><p><strong>{preview.structure.title}</strong></p><p>{preview.structure.logic}</p></> : <p>Axes ajoutés directement par le veilleur.</p>}</PreviewBlock>
        <PreviewBlock title="Axes de veille">{preview.axes.map(axis => <div className="qvl-t06-preview-axis" key={axis.axis_id}><div><OriginBadge origin={axis.origin}/><span className={`qvl-t06-status ${statusClass(axis.corpus_status)}`}>{statusLabel(axis.corpus_status)}</span></div><strong>{axis.title}</strong><p>{axis.objective}</p>{axis.questions?.length > 0 && <ul>{axis.questions.map((q, i) => <li key={`${axis.axis_id}-pq-${i}`}>{q}</li>)}</ul>}<SourceList sources={axis.sources || []} compact/></div>)}</PreviewBlock>
        <PreviewBlock title="Grille de guet">{preview.watch.map(axis => <div className="qvl-t06-preview-watch" key={axis.axis_id}><h4>{axis.axis_title}</h4>{axis.trends.map(x => <p key={x.trend_id}><OriginBadge origin="corpus"/> <strong>{x.label}</strong> — {x.synthese}</p>)}{axis.watch_signs.map(x => <p key={x.sign_id}><OriginBadge origin="proposition_ia"/> <strong>{x.label}</strong></p>)}{axis.cluster_hypotheses.map(x => <p key={x.hypothesis_id}><OriginBadge origin="proposition_ia"/> <strong>{x.label}</strong> — {x.interpretation}</p>)}{axis.sources_to_watch.map(x => <p key={x.source_watch_id}><OriginBadge origin={x.origin}/> <strong>Source à suivre :</strong> {x.label}</p>)}{axis.blind_spots.length > 0 && <ul>{axis.blind_spots.map((x, i) => <li key={`${axis.axis_id}-bs-${i}`}>{x}</li>)}</ul>}</div>)}</PreviewBlock>
      </div>
      <ReflexiveLine>Avant l’export : ce scénario correspond-il encore à votre besoin initial ? Les axes « à instruire » sont-ils assumés comme tels ? Les propositions IA vous paraissent-elles réellement observables ?</ReflexiveLine>
      <div className="qvl-t06-next"><button type="button" className="qvl-t06-secondary" onClick={() => setStep(3)}><Icon name="back" size={16}/> Étape précédente</button>{!finalized ? <button type="button" className="qvl-t06-primary" onClick={() => setFinalized(true)}><Icon name="spark" size={16}/> Générer le livrable</button> : <><button type="button" className="qvl-t06-secondary" onClick={() => exportScenarioWord(preview)}><Icon name="file" size={16}/> Exporter Word</button><button type="button" className="qvl-t06-secondary" onClick={() => exportScenarioExcel(preview)}><Icon name="layers" size={16}/> Exporter les données</button></>}</div>
      {finalized && <div className="qvl-t06-final">Le livrable reprend uniquement les éléments que vous avez retenus. La provenance et le statut de chaque proposition sont conservés dans les exports.</div>}
    </section>}
  </div>
}
