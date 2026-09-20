import React, { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { analyzeScenarioFraming, analyzeScenarioAxes, analyzeScenarioDynamics } from '../services/reflectionApi.js'
import { exportScenarioWord, exportScenarioExcel } from '../utils/scenarioExport.js'
import scenarioHero from '../header-corpus-securite.png'
import './scenario-workspace.css'

const STEPS = [
  { id: 1, label: 'Formulation du besoin' },
  { id: 2, label: 'Axes et questions de veille' },
  { id: 3, label: 'Tendances et signaux' },
  { id: 4, label: 'Prévisualisation et génération' },
]

const clip = (value, max = 420) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, '')}…`
}

function sourceUrl(source = {}) {
  const raw = String(source.url || '').trim()
  if (!raw) return ''
  const locator = String(source.repere || source.locator || '').trim()
  if (/\.pdf(?:$|[?#])/i.test(raw) && /^\d+$/.test(locator)) return `${raw.split('#')[0]}#page=${locator}`
  return raw
}

function sourceLabel(source = {}) {
  return [source.titre || source.title, source.organisme_producteur || source.organisation, source.annee_publication || source.year, (source.repere || source.locator) ? `repère ${source.repere || source.locator}` : ''].filter(Boolean).join(' · ')
}

function normalizeSource(source = {}) {
  return {
    material_id: source.material_id || '',
    publication_id: source.publication_id || '',
    title: source.titre || source.title || '',
    organisation: source.organisme_producteur || source.organisation || '',
    year: source.annee_publication || source.year || '',
    type_document: source.type_document || '',
    locator: source.repere || source.locator || '',
    provenance: source.provenance_level || source.provenance || '',
    url: source.url || '',
    excerpt: source.extrait || source.excerpt || '',
    origin: source.origin || 'corpus',
  }
}

function SourceList({ sources = [] }) {
  if (!sources.length) return null
  return <details className="qvl-scn-sources">
    <summary>{sources.length === 1 ? 'Voir la source' : `Voir les ${sources.length} sources`}</summary>
    <div className="qvl-scn-source-list">
      {sources.map((source, index) => {
        const href = sourceUrl(source)
        return <div className="qvl-scn-source-item" key={`${source.material_id || source.publication_id || index}-${index}`}>
          <strong>{sourceLabel(source)}</strong>
          <div className="qvl-scn-source-meta">
            {source.provenance_level && <span>Provenance {source.provenance_level}</span>}
            {source.kind && <span>{source.kind}</span>}
          </div>
          {source.extrait && <p>{clip(source.extrait, 520)}</p>}
          {href && <a href={href} target="_blank" rel="noreferrer"><Icon name="external" size={14}/> Ouvrir la source</a>}
        </div>
      })}
    </div>
  </details>
}

function DecisionButtons({ selected, discarded, onSelect, onDiscard, onUseToRefine, refining }) {
  return <div className="qvl-scn-actions">
    <button type="button" className={selected ? 'active' : ''} onClick={onSelect}>{selected ? '✓ Retenu' : 'Retenir'}</button>
    {onUseToRefine && <button type="button" className={refining ? 'active' : ''} onClick={onUseToRefine}>{refining ? '✓ Mobilisé pour préciser' : 'Utiliser pour préciser mon besoin'}</button>}
    {onDiscard && <button type="button" className={discarded ? 'danger active' : 'danger'} onClick={onDiscard}>{discarded ? 'Écarté' : 'Écarter'}</button>}
  </div>
}

function FramingCard({ notion, selected, discarded, refining, onSelect, onDiscard, onUseToRefine }) {
  return <article className={`qvl-scn-card framing ${selected ? 'selected' : ''} ${discarded ? 'discarded' : ''}`}>
    <div className="qvl-scn-card-head"><span>Notion de cadrage</span><b>{notion.statut === 'partiel' ? 'Synthèse partielle du corpus' : 'Synthèse du corpus'}</b></div>
    <h3>{notion.label}</h3>
    {notion.dimension_eclairee && <p className="qvl-scn-dimension">Dimension éclairée : {notion.dimension_eclairee}</p>}
    <div className="qvl-scn-rationale">
      <strong>Pourquoi cette notion est proposée</strong>
      <p>{notion.pourquoi}</p>
      {notion.limite && <p className="qvl-scn-limit"><strong>Limite :</strong> {notion.limite.replace(/^Limite\s*:\s*/i, '')}</p>}
    </div>
    <SourceList sources={notion.sources || []}/>
    <DecisionButtons selected={selected} discarded={discarded} refining={refining} onSelect={onSelect} onDiscard={onDiscard} onUseToRefine={onUseToRefine}/>
  </article>
}

