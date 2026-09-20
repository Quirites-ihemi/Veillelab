import React, { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { searchCorpus } from '../services/reflectionApi.js'
import { exportScenarioWord, exportScenarioExcel } from '../utils/scenarioExport.js'
import './scenario-workspace.css'

const STEPS = [
  { id: 1, label: 'Formulation du besoin' },
  { id: 2, label: 'Objets de veille' },
  { id: 3, label: 'Tendances et signaux' },
  { id: 4, label: 'Prévisualisation et génération' },
]

const OBJECT_TYPE_LABELS = {
  acteur: 'Acteur',
  expert_public: 'Acteur',
  localisation: 'Territoire',
  instrument_dispositif: 'Dispositif',
  action: 'Action / dispositif',
  probleme: 'Problème',
  notion_idee: 'Notion',
  recommandation: 'Réponse publique',
  methode: 'Méthode',
}

const CHANGE_WORDS = /(émerg|evolu|évolu|hausse|baisse|augmentation|diminution|apparition|diffusion|renforcement|accélération|acceleration|mutation|nouveau|nouvelle|croissan|recul|essor|développement|developpement|progression|déplacement|deplacement)/i

function normalize(value='') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function clip(text, max=260) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  if (value.length <= max) return value
  return `${value.slice(0, max).replace(/\s+\S*$/, '')}…`
}

function sentenceTitle(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  if (!value) return 'Élément documentaire'
  const first = value.split(/(?<=[.!?])\s+/)[0]
  return clip(first, 120)
}

function resultSource(result) {
  return {
    publication_id: result.publication_id || '',
    title: result.publication_title || result.publication_id || 'Source',
    organisation: result.organisme_producteur || '',
    year: result.annee_publication || '',
    locator: result.locator || result.page_debut || '',
    url: result.url_contenu || result.url_source || '',
    provenance: result.provenance_level || '',
    chunk_id: result.chunk_id || result.chunk_id_source || '',
  }
}

function resultToItem(result, forcedCategory='') {
  const source = resultSource(result)
  if (result.kind === 'node') {
    return {
      id: result.result_id,
      category: forcedCategory || OBJECT_TYPE_LABELS[result.node_type] || 'Élément du corpus',
      nodeType: result.node_type || '',
      title: result.label || 'Élément du corpus',
      summary: result.publication_title ? `Élément structuré dans ${result.publication_title}.` : '',
      text: result.label || '',
      source,
      origin: 'corpus',
      raw: result,
    }
  }
  if (result.kind === 'relation') {
    return {
      id: result.result_id,
      category: forcedCategory || 'Relation documentée',
      nodeType: '',
      title: `${result.source_label || result.source_id} — ${result.relation_type || 'LIEN'} — ${result.target_label || result.target_id}`,
      summary: 'Relation structurée dans le graphe de connaissances.',
      text: `${result.source_label || ''} ${result.relation_type || ''} ${result.target_label || ''}`.trim(),
      source,
      origin: 'corpus',
      raw: result,
    }
  }
  return {
    id: result.result_id,
    category: forcedCategory || 'Élément documentaire',
    nodeType: '',
    title: result.section ? result.section : sentenceTitle(result.text),
    summary: clip(result.text, 280),
    text: result.text || '',
    source,
    origin: 'corpus',
    raw: result,
  }
}

