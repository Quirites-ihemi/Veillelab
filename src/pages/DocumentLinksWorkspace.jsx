import React, { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import recommendationsCatalog from '../recommendationsCatalog.json'
import './document-links.css'

const MAX_WAIT_MS = 120000
const DEFAULT_DOCUMENT_LINKS_URL = 'https://veillelab-document-links-v01-633342872265.europe-west9.run.app'

function cleanUrl(value = '') {
  const first = String(value || '').split(/\s+/).find(x => /^https?:\/\//i.test(x))
  return first || ''
}

function publicationImageSrc(publication = {}) {
  const base = import.meta.env.BASE_URL || '/'
  const raw = String(publication.image_path || publication.image_publication || '').trim()
  if (/^https?:\/\//i.test(raw)) return raw
  const normalized = raw ? raw.replace(/^\.?\/+/, '') : `images/publications/${publication.publication_id}.png`
  return `${base}${normalized}`
}

function sentenceCase(value = '') {
  const s = String(value || '').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

function publicationTitle(publication = {}, fallbackId = '') {
  return sentenceCase(publication.titre || publication.title || fallbackId)
}

function publicationMeta(publication = {}) {
  const org = publication.organisme_producteur || publication.organisme || ''
  const year = publication['année_publication'] || publication.annee || publication.year || ''
  return [org, year].filter(Boolean).join(' · ')
}

function decisionLabel(decision) {
  return decision === 'RETENIR' ? 'Raccord direct' : 'Piste à explorer'
}

function LeafCard({ leaf, publication, onExplore }) {
  const title = publicationTitle(publication, leaf.target_publication_id)
  const sourceUrl = cleanUrl(publication.url_source) || cleanUrl(publication.url_contenu)
  const badges = Array.isArray(leaf.badges) ? leaf.badges.filter(Boolean) : []

  return <article className={`doclinks-leaf ${leaf.decision === 'RETENIR' ? 'retained' : 'possible'}`}>
    <div className="doclinks-leaf-head">
      <span className="doclinks-leaf-id">{leaf.target_publication_id}</span>
      <span className="doclinks-decision">{decisionLabel(leaf.decision)}</span>
    </div>

    <div className="doclinks-leaf-main">
      <img src={publicationImageSrc({...publication, publication_id: leaf.target_publication_id})} alt="" />
      <div>
        <h4>{title}</h4>
        {publicationMeta(publication) && <p className="doclinks-leaf-meta">{publicationMeta(publication)}</p>}
      </div>
    </div>

    {badges.length > 0 && <div className="doclinks-badges">
      {badges.map((badge, index) => <span key={`${leaf.target_publication_id}-${index}`}>{String(badge)}</span>)}
    </div>}

    <div className="doclinks-proofline">
      <Icon name="file" size={14}/>
      <span>Repère cible : {leaf.target_locator || 'non renseigné'}</span>
    </div>

    <p className="doclinks-why"><strong>Justification du moteur — </strong>{leaf.pourquoi || 'Non renseignée.'}</p>

    <div className="doclinks-leaf-actions">
      {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer">Voir la source <Icon name="external" size={13}/></a>}
      <button type="button" onClick={() => onExplore(leaf.target_publication_id)}>
        Explorer à partir de cette publication <Icon name="chevron" size={14}/>
      </button>
    </div>
  </article>
}

function TreeCrown({ payload, byId, onExplore, type, error }) {
  const groups = (payload?.threads || []).map(thread => ({
    thread,
    leaves: (payload?.leaves || []).filter(leaf => leaf.fil_lecture === thread.fil_lecture)
  })).filter(group => group.leaves.length > 0)
  // Guard against an API result containing leaves without a corresponding thread object.
  const orphanLeaves = (payload?.leaves || []).filter(leaf => !groups.some(group => group.thread.fil_lecture === leaf.fil_lecture))
  for (const leaf of orphanLeaves) {
    const existing = groups.find(group => group.thread.fil_lecture === leaf.fil_lecture)
    if (existing) existing.leaves.push(leaf)
    else groups.push({thread:{fil_lecture:leaf.fil_lecture,source_locator:leaf.source_locator},leaves:[leaf]})
  }
  const thematic = type === 'thematic'
  return <section className={`arb-side ${thematic ? 'arb-green' : 'arb-blue'}`} aria-label={thematic ? 'Prolongements thématiques' : 'Raccords documentaires'}>
    <div className="arb-foliage">
      {groups.map(({thread,leaves},i) => <div className="arb-twig" key={`${thread.fil_lecture}-${i}`}>
        <div className="arb-twig-node"><h4>{thread.fil_lecture}</h4><span>{leaves.length} {leaves.length === 1 ? 'publication' : 'publications'} · Source : {thread.source_locator || 'repère non renseigné'}</span></div>
        <div className="arb-leaves">{leaves.map((leaf,j)=><details className="arb-leaf" key={`${leaf.target_publication_id}-${j}`}>
          <summary><span className="arb-leaf-main"><small>{leaf.target_publication_id}</small><strong>{publicationTitle(byId[leaf.target_publication_id],leaf.target_publication_id)}</strong><small>Pages cible : {leaf.target_locator || 'non renseignées'}</small></span><span className={`arb-pill ${leaf.decision === 'RETENIR' ? 'arb-retained' : 'arb-possible'}`}>{leaf.decision === 'RETENIR' ? 'RETENIR' : 'POSSIBLE'}</span></summary>
          <div className="arb-leaf-detail"><p className="arb-why-title">Pourquoi cette recommandation ?</p><p className="arb-why-text">{leaf.pourquoi || 'Justification non renseignée dans les résultats du moteur.'}</p><p className="arb-proof-pair"><strong>Repères documentaires</strong> · Source : {leaf.source_locator || thread.source_locator || 'non renseigné'} · Cible : {leaf.target_locator || 'non renseigné'}</p><LeafCard leaf={leaf} publication={byId[leaf.target_publication_id] || {}} onExplore={onExplore}/></div>
        </details>)}</div>
      </div>)}
      {groups.length === 0 && <div className="arb-no-data">{error || (payload ? 'Aucune proposition affichable pour cette branche. D’autres rapprochements peuvent ne pas avoir été retrouvés.' : 'En attente de résultats.')}</div>}
    </div>
    <div className="arb-main-limb"><h3>{thematic ? 'Prolongements thématiques' : 'Raccords documentaires'}</h3><span>{groups.length} {thematic ? 'thématiques' : 'fils'} utiles · {groups.reduce((a,g)=>a+g.leaves.length,0)} propositions</span></div>
  </section>
}

export default function DocumentLinksWorkspace({ data, onBack }) {
  const publications = useMemo(() => {
    const m = new Map((data.publications || []).map(p => [p.publication_id, p]))
    for (const p of recommendationsCatalog) m.set(p.publication_id, {...p,...(m.get(p.publication_id)||{})})
    return [...m.values()].filter(p=>p.publication_id && recommendationsCatalog.some(x=>x.publication_id===p.publication_id)).sort((a,b)=>a.publication_id.localeCompare(b.publication_id))
  }, [data.publications])
  const publicationsById = useMemo(
    () => Object.fromEntries(publications.map(p => [p.publication_id, p])),
    [publications]
  )

  const [publicationId, setPublicationId] = useState('')
  const [thematicResult, setThematicResult] = useState(null)
  const [thematicError, setThematicError] = useState('')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])

  const backendUrl = String(import.meta.env.VITE_DOCUMENT_LINKS_URL || DEFAULT_DOCUMENT_LINKS_URL).replace(/\/+$/, '')
  // Only configure this with a same-origin authenticated proxy or an explicitly authorized public gateway.
  // Do not expose a private Cloud Run service or its credentials in Vite variables.
  const thematicPath = String(import.meta.env.VITE_THEMATIC_EXTENSIONS_PATH || '').trim()
  const thematicReady = /^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(thematicPath)

  const filteredPublications = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return publications.slice(0, 80)
    return publications.filter(p => {
      const haystack = [p.publication_id, p.titre, p.organisme_producteur, p['année_publication']]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    }).slice(0, 80)
  }, [publications, query])

  const sourcePublication = publicationsById[result?.source_publication_id || publicationId] || { publication_id: result?.source_publication_id || publicationId }

  const leavesByThread = useMemo(() => {
    const map = new Map()
    for (const thread of result?.threads || []) map.set(thread.fil_lecture, [])
    for (const leaf of result?.leaves || []) {
      const current = map.get(leaf.fil_lecture) || []
      current.push(leaf)
      map.set(leaf.fil_lecture, current)
    }
    return map
  }, [result])

  const thematicLeavesByThread = useMemo(() => {
    const map = new Map()
    for (const thread of thematicResult?.threads || []) map.set(thread.fil_lecture, [])
    for (const leaf of thematicResult?.leaves || []) {
      const current = map.get(leaf.fil_lecture) || []
      current.push(leaf)
      map.set(leaf.fil_lecture, current)
    }
    return map
  }, [thematicResult])



  async function loadPublication(id, { addHistory = false } = {}) {
    const cleanId = String(id || '').trim()
    if (!cleanId || loading) return
    if (addHistory && (result?.source_publication_id || thematicResult?.source_publication_id)) {
      setHistory(current => [...current, result?.source_publication_id || thematicResult?.source_publication_id].slice(-8))
    }
    setPublicationId(cleanId)
    setLoading(true)
    setError('')
    setThematicError('')
    setResult(null)
    setThematicResult(null)
    const base = import.meta.env.BASE_URL || '/'
    async function readBranch(suffix) {
      const response = await fetch(`${base}recommendations/${cleanId}_${suffix}.json`)
      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error(`Lecture locale impossible : HTTP ${response.status}`)
      }
      return response.json()
    }
    try {
      const [blue, green] = await Promise.allSettled([
        readBranch('document_links'), readBranch('thematic_extensions')
      ])
      if (blue.status === 'fulfilled' && blue.value) setResult(blue.value)
      else setError(blue.status === 'rejected' ? String(blue.reason) : 'Aucun résultat précalculé pour cette publication.')
      if (green.status === 'fulfilled' && green.value) setThematicResult(green.value)
      else setThematicError(green.status === 'rejected' ? String(green.reason) : 'Aucun résultat précalculé pour cette branche (PUB111 non calculée).')
    } finally {
      setLoading(false)
    }
  }


  function exploreTarget(id) {
    loadPublication(id, { addHistory: true })
  }

  function goBackInJourney() {
    if (!history.length) return
    const previous = history[history.length - 1]
    setHistory(current => current.slice(0, -1))
    loadPublication(previous, { addHistory: false })
  }


  return <main className="page doclinks-workspace">
    <div className="doclinks-topbar">
      <button className="chrono-return" type="button" onClick={onBack}><Icon name="back" size={15}/> D’un document à l’autre</button>
      {history.length > 0 && <button className="doclinks-history-back" type="button" onClick={goBackInJourney}><Icon name="back" size={14}/> Publication précédente</button>}
    </div>

    <header className={`doclinks-hero ${(result || thematicResult) ? '' : 'doclinks-hero-big'}`}>
      <div className="crossdoc-kicker">L’ARBRE DES RECOMMANDATIONS</div>
      <h1>Choisissez une publication,<span> on vous en conseille d’autres.</span></h1>
    </header>

    <section className="doclinks-selector-panel">
      <div className="doclinks-selector-heading"><div><h2>Rechercher parmi les {publications.length} publications</h2></div></div>

      <div className="doclinks-selector-controls">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un titre ou un identifiant…" />
        <select value={publicationId} onChange={e => setPublicationId(e.target.value)} aria-label="Publication">
          <option value="" disabled>Sélectionnez une publication…</option>
          {filteredPublications.map(p => <option key={p.publication_id} value={p.publication_id}>{p.publication_id} — {publicationTitle(p, p.publication_id)}</option>)}
        </select>
        <button type="button" onClick={() => loadPublication(publicationId)} disabled={loading || !publicationId}>
          {loading ? 'Chargement…' : 'Explorer l’arbre'}
        </button>
      </div>
    </section>



    {loading && <section className="doclinks-loading"><div className="loader"></div><strong>Chargement des recommandations précalculées…</strong><span>Aucun appel à une API IA.</span></section>}

    {(result || thematicResult || error || thematicError) && !loading && <section className="doclinks-result arb-tree" aria-label="Arbre de recommandations, tronc en bas et deux grandes branches">
      <div className="arb-canopy">
        <TreeCrown payload={result} byId={publicationsById} onExplore={exploreTarget} type="raccords" error={error}/>
        <TreeCrown payload={thematicResult} byId={publicationsById} onExplore={exploreTarget} type="thematic" error={thematicError}/>
      </div>
      <div className="arb-trunk" aria-hidden="true"><span className="arb-trunk-left"/><span className="arb-trunk-right"/></div>
      <article className="doclinks-root-card arb-base">
        <img src={publicationImageSrc(sourcePublication)} alt="" />
        <div><small>PUBLICATION DE DÉPART · {result?.source_publication_id || thematicResult?.source_publication_id || publicationId}</small><h2>{publicationTitle(sourcePublication, result?.source_publication_id || thematicResult?.source_publication_id || publicationId)}</h2><p>{publicationMeta(sourcePublication)}</p></div>
      </article>
    </section>}

    {!result && !thematicResult && !loading && !error && !thematicError && <section className="arb-tree arb-preview" aria-label="Aperçu de l’arbre">
      <div className="arb-canopy"><div className="arb-side arb-blue"><div className="arb-main-limb"><h3>Raccords documentaires</h3><span>Fils utiles uniquement</span></div></div><div className="arb-side arb-green"><div className="arb-main-limb"><h3>Prolongements thématiques</h3><span>Lectures transversales</span></div></div></div>
      <div className="arb-trunk" aria-hidden="true"><span className="arb-trunk-left"/><span className="arb-trunk-right"/></div>
      <div className="arb-base arb-base-placeholder">Choisissez une publication puis explorez l’arbre</div>
    </section>}

  </main>
}