function AxisCard({ axis, selected, onToggle }) {
  return <article className={`qvl-scn-card axis ${selected ? 'selected' : ''}`}>
    <div className="qvl-scn-card-head"><span>Axe de veille</span><b>{axis.statut === 'partiel' ? 'Synthèse partielle du corpus' : 'Synthèse du corpus'}</b></div>
    <h3>{axis.titre}</h3>
    <p className="qvl-scn-objective">{axis.objectif_surveillance}</p>
    <div className="qvl-scn-rationale compact"><strong>Pourquoi cet axe ?</strong><p>{axis.pourquoi}</p>{axis.limite && <p className="qvl-scn-limit"><strong>Limite :</strong> {axis.limite}</p>}</div>
    <div className="qvl-scn-questions"><strong>Questions de veille proposées</strong><ul>{(axis.questions || []).map((q, i) => <li key={`${axis.axis_id}-q-${i}`}>{q}</li>)}</ul></div>
    <SourceList sources={axis.sources || []}/>
    <div className="qvl-scn-actions"><button type="button" className={selected ? 'active' : ''} onClick={onToggle}>{selected ? '✓ Axe retenu' : 'Retenir cet axe'}</button></div>
  </article>
}

function DynamicCard({ kind, item, selected, onToggle, signMap }) {
  const title = kind === 'trend' ? 'Tendance' : kind === 'sign' ? 'Signe de changement' : 'Signal faible'
  return <article className={`qvl-scn-dynamic-card ${kind} ${selected ? 'selected' : ''}`}>
    <div className="qvl-scn-card-head"><span>{title}</span><b>Synthèse du corpus</b></div>
    <h4>{item.label}</h4>
    {item.interpretation && <p className="qvl-scn-interpretation">{item.interpretation}</p>}
    <div className="qvl-scn-rationale compact"><strong>Pourquoi cette qualification ?</strong><p>{item.pourquoi}</p>{item.limite && <p className="qvl-scn-limit"><strong>Limite :</strong> {item.limite}</p>}</div>
    {kind === 'weak' && item.based_on_sign_ids?.length > 0 && <div className="qvl-scn-cluster"><strong>Signes de changement regroupés</strong><ul>{item.based_on_sign_ids.map(id => <li key={id}>{signMap?.get(id)?.label || id}</li>)}</ul></div>}
    <SourceList sources={item.sources || []}/>
    <button type="button" className={`qvl-scn-retain ${selected ? 'active' : ''}`} onClick={onToggle}>{selected ? '✓ Retenu' : 'Retenir'}</button>
  </article>
}

function ReflexiveLine({ children }) {
  return <div className="qvl-scn-reflexive"><Icon name="info" size={16}/><span>{children}</span></div>
}

function CoverageList({ items = [], title = 'Dimensions encore peu couvertes dans les matériaux retrouvés' }) {
  if (!items.length) return null
  return <div className="qvl-scn-coverage"><strong>{title}</strong><ul>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div>
}

function PreviewBlock({ n, title, children }) {
  return <article className="qvl-scn-preview-block"><div className="qvl-scn-preview-title"><span>{n}</span><h3>{title}</h3></div>{children}</article>
}

