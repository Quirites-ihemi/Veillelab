import React, { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import ExportShare from '../components/ExportShare.jsx'
import { exportDocx, pubLabel, sourceLink } from '../utils/knowledgeExport.js'
import RAPPROCHEMENTS from '../data_rapprochements.json'
import './document-links.css'

function publicationImageSrc(publication = {}) {
  const base = import.meta.env.BASE_URL || '/'
  const raw = String(publication.image_path || publication.image_publication || '').trim()
  if (/^https?:\/\//i.test(raw)) return raw
  const normalized = raw ? raw.replace(/^\.?\/+/, '') : `images/publications/${publication.publication_id}.png`
  return `${base}${normalized}`
}
const sentenceCase = (v = '') => { const s = String(v || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }
const titleOf = (p = {}, id = '') => sentenceCase(p.titre || p.title || id)
const metaOf = (p = {}) => [p.organisme_producteur || p.organisme, p['année_publication'] || p.annee].filter(Boolean).join(' · ')
const pagesOf = node => { const p = String(node?.page_source || '').split(';').map(x => x.trim()).filter(Boolean); return p.length ? `${/:/.test(p[0]) ? '' : 'p. '}${p.slice(0, 6).join(', ')}${p.length > 6 ? '…' : ''}` : '' }
const RANK = { fort: 0, moyen: 1 }
const DEGRE = { fort: 'forte', moyen: 'moyenne' }

// Rapprochements validés éditorialement (fichier Quirites_arbre_recommandations1.xlsx).
// Une branche par rapprochement : le sujet commun, et la publication voisine au bout.
function branchesFor(id, byId) {
  return (RAPPROCHEMENTS.rapprochements || [])
    .filter(r => (r.a === id || r.b === id) && byId[r.a] && byId[r.b])
    .map(r => {
      const mine = r.a === id
      return { other: mine ? r.b : r.a, sujet: r.sujet, justification: r.justification, degre: r.degre,
        nodesHere: mine ? r.nodesA : r.nodesB, nodesThere: mine ? r.nodesB : r.nodesA }
    })
    .sort((x, y) => (RANK[x.degre] ?? 2) - (RANK[y.degre] ?? 2) || x.other.localeCompare(y.other))
}

function Passage({ nodeIds = [], publicationId, publication, nodesByKey, contentsById, label }) {
  const nodes = nodeIds.map(n => nodesByKey[`${publicationId}|${n}`]).filter(Boolean)
  const node = nodes[0]
  const chunk = node && String(node.chunk_id_source || '').split(';').map(x => contentsById[x.trim()]).find(Boolean)
  return <div className="nb-passage">
    <small>{label}</small>
    {nodes.length ? nodes.map(n => <strong key={n.node_id}>{n.libelle}</strong>) : <strong>—</strong>}
    <span className="nb-passage-meta">{publicationId} · {titleOf(publication, publicationId)}{node && pagesOf(node) ? ` · ${pagesOf(node)}` : ''}</span>
    {chunk ? <blockquote>{chunk.texte}</blockquote> : <p className="nb-muted">Pas d’extrait disponible pour cette publication.</p>}
  </div>
}

export default function DocumentLinksWorkspace({ data, onBack, initialPublicationId = '', onSelectPublicationId = null }) {
  const publications = useMemo(() => (data.publications || []).filter(p => p.publication_id).sort((a, b) => a.publication_id.localeCompare(b.publication_id)), [data.publications])
  const byId = useMemo(() => Object.fromEntries(publications.map(p => [p.publication_id, p])), [publications])
  const contentsById = useMemo(() => Object.fromEntries((data.contents || []).map(c => [c.chunk_id, c])), [data.contents])
  const nodesByKey = useMemo(() => Object.fromEntries((data.nodes || []).map(n => [`${n.publication_id}|${n.node_id}`, n])), [data.nodes])
  const [publicationId, setPublicationId] = useState(initialPublicationId)
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => { if (initialPublicationId) { setPublicationId(initialPublicationId); setSelected(null) } }, [initialPublicationId])
  const branches = useMemo(() => publicationId && byId[publicationId] ? branchesFor(publicationId, byId) : [], [publicationId, byId])
  const source = byId[publicationId]
  const withLinks = useMemo(() => new Set(publications.filter(p => branchesFor(p.publication_id, byId).length).map(p => p.publication_id)), [publications, byId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return publications.filter(p => !q || [p.publication_id, p.titre, p.organisme_producteur, p['année_publication']].filter(Boolean).join(' ').toLowerCase().includes(q)).slice(0, 80)
  }, [publications, query])

  function choose(id, { addHistory = false } = {}) {
    if (!id || !byId[id]) return
    if (addHistory && publicationId) setHistory(h => [...h, publicationId].slice(-8))
    setPublicationId(id); setSelected(null); onSelectPublicationId?.(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function back() { const prev = history[history.length - 1]; if (!prev) return; setHistory(h => h.slice(0, -1)); setPublicationId(prev); setSelected(null); onSelectPublicationId?.(prev) }

  const exportTree = () => exportDocx(`Arbre_${publicationId}`, `Arbre des recommandations — ${titleOf(source, publicationId)}`, [
    { text: pubLabel(source) }, ...(sourceLink(source) ? [{ text: `Source : ${sourceLink(source)}` }] : []),
    ...branches.flatMap(b => [{ heading: true, text: b.sujet },
      { text: `${pubLabel(byId[b.other]) || b.other} (proximité ${DEGRE[b.degre] || b.degre})` }, { text: b.justification },
      ...(sourceLink(byId[b.other]) ? [{ text: `Document : ${sourceLink(byId[b.other])}` }] : [])]),
  ])

  const sel = selected != null && branches[selected] ? branches[selected] : null

  return <main className="page doclinks-workspace">
    <div className="doclinks-topbar">
      <button className="chrono-return" type="button" onClick={onBack}><Icon name="back" size={15}/> D’un document à l’autre</button>
      {history.length > 0 && <button className="doclinks-history-back" type="button" onClick={back}><Icon name="back" size={14}/> Publication précédente</button>}
      <span style={{ flex: 1 }}/>
      {source && branches.length ? <ExportShare shareParts={['documents', 'recommandations', publicationId]} label={`Arbre des recommandations · ${titleOf(source, publicationId)}`}
        formats={[{ label: 'Arbre et rapprochements · Word', action: exportTree }]}/> : <ExportShare waitingFor="Choisissez une publication pour exporter ou partager l’arbre." showShareWhenWaiting />}
    </div>

    <header className={`doclinks-hero ${source ? '' : 'doclinks-hero-big'}`}>
      <div className="crossdoc-kicker">L’ARBRE DES RECOMMANDATIONS</div>
      <h1>Choisissez une publication,<span> voyez celles qui traitent du même sujet.</span></h1>
    </header>

    <section className="doclinks-selector-panel">
      <div className="doclinks-selector-heading"><div><h2>Rechercher parmi les {publications.length} publications</h2></div></div>
      <div className="doclinks-selector-controls">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un titre, un organisme ou un identifiant…" />
        <select value={publicationId} onChange={e => choose(e.target.value)} aria-label="Publication">
          <option value="" disabled>Sélectionnez une publication…</option>
          {filtered.map(p => <option key={p.publication_id} value={p.publication_id}>{p.publication_id} — {titleOf(p, p.publication_id)}{withLinks.has(p.publication_id) ? '' : ' (sans rapprochement)'}</option>)}
        </select>
      </div>
    </section>

    {source && <section className="nb-wrap">
      <div className="nb-tree" aria-label={`Arbre de ${titleOf(source)} : ${branches.length} publications rapprochées`}>
        {branches.length ? <>
          <div className="nb-crown" style={{ '--n': branches.length }}>
            {branches.map((b, i) => {
              const p = byId[b.other] || {}
              const on = selected === i
              return <div className="nb-branch" key={b.other}>
                <div className="nb-leaves">
                  <button type="button" className={`nb-leaf ${on ? 'on' : ''}`} onClick={() => setSelected(on ? null : i)}>
                    <small>{b.other} · {metaOf(p)}</small>
                    <strong>{titleOf(p, b.other)}</strong>
                    <span>Proximité {DEGRE[b.degre] || b.degre}</span>
                  </button>
                </div>
                <svg className="nb-twig" viewBox="0 0 10 40" preserveAspectRatio="none" aria-hidden="true"><path d="M5 40 L5 0"/></svg>
                <div className="nb-subject"><small>Sujet commun</small><strong>{b.sujet}</strong></div>
              </div>
            })}
          </div>
          <svg className="nb-limbs" viewBox="0 0 1000 90" preserveAspectRatio="none" aria-hidden="true">
            {branches.map((_, i) => { const x = (i + .5) * 1000 / branches.length; return <path key={i} d={`M500 90 C 500 50, ${x} 50, ${x} 0`}/> })}
          </svg>
        </> : <p className="nb-empty">Aucune autre publication n’a encore été rapprochée de celle-ci.</p>}
        <article className="nb-trunk">
          <img src={publicationImageSrc(source)} alt="" />
          <div><small>PUBLICATION DE DÉPART · {publicationId}</small><h2>{titleOf(source, publicationId)}</h2><p>{metaOf(source)}{branches.length ? ` · ${branches.length} publication${branches.length > 1 ? 's' : ''} rapprochée${branches.length > 1 ? 's' : ''}` : ''}</p></div>
        </article>
      </div>

      <aside className="nb-side">
        {sel ? <>
          <button type="button" className="nb-close" onClick={() => setSelected(null)}>← Tous les rapprochements</button>
          <h3>{sel.sujet}</h3>
          <p className="nb-why">{sel.justification}</p>
          <Passage nodeIds={sel.nodesHere} publicationId={publicationId} publication={source} nodesByKey={nodesByKey} contentsById={contentsById} label="Dans la publication de départ"/>
          <Passage nodeIds={sel.nodesThere} publicationId={sel.other} publication={byId[sel.other]} nodesByKey={nodesByKey} contentsById={contentsById} label="Dans la publication rapprochée"/>
          <div className="nb-actions">
            <button type="button" className="nb-primary" onClick={() => choose(sel.other, { addHistory: true })}>Voir l’arbre de cette publication →</button>
            {byId[sel.other]?.has_graph !== false && <a href={`#/explorer/${sel.other}`}>Ouvrir dans Explorer</a>}
            {sourceLink(byId[sel.other]) && <a href={sourceLink(byId[sel.other])} target="_blank" rel="noreferrer">Source ↗</a>}
          </div>
        </> : <>
          <h3>Lire l’arbre</h3>
          <p className="nb-muted">En bas, la publication choisie. Chaque branche porte un sujet qu’elle partage avec une autre publication du corpus, placée au bout de la branche.</p>
          <p className="nb-muted">Cliquez sur une publication pour lire pourquoi elle est rapprochée et les deux passages qui le montrent, puis passez à son propre arbre pour continuer de proche en proche.</p>
        </>}
      </aside>
    </section>}
  </main>
}