function dedupe(items=[]) {
  const out = []
  const seen = new Set()
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

function sourceUrl(source) {
  const raw = String(source?.url || '').trim()
  if (!raw) return ''
  if (/\.pdf(?:$|[?#])/i.test(raw) && /^\d+$/.test(String(source?.locator || '').trim())) {
    return `${raw.split('#')[0]}#page=${source.locator}`
  }
  return raw
}

function sourceLabel(source) {
  const parts = [source.title, source.organisation, source.year].filter(Boolean)
  if (source.locator) parts.push(`repère ${source.locator}`)
  return parts.join(' · ')
}

function ProposalCard({ item, retained, discarded, reformulation, onRetain, onDiscard, onReformulate }) {
  const href = sourceUrl(item.source)
  return <article className={`qvl-scn-card ${retained ? 'retained' : ''} ${discarded ? 'discarded' : ''}`}>
    <div className="qvl-scn-card-top">
      <span className="qvl-scn-type">{item.category}</span>
      <span className={`qvl-scn-origin ${item.origin === 'enrichment' ? 'enrich' : ''}`}>{item.origin === 'enrichment' ? 'Enrichissement contrôlé' : 'Corpus'}</span>
    </div>
    <h3>{item.title}</h3>
    {item.summary && <p>{item.summary}</p>}
    <div className="qvl-scn-source">
      <strong>{item.origin === 'enrichment' ? item.source.title : sourceLabel(item.source)}</strong>
      {item.source.provenance && <span>provenance {item.source.provenance}</span>}
      {href && <a href={href} target="_blank" rel="noreferrer"><Icon name="external" size={14}/> Ouvrir la source</a>}
    </div>
    <div className="qvl-scn-card-actions">
      <button type="button" className={retained ? 'active' : ''} onClick={() => onRetain(item.id)}>{retained ? '✓ Retenu' : 'Retenir'}</button>
      {onReformulate && <button type="button" className={reformulation ? 'active' : ''} onClick={() => onReformulate(item.id)}>{reformulation ? '✓ Pour reformulation' : 'Reformuler le besoin'}</button>}
      <button type="button" className={discarded ? 'danger active' : 'danger'} onClick={() => onDiscard(item.id)}>{discarded ? 'Écarté' : 'Écarter'}</button>
    </div>
  </article>
}

function SelectionCard({ item, retained, onToggle }) {
  const href = sourceUrl(item.source)
  return <article className={`qvl-scn-select-card ${retained ? 'retained' : ''}`}>
    <div className="qvl-scn-card-top"><span className="qvl-scn-type">{item.category}</span><span className="qvl-scn-origin">Corpus</span></div>
    <h3>{item.title}</h3>
    {item.summary && <p>{item.summary}</p>}
    <div className="qvl-scn-source"><strong>{sourceLabel(item.source)}</strong>{href && <a href={href} target="_blank" rel="noreferrer"><Icon name="external" size={14}/> Source</a>}</div>
    <button type="button" className={`qvl-scn-retain ${retained ? 'active' : ''}`} onClick={() => onToggle(item.id)}>{retained ? '✓ Retenu' : 'Retenir'}</button>
  </article>
}

function buildQuestions(need, objects) {
  const out = []
  const main = String(need || '').trim()
  if (main) out.push(main.endsWith('?') ? main : `Comment suivre les évolutions liées à : ${main.replace(/[.]+$/, '')} ?`)
  objects.slice(0, 4).forEach(item => out.push(`Que faut-il surveiller concernant « ${item.title} » ?`))
  return [...new Set(out)].slice(0, 5)
}

function groupSelected(items, selectedSet) {
  return items.filter(item => selectedSet.has(item.id))
}

export default function ScenarioWorkspace({ data, onBack }) {
  const [step, setStep] = useState(1)
  const [need, setNeed] = useState('')
  const [workingNeed, setWorkingNeed] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [generalResults, setGeneralResults] = useState([])
  const [nodeResults, setNodeResults] = useState([])
  const [trendResults, setTrendResults] = useState([])
  const [signalResults, setSignalResults] = useState([])
  const [retained, setRetained] = useState(new Set())
  const [discarded, setDiscarded] = useState(new Set())
  const [reformulationRefs, setReformulationRefs] = useState(new Set())
  const [finalized, setFinalized] = useState(false)

  const activeNeed = workingNeed.trim() || need.trim()

  const espasItem = useMemo(() => ({
    id: 'enrichment:espas-horizon',
    category: 'Ressource méthodologique',
    title: 'ESPAS Horizon Scanning — communauté des veilleurs de l’Union européenne',
    summary: 'Ressource externe proposée pour élargir, si vous le souhaitez, le regard porté sur les tendances et les changements émergents.',
    origin: 'enrichment',
    source: { title: 'ESPAS Horizon', organisation: 'European Strategy and Policy Analysis System', year: '', locator: '', url: 'https://espas.eu/horizon.html', provenance: '' },
  }), [])

  const runSearch = async () => {
    const query = need.trim()
    if (!query || loading) return
    setLoading(true)
    setError('')
    setFinalized(false)
    try {
      const [general, nodes, trends, signals] = await Promise.all([
        searchCorpus(query, { limit: 18, maxPerPublication: 3 }),
        searchCorpus(query, { kinds: ['node'], limit: 36, maxPerPublication: 6 }),
        searchCorpus(`${query} tendance évolution émergence`, { kinds: ['node', 'chunk'], limit: 30, maxPerPublication: 5 }),
        searchCorpus(`${query} signal faible signe de changement`, { kinds: ['node', 'chunk'], limit: 30, maxPerPublication: 5 }),
      ])
      setGeneralResults(general?.results || [])
      setNodeResults(nodes?.results || [])
      setTrendResults(trends?.results || [])
      setSignalResults(signals?.results || [])
      setWorkingNeed(query)
      setRetained(new Set())
      setDiscarded(new Set())
      setReformulationRefs(new Set())
      setSearched(true)
      setStep(1)
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  const formulationItems = useMemo(() => {
    const priorityNodes = nodeResults
      .filter(r => ['acteur', 'expert_public', 'notion_idee', 'probleme', 'instrument_dispositif', 'action', 'localisation', 'tendance', 'signal_faible'].includes(r.node_type))
      .map(r => resultToItem(r))
    const docs = generalResults.map(r => resultToItem(r))
    return [...dedupe([...priorityNodes, ...docs]).slice(0, 7), espasItem]
  }, [nodeResults, generalResults, espasItem])

  const objectItems = useMemo(() => {
    const allowed = nodeResults
      .filter(r => !['tendance', 'signal_faible'].includes(r.node_type))
      .map(r => resultToItem(r))
    const retainedForm = formulationItems.filter(item => retained.has(item.id) && item.origin === 'corpus' && !['Tendance', 'Signal faible'].includes(item.category))
    return dedupe([...retainedForm, ...allowed]).slice(0, 18)
  }, [nodeResults, formulationItems, retained])

  const trendItems = useMemo(() => dedupe([
    ...nodeResults.filter(r => r.node_type === 'tendance').map(r => resultToItem(r, 'Tendance')),
    ...trendResults.filter(r => r.kind === 'node' && r.node_type === 'tendance').map(r => resultToItem(r, 'Tendance')),
  ]).slice(0, 10), [nodeResults, trendResults])

  const weakSignalItems = useMemo(() => dedupe([
    ...nodeResults.filter(r => r.node_type === 'signal_faible').map(r => resultToItem(r, 'Signal faible')),
    ...signalResults.filter(r => r.kind === 'node' && r.node_type === 'signal_faible').map(r => resultToItem(r, 'Signal faible')),
  ]).slice(0, 10), [nodeResults, signalResults])

  const changeItems = useMemo(() => {
    const excluded = new Set([...trendItems, ...weakSignalItems].map(i => i.id))
    const raw = dedupe([...trendResults, ...signalResults]
      .filter(r => !excluded.has(r.result_id))
      .filter(r => {
        const text = r.kind === 'chunk' ? r.text : r.kind === 'node' ? r.label : `${r.source_label} ${r.relation_type} ${r.target_label}`
        return CHANGE_WORDS.test(text || '')
      })
      .map(r => resultToItem(r, 'Signe de changement')))
    return raw.slice(0, 10)
  }, [trendResults, signalResults, trendItems, weakSignalItems])

  const selectedObjects = useMemo(() => groupSelected(objectItems, retained), [objectItems, retained])
  const selectedTrends = useMemo(() => groupSelected(trendItems, retained), [trendItems, retained])
  const selectedChanges = useMemo(() => groupSelected(changeItems, retained), [changeItems, retained])
  const selectedWeakSignals = useMemo(() => groupSelected(weakSignalItems, retained), [weakSignalItems, retained])
  const selectedFormulation = useMemo(() => formulationItems.filter(i => retained.has(i.id)), [formulationItems, retained])

  const toggleRetain = id => {
    setRetained(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
    setDiscarded(prev => { const next = new Set(prev); next.delete(id); return next })
    setFinalized(false)
  }
  const toggleDiscard = id => {
    setDiscarded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
    setRetained(prev => { const next = new Set(prev); next.delete(id); return next })
    setReformulationRefs(prev => { const next = new Set(prev); next.delete(id); return next })
    setFinalized(false)
  }
  const toggleReformulation = id => {
    setReformulationRefs(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const preview = useMemo(() => {
    const sourceItems = dedupe([...selectedFormulation, ...selectedObjects, ...selectedTrends, ...selectedChanges, ...selectedWeakSignals])
    const sources = []
    const seen = new Set()
    sourceItems.forEach(item => {
      const key = item.origin === 'enrichment' ? item.id : `${item.source.publication_id}|${item.source.locator}`
      if (!key || seen.has(key)) return
      seen.add(key)
      sources.push({ ...item.source, origin: item.origin, item_title: item.title })
    })
    return {
      need_original: need.trim(),
      need_working: activeNeed,
      formulation_items: selectedFormulation,
      objects: selectedObjects,
      trends: selectedTrends,
      changes: selectedChanges,
      weak_signals: selectedWeakSignals,
      questions: buildQuestions(activeNeed, selectedObjects),
      sources,
    }
  }, [need, activeNeed, selectedFormulation, selectedObjects, selectedTrends, selectedChanges, selectedWeakSignals])

  const canGo = searched && !loading

  return <main className="page qvl-scenario-v01">
    <button className="back-link" onClick={onBack}><Icon name="back"/>Retour à l’atelier</button>
    <header className="qvl-scn-head">
      <h1>Scénario de veille</h1>
      <p>Du besoin exprimé par le veilleur à un livrable structuré, construit à partir de ses choix et du corpus.</p>
    </header>

    <nav className="qvl-scn-nav" aria-label="Étapes du scénario de veille">
      {STEPS.map(s => <button key={s.id} type="button" className={step === s.id ? 'active' : ''} disabled={s.id > 1 && !canGo} onClick={() => setStep(s.id)}><span>{s.id}</span>{s.label}</button>)}
    </nav>

    {step === 1 && <section className="qvl-scn-section">
      <div className="qvl-scn-need">
        <label>Votre besoin de veille</label>
        <textarea value={need} onChange={e => { setNeed(e.target.value); setSearched(false); setFinalized(false) }} placeholder="Décrivez librement ce que vous souhaitez mettre en veille, pourquoi et pour qui…"/>
        <button type="button" className="qvl-scn-primary" onClick={runSearch} disabled={!need.trim() || loading}><Icon name="search" size={17}/>{loading ? 'Exploration du corpus…' : 'Voir ce que le corpus met à disposition'}</button>
      </div>
      {error && <p className="qvl-scn-error">{error}</p>}
      {searched && <>
        <div className="qvl-scn-section-title"><div><h2>Ce que le corpus met à disposition</h2><p>Ces éléments peuvent être retenus, écartés ou utilisés par vous pour ajuster votre formulation.</p></div></div>
        <div className="qvl-scn-grid">{formulationItems.map(item => <ProposalCard key={item.id} item={item} retained={retained.has(item.id)} discarded={discarded.has(item.id)} reformulation={reformulationRefs.has(item.id)} onRetain={toggleRetain} onDiscard={toggleDiscard} onReformulate={toggleReformulation}/>)}</div>
        {reformulationRefs.size > 0 && <div className="qvl-scn-reformulate">
          <label>Votre formulation de travail</label>
          <textarea value={workingNeed} onChange={e => setWorkingNeed(e.target.value)} />
          <div className="qvl-scn-hints"><span>Éléments que vous avez choisi de mobiliser pour reformuler :</span>{formulationItems.filter(i => reformulationRefs.has(i.id)).map(i => <b key={i.id}>{i.title}</b>)}</div>
        </div>}
        <div className="qvl-scn-reflexive"><Icon name="info" size={16}/>À vous de juger : ces propositions éclairent-elles réellement votre besoin, ou vous éloignent-elles de votre question ?</div>
        <div className="qvl-scn-next"><button className="qvl-scn-primary" type="button" onClick={() => setStep(2)}>Valider cette sélection et continuer <Icon name="chevron" size={16}/></button></div>
      </>}
    </section>}

    {step === 2 && <section className="qvl-scn-section">
      <div className="qvl-scn-current-need"><strong>Besoin de veille</strong><span>{activeNeed}</span></div>
      <div className="qvl-scn-section-title"><div><h2>Objets de veille proposés par le corpus</h2><p>Retenez uniquement les acteurs, phénomènes, dispositifs, territoires ou notions qui doivent réellement structurer votre veille.</p></div></div>
      <div className="qvl-scn-grid three">{objectItems.map(item => <SelectionCard key={item.id} item={item} retained={retained.has(item.id)} onToggle={toggleRetain}/>)}</div>
      <div className="qvl-scn-reflexive"><Icon name="info" size={16}/>À vous de juger : quels objets sont assez importants pour structurer la veille, et lesquels risquent de disperser l’attention ?</div>
      <div className="qvl-scn-next"><button className="qvl-scn-secondary" type="button" onClick={() => setStep(1)}><Icon name="back" size={16}/>Étape précédente</button><button className="qvl-scn-primary" type="button" onClick={() => setStep(3)}>Valider cette sélection et continuer <Icon name="chevron" size={16}/></button></div>
    </section>}

    {step === 3 && <section className="qvl-scn-section">
      <div className="qvl-scn-current-need"><strong>Besoin de veille</strong><span>{activeNeed}</span></div>
      <div className="qvl-scn-section-title"><div><h2>Tendances, signes de changement et signaux faibles</h2><p>Le corpus propose des éléments d’évolution à examiner. Leur qualification reste soumise à votre appréciation.</p></div></div>
      <div className="qvl-scn-signal-columns">
        <div className="qvl-scn-signal-col trend"><h3>Tendances</h3><p>Évolutions structurantes ou durables déjà documentées.</p>{trendItems.length ? trendItems.map(item => <SelectionCard key={item.id} item={item} retained={retained.has(item.id)} onToggle={toggleRetain}/>) : <span className="qvl-scn-empty-line">Aucune tendance suffisamment pertinente trouvée.</span>}</div>
        <div className="qvl-scn-signal-col change"><h3>Signes de changement</h3><p>Évolutions récentes ou indices d’inflexion présents dans les sources.</p>{changeItems.length ? changeItems.map(item => <SelectionCard key={item.id} item={item} retained={retained.has(item.id)} onToggle={toggleRetain}/>) : <span className="qvl-scn-empty-line">Aucun signe de changement suffisamment pertinent trouvé.</span>}</div>
        <div className="qvl-scn-signal-col weak"><h3>Signaux faibles</h3><p>Éléments déjà qualifiés comme signaux faibles dans le corpus.</p>{weakSignalItems.length ? weakSignalItems.map(item => <SelectionCard key={item.id} item={item} retained={retained.has(item.id)} onToggle={toggleRetain}/>) : <span className="qvl-scn-empty-line">Aucun signal faible explicitement documenté pour ce besoin.</span>}</div>
      </div>
      <div className="qvl-scn-reflexive"><Icon name="info" size={16}/>À vous de juger : s’agit-il d’une tendance installée, d’un signe de changement ou d’un signal faible encore incertain ?</div>
      <div className="qvl-scn-next"><button className="qvl-scn-secondary" type="button" onClick={() => setStep(2)}><Icon name="back" size={16}/>Étape précédente</button><button className="qvl-scn-primary" type="button" onClick={() => setStep(4)}>Prévisualiser mon scénario <Icon name="chevron" size={16}/></button></div>
    </section>}

    {step === 4 && <section className="qvl-scn-section">
      <div className="qvl-scn-section-title"><div><h2>Prévisualisation du scénario</h2><p>Cette prévisualisation assemble uniquement votre besoin et les éléments que vous avez retenus.</p></div></div>
      <div className="qvl-scn-preview">
        <PreviewBlock n="1" title="Besoin de veille"><p>{preview.need_working}</p>{preview.need_working !== preview.need_original && <small>Besoin initial : {preview.need_original}</small>}</PreviewBlock>
        <PreviewBlock n="2" title="Questions de veille"><ul>{preview.questions.map((q, i) => <li key={i}>{q}</li>)}</ul><small>Propositions de structuration à modifier si nécessaire.</small></PreviewBlock>
        <PreviewItems n="3" title="Objets de veille" items={preview.objects}/>
        <PreviewItems n="4" title="Tendances à suivre" items={preview.trends}/>
        <PreviewItems n="5" title="Signes de changement" items={preview.changes}/>
        <PreviewItems n="6" title="Signaux faibles" items={preview.weak_signals}/>
        <PreviewSources n="7" title="Sources à surveiller" sources={preview.sources}/>
      </div>
      <div className="qvl-scn-reflexive"><Icon name="info" size={16}/>Avant de générer : ce scénario reflète-t-il bien votre besoin initial et les choix que vous avez faits dans les étapes précédentes ?</div>
      <div className="qvl-scn-next"><button className="qvl-scn-secondary" type="button" onClick={() => setStep(3)}><Icon name="back" size={16}/>Étape précédente</button>{!finalized ? <button className="qvl-scn-primary" type="button" onClick={() => setFinalized(true)}><Icon name="spark" size={16}/>Générer le livrable</button> : <><button className="qvl-scn-secondary" type="button" onClick={() => exportScenarioWord(preview)}><Icon name="file" size={16}/>Exporter Word</button><button className="qvl-scn-secondary" type="button" onClick={() => exportScenarioExcel(preview)}><Icon name="layers" size={16}/>Exporter les données</button></>}</div>
      {finalized && <div className="qvl-scn-final">Scénario généré à partir de votre sélection. Vous pouvez revenir aux étapes précédentes pour le modifier puis le générer à nouveau.</div>}
    </section>}
  </main>
}

function PreviewBlock({ n, title, children }) {
  return <article className="qvl-scn-preview-block"><div className="qvl-scn-preview-title"><span>{n}</span><h3>{title}</h3></div>{children}</article>
}

function PreviewItems({ n, title, items }) {
  return <PreviewBlock n={n} title={title}>{items.length ? <ul>{items.map(item => <li key={item.id}><strong>{item.title}</strong><span>{sourceLabel(item.source)}</span></li>)}</ul> : <p>Aucun élément retenu.</p>}</PreviewBlock>
}

function PreviewSources({ n, title, sources }) {
  return <PreviewBlock n={n} title={title}>{sources.length ? <ul>{sources.map((s, i) => <li key={`${s.publication_id || s.url}-${i}`}><strong>{s.title}</strong><span>{[s.organisation, s.year, s.locator ? `repère ${s.locator}` : '', s.origin === 'enrichment' ? 'enrichissement contrôlé' : 'corpus'].filter(Boolean).join(' · ')}</span></li>)}</ul> : <p>Aucune source retenue.</p>}</PreviewBlock>
}