export default function ScenarioWorkspace({ onBack }) {
  const [step, setStep] = useState(1)
  const [need, setNeed] = useState('')
  const [workingNeed, setWorkingNeed] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [framing, setFraming] = useState(null)
  const [axesData, setAxesData] = useState(null)
  const [dynamicsData, setDynamicsData] = useState(null)
  const [selectedNotions, setSelectedNotions] = useState(new Set())
  const [discardedNotions, setDiscardedNotions] = useState(new Set())
  const [refineNotions, setRefineNotions] = useState(new Set())
  const [selectedAxes, setSelectedAxes] = useState(new Set())
  const [selectedDynamics, setSelectedDynamics] = useState(new Set())
  const [finalized, setFinalized] = useState(false)

  const activeNeed = workingNeed.trim() || need.trim()

  const resetAfterNeedChange = value => {
    setNeed(value)
    setFraming(null); setAxesData(null); setDynamicsData(null)
    setSelectedNotions(new Set()); setDiscardedNotions(new Set()); setRefineNotions(new Set()); setSelectedAxes(new Set()); setSelectedDynamics(new Set())
    setFinalized(false); setStep(1); setError('')
  }

  const runFraming = async () => {
    if (!need.trim() || loading) return
    setLoading(true); setError(''); setFinalized(false)
    try {
      const result = await analyzeScenarioFraming(need.trim())
      setFraming(result); setWorkingNeed(need.trim()); setStep(1)
      setSelectedNotions(new Set()); setDiscardedNotions(new Set()); setRefineNotions(new Set())
    } catch (e) { setError(e?.message || String(e)) }
    finally { setLoading(false) }
  }

  const buildAxes = async () => {
    if (!activeNeed || loading) return
    setLoading(true); setError('')
    try {
      const notions = (framing?.notions || []).filter(n => selectedNotions.has(n.notion_id)).map(n => ({ label: n.label, pourquoi: n.pourquoi, limite: n.limite }))
      const result = await analyzeScenarioAxes(activeNeed, notions)
      setAxesData(result); setSelectedAxes(new Set()); setDynamicsData(null); setSelectedDynamics(new Set()); setStep(2)
    } catch (e) { setError(e?.message || String(e)) }
    finally { setLoading(false) }
  }

  const buildDynamics = async () => {
    const axes = (axesData?.axes || []).filter(a => selectedAxes.has(a.axis_id))
    if (!axes.length) { setError('Retenez au moins un axe de veille avant de poursuivre.'); return }
    setLoading(true); setError('')
    try {
      const result = await analyzeScenarioDynamics(activeNeed, axes.map(a => ({ axis_id:a.axis_id, titre:a.titre, objectif_surveillance:a.objectif_surveillance })))
      setDynamicsData(result); setSelectedDynamics(new Set()); setStep(3)
    } catch (e) { setError(e?.message || String(e)) }
    finally { setLoading(false) }
  }

  const toggleSet = (setter, id) => setter(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  const toggleNotionRetain = id => {
    setSelectedNotions(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
    setDiscardedNotions(prev => { const next = new Set(prev); next.delete(id); return next })
  }
  const toggleNotionRefine = id => {
    setRefineNotions(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
    setDiscardedNotions(prev => { const next = new Set(prev); next.delete(id); return next })
  }
  const toggleNotionDiscard = id => {
    const willDiscard = !discardedNotions.has(id)
    setDiscardedNotions(prev => { const next = new Set(prev); willDiscard ? next.add(id) : next.delete(id); return next })
    if (willDiscard) {
      setSelectedNotions(prev => { const next = new Set(prev); next.delete(id); return next })
      setRefineNotions(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  const preview = useMemo(() => {
    const notions = (framing?.notions || []).filter(n => selectedNotions.has(n.notion_id))
    const axes = (axesData?.axes || []).filter(a => selectedAxes.has(a.axis_id))
    const dynamics = (dynamicsData?.axes || []).map(axis => ({
      axis_id: axis.axis_id,
      axis_title: axis.titre,
      trends: (axis.tendances || []).filter(x => selectedDynamics.has(x.trend_id)),
      changes: (axis.signes_changement || []).filter(x => selectedDynamics.has(x.sign_id)),
      weak_signals: (axis.signaux_faibles || []).filter(x => selectedDynamics.has(x.weak_id)),
      coverage_limits: axis.limites_couverture || [],
    })).filter(a => axes.some(x => x.axis_id === a.axis_id))

    const allSources = []
    const seen = new Set()
    const addSources = sources => (sources || []).forEach(source => {
      const normalized = normalizeSource(source)
      const key = `${normalized.material_id}|${normalized.publication_id}|${normalized.locator}`
      if (!seen.has(key)) { seen.add(key); allSources.push(normalized) }
    })
    notions.forEach(n => addSources(n.sources)); axes.forEach(a => addSources(a.sources)); dynamics.forEach(d => { d.trends.forEach(x=>addSources(x.sources)); d.changes.forEach(x=>addSources(x.sources)); d.weak_signals.forEach(x=>addSources(x.sources)) })

    return {
      need_original: need.trim(), need_working: activeNeed,
      formulation_items: notions.map(n => ({ id:n.notion_id, title:n.label, why:n.pourquoi, limit:n.limite, sources:(n.sources||[]).map(normalizeSource) })),
      axes: axes.map(a => ({ id:a.axis_id, title:a.titre, objective:a.objectif_surveillance, why:a.pourquoi, limit:a.limite, questions:a.questions || [], sources:(a.sources||[]).map(normalizeSource) })),
      questions: axes.flatMap(a => a.questions || []), dynamics, sources: allSources,
      coverage_limits: [...new Set([...(framing?.limites_couverture || []), ...(axesData?.limites_couverture || []), ...dynamics.flatMap(d => d.coverage_limits || [])])],
    }
  }, [framing, axesData, dynamicsData, selectedNotions, selectedAxes, selectedDynamics, need, activeNeed])

  return <main className="qvl-scn-page">
    <div className="qvl-scn-back"><button type="button" onClick={onBack}><Icon name="back" size={15}/> Retour à l’atelier</button></div>

    <header className="qvl-scn-hero">
      <div><span>ATELIER DE VEILLE</span><h1>Scénario de veille</h1><p>Du besoin exprimé par le veilleur à un livrable structuré, construit à partir de ses choix et du corpus.</p></div>
      <img src={scenarioHero} alt="" />
    </header>

    <nav className="qvl-scn-steps" aria-label="Étapes du scénario de veille">
      {STEPS.map(s => <div key={s.id} className={`${step === s.id ? 'active' : ''} ${step > s.id ? 'done' : ''}`}><span>{s.id}</span><strong>{s.label}</strong></div>)}
    </nav>

    {error && <div className="qvl-scn-error">{error}</div>}
    {loading && <div className="qvl-scn-loading"><span className="qvl-scn-spinner"/> Quiritès analyse le corpus…</div>}

    {step === 1 && <section className="qvl-scn-section">
      <label className="qvl-scn-label">Votre besoin de veille</label>
      <div className="qvl-scn-need-row"><textarea value={need} onChange={e => resetAfterNeedChange(e.target.value)} placeholder="Décrivez librement ce que vous souhaitez mettre en veille…"/><button type="button" className="qvl-scn-primary" onClick={runFraming} disabled={!need.trim() || loading}><Icon name="search" size={17}/> Voir ce que le corpus met à disposition</button></div>

      {framing && <>
        <div className="qvl-scn-section-title"><h2>Les notions du corpus qui peuvent préciser votre besoin</h2><p>Quiritès synthétise des notions de cadrage à partir de plusieurs matériaux. Chaque proposition reste reliée aux sources qui la soutiennent.</p></div>
        {(framing.notions || []).length ? <div className="qvl-scn-grid two">{framing.notions.map(n => <FramingCard key={n.notion_id} notion={n} selected={selectedNotions.has(n.notion_id)} discarded={discardedNotions.has(n.notion_id)} refining={refineNotions.has(n.notion_id)} onSelect={() => toggleNotionRetain(n.notion_id)} onDiscard={() => toggleNotionDiscard(n.notion_id)} onUseToRefine={() => toggleNotionRefine(n.notion_id)}/>)}</div> : <div className="qvl-scn-no-match"><strong>Aucune notion suffisamment utile n’a été retenue.</strong><span>Vous pouvez poursuivre avec votre formulation initiale : l’étape suivante cherchera directement des axes de veille.</span></div>}
        <CoverageList items={framing.limites_couverture || []}/>
        {refineNotions.size > 0 && <div className="qvl-scn-refine"><label>Précisez votre besoin si vous le souhaitez</label><p>Les notions sélectionnées sont des appuis : Quiritès ne modifie pas votre formulation à votre place.</p><textarea value={workingNeed} onChange={e => setWorkingNeed(e.target.value)}/><div className="qvl-scn-tags">{(framing.notions || []).filter(n => refineNotions.has(n.notion_id)).map(n => <span key={n.notion_id}>{n.label}</span>)}</div></div>}
        <ReflexiveLine>Ces notions structurent-elles réellement votre besoin, ou le corpus vous entraîne-t-il vers ce qu’il documente le mieux ?</ReflexiveLine>
        <div className="qvl-scn-next"><button type="button" className="qvl-scn-primary" onClick={buildAxes} disabled={loading}>Construire les axes de veille <Icon name="chevron" size={16}/></button></div>
      </>}
    </section>}

    {step === 2 && <section className="qvl-scn-section">
      <div className="qvl-scn-current-need"><strong>Besoin de veille</strong><span>{activeNeed}</span></div>
      <div className="qvl-scn-section-title"><h2>Axes et questions de veille proposés à partir du corpus</h2><p>Les axes sont des synthèses documentaires : ils montent au-dessus des sources pour organiser ce qu’il serait utile de surveiller.</p></div>
      {(axesData?.axes || []).length ? <div className="qvl-scn-grid two">{axesData.axes.map(axis => <AxisCard key={axis.axis_id} axis={axis} selected={selectedAxes.has(axis.axis_id)} onToggle={() => toggleSet(setSelectedAxes, axis.axis_id)}/>)}</div> : <div className="qvl-scn-no-match"><strong>Aucun axe suffisamment solide n’a été proposé.</strong><span>Le corpus peut être trop peu documenté pour structurer ce besoin sans élargissement artificiel.</span></div>}
      <CoverageList items={axesData?.limites_couverture || []}/>
      <ReflexiveLine>Ces axes correspondent-ils à ce que vous voulez vraiment surveiller ? Vérifiez notamment qu’ils ne reflètent pas seulement les sujets les mieux couverts par le corpus.</ReflexiveLine>
      <div className="qvl-scn-next"><button className="qvl-scn-secondary" type="button" onClick={() => setStep(1)}><Icon name="back" size={16}/> Étape précédente</button><button className="qvl-scn-primary" type="button" onClick={buildDynamics} disabled={loading || selectedAxes.size === 0}>Analyser tendances et signaux <Icon name="chevron" size={16}/></button></div>
    </section>}

    {step === 3 && <section className="qvl-scn-section">
      <div className="qvl-scn-current-need"><strong>Besoin de veille</strong><span>{activeNeed}</span></div>
      <div className="qvl-scn-method"><div><span>Enrichissement contrôlé</span><strong>{dynamicsData?.methodological_reference?.label || 'ESPAS Horizon Scanning — communauté des veilleurs de l’Union européenne'}</strong></div><p>{dynamicsData?.methodological_reference?.usage || 'Repère méthodologique pour questionner tendances, signes de changement et signaux faibles ; il ne constitue pas une preuve documentaire du scénario.'}</p><a href={dynamicsData?.methodological_reference?.url || 'https://espas.eu/horizon.html'} target="_blank" rel="noreferrer"><Icon name="external" size={14}/> Ouvrir ESPAS Horizon</a></div>
      <div className="qvl-scn-section-title"><h2>Tendances, signes de changement et signaux faibles</h2><p>La lecture se fait axe par axe. Les qualifications sont des synthèses IA strictement fondées sur les sources affichées.</p></div>

      {(dynamicsData?.axes || []).map(axis => {
        const signMap = new Map((axis.signes_changement || []).map(s => [s.sign_id, s]))
        return <section className="qvl-scn-axis-dynamics" key={axis.axis_id}>
          <h3>{axis.titre}</h3>
          <div className="qvl-scn-dynamics-layout">
            <div><h4 className="qvl-scn-kind-title trend">Tendances</h4>{(axis.tendances || []).length ? axis.tendances.map(item => <DynamicCard key={item.trend_id} kind="trend" item={item} selected={selectedDynamics.has(item.trend_id)} onToggle={() => toggleSet(setSelectedDynamics, item.trend_id)}/>) : <p className="qvl-scn-empty">Aucune tendance suffisamment étayée.</p>}</div>
            <div><h4 className="qvl-scn-kind-title sign">Signes de changement</h4>{(axis.signes_changement || []).length ? axis.signes_changement.map(item => <DynamicCard key={item.sign_id} kind="sign" item={item} selected={selectedDynamics.has(item.sign_id)} onToggle={() => toggleSet(setSelectedDynamics, item.sign_id)}/>) : <p className="qvl-scn-empty">Aucun signe de changement suffisamment étayé.</p>}</div>
            <div><h4 className="qvl-scn-kind-title weak">Signaux faibles</h4>{(axis.signaux_faibles || []).length ? axis.signaux_faibles.map(item => <DynamicCard key={item.weak_id} kind="weak" item={item} signMap={signMap} selected={selectedDynamics.has(item.weak_id)} onToggle={() => toggleSet(setSelectedDynamics, item.weak_id)}/>) : <p className="qvl-scn-empty">Aucun cluster de signes suffisamment cohérent pour qualifier un signal faible.</p>}</div>
          </div>
          <CoverageList items={axis.limites_couverture || []} title="Ce que le corpus documente encore mal sur cet axe"/>
          <ReflexiveLine>La qualification est-elle convaincante au regard des dates, de la diversité des sources et du nombre de matériaux mobilisés ?</ReflexiveLine>
        </section>
      })}
      <div className="qvl-scn-next"><button className="qvl-scn-secondary" type="button" onClick={() => setStep(2)}><Icon name="back" size={16}/> Étape précédente</button><button className="qvl-scn-primary" type="button" onClick={() => setStep(4)}>Prévisualiser mon scénario <Icon name="chevron" size={16}/></button></div>
    </section>}

    {step === 4 && <section className="qvl-scn-section">
      <div className="qvl-scn-section-title"><h2>Prévisualisation du scénario</h2><p>Le livrable assemble uniquement votre besoin et les éléments que vous avez choisi de retenir.</p></div>
      <div className="qvl-scn-preview">
        <PreviewBlock n="1" title="Besoin de veille"><p>{preview.need_working}</p>{preview.need_working !== preview.need_original && <small>Besoin initial : {preview.need_original}</small>}</PreviewBlock>
        <PreviewBlock n="2" title="Notions de cadrage">{preview.formulation_items.length ? <ul>{preview.formulation_items.map(x => <li key={x.id}><strong>{x.title}</strong><span>{x.limit}</span></li>)}</ul> : <p>Aucune notion retenue.</p>}</PreviewBlock>
        <PreviewBlock n="3" title="Axes et questions de veille">{preview.axes.length ? preview.axes.map(axis => <div className="qvl-scn-preview-axis" key={axis.id}><strong>{axis.title}</strong><p>{axis.objective}</p><ul>{axis.questions.map((q,i)=><li key={`${axis.id}-${i}`}>{q}</li>)}</ul></div>) : <p>Aucun axe retenu.</p>}</PreviewBlock>
        <PreviewBlock n="4" title="Tendances et signaux">{preview.dynamics.length ? preview.dynamics.map(axis => <div className="qvl-scn-preview-axis" key={axis.axis_id}><strong>{axis.axis_title}</strong>{axis.trends.map(x=><p key={x.trend_id}><b>Tendance — </b>{x.label}</p>)}{axis.changes.map(x=><p key={x.sign_id}><b>Signe de changement — </b>{x.label}</p>)}{axis.weak_signals.map(x=><p key={x.weak_id}><b>Signal faible — </b>{x.label}</p>)}</div>) : <p>Aucun élément dynamique retenu.</p>}</PreviewBlock>
        <PreviewBlock n="5" title="Angles morts et limites documentaires"><CoverageList items={preview.coverage_limits}/></PreviewBlock>
        <PreviewBlock n="6" title="Sources mobilisées">{preview.sources.length ? <ul>{preview.sources.map((s,i)=><li key={`${s.material_id}-${i}`}><strong>{sourceLabel(s)}</strong>{sourceUrl(s)&&<a href={sourceUrl(s)} target="_blank" rel="noreferrer">Ouvrir</a>}</li>)}</ul> : <p>Aucune source retenue.</p>}</PreviewBlock>
      </div>
      <ReflexiveLine>Avant de générer, relisez le scénario comme un livrable humain : les généralisations vous paraissent-elles proportionnées aux preuves et les angles morts suffisamment visibles ?</ReflexiveLine>
      <div className="qvl-scn-next"><button className="qvl-scn-secondary" type="button" onClick={() => setStep(3)}><Icon name="back" size={16}/> Étape précédente</button>{!finalized ? <button className="qvl-scn-primary" type="button" onClick={() => setFinalized(true)}><Icon name="spark" size={16}/> Générer le livrable</button> : <><button className="qvl-scn-secondary" type="button" onClick={() => exportScenarioWord(preview)}><Icon name="file" size={16}/> Exporter Word</button><button className="qvl-scn-secondary" type="button" onClick={() => exportScenarioExcel(preview)}><Icon name="layers" size={16}/> Exporter les données</button></>}</div>
      {finalized && <div className="qvl-scn-final">Scénario généré à partir de votre sélection. Vous pouvez revenir aux étapes précédentes pour modifier vos choix puis générer à nouveau.</div>}
    </section>}
  </main>
}
