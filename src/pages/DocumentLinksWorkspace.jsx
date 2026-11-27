import React, { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import ExportShare from '../components/ExportShare.jsx'
import { exportDocx, pubLabel, sourceLink } from '../utils/knowledgeExport.js'
import { buildNeighbourIndex, branchesFor } from '../lib/neighbours.js'
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
const pagesOf = node => { const p = String(node?.page_source || '').split(';').map(x => x.trim()).filter(Boolean); return p.length ? `p. ${p.slice(0, 6).join(', ')}${p.length > 6 ? '…' : ''}` : '' }

function Passage({ node, publication, contentsById, label }) {
  const chunk = String(node.chunk_id_source || '').split(';').map(x => contentsById[x.trim()]).find(Boolean)
  return <div className="nb-passage">
    <small>{label}</small>
    <strong>{node.libelle}</strong>
    <span className="nb-passage-meta">{publication?.publication_id} · {titleOf(publication, node.publication_id)}{pagesOf(node) ? ` · ${pagesOf(node)}` : ''}</span>
    {chunk ? <blockquote>{chunk.texte}</blockquote> : <p className="nb-muted">Pas d’extrait disponible dans les données chargées.</p>}
  </div>
}

export default function DocumentLinksWorkspace({ data, onBack, initialPublicationId = '', onSelectPublicationId = null }) {
  const publications = useMemo(() => (data.publications || []).filter(p => p.publication_id).sort((a, b) => a.publication_id.localeCompare(b.publication_id)), [data.publications])
  const byId = useMemo(() => Object.fromEntries(publications.map(p => [p.publication_id, p])), [publications])
  const contentsById = useMemo(() => Object.fromEntries((data.contents || []).map(c => [c.chunk_id, c])), [data.contents])
  const index = useMemo(() => buildNeighbourIndex(data.nodes || [], data.relations || []), [data.nodes, data.relations])
  const [publicationId, setPublicationId] = useState(initialPublicationId)
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => { if (initialPublicationId) setPublicationId(initialPublicationId) }, [initialPublicationId])
  const branches = useMemo(() => publicationId && byId[publicationId] ? branchesFor(index, publicationId) : [], [index, publicationId, byId])
  const source = byId[publicationId]
  const neighbourCount = new Set(branches.flatMap(b => b.leaves.map(l => l.publicationId))).size

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
    ...branches.flatMap(b => [{ heading: true, text: b.subject.libelle },
      ...b.leaves.flatMap(l => [{ text: `${pubLabel(byId[l.publicationId]) || l.publicationId}` }, { text: `Élément commun : ${l.node.libelle}${pagesOf(l.node) ? ` (${pagesOf(l.node)})` : ''}` }, ...(sourceLink(byId[l.publicationId]) ? [{ text: `Document : ${sourceLink(byId[l.publicationId])}` }] : [])])]),
  ])

  const sel = selected && branches[selected.b]?.leaves[selected.l] ? { branch: branches[selected.b], leaf: branches[selected.b].leaves[selected.l] } : null

  return <main className="page doclinks-workspace">
    <div className="doclinks-topbar">
      <button className="chrono-return" type="button" onClick={onBack}><Icon name="back" size={15}/> D’un document à l’autre</button>
      {history.length > 0 && <button className="doclinks-history-back" type="button" onClick={back}><Icon name="back" size={14}/> Publication précédente</button>}
      <span style={{ flex: 1 }}/>
      {source && branches.length ? <ExportShare shareParts={['documents', 'recommandations', publicationId]} label={`Arbre des recommandations · ${titleOf(source, publicationId)}`}
        formats={[{ label: 'Arbre et éléments communs · Word', action: exportTree }]}/> : <ExportShare waitingFor="Choisissez une publication pour exporter ou partager l’arbre." showShareWhenWaiting />}
    </div>

    <header className={`doclinks-hero ${source ? '' : 'doclinks-hero-big'}`}>
      <div className="crossdoc-kicker">L’ARBRE DES RECOMMANDATIONS</div>
      <h1>Choisissez une publication,<span> voyez par quels sujets elle rejoint les autres.</span></h1>
    </header>

    <section className="doclinks-selector-panel">
<div className="doclinks-selector-heading"><div><h2>Rechercher parmi les {publications.length} publications</h2></div></div>
      <div className="doclinks-selector-controls">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un titre, un organisme ou un identifiant…" />
        <select value={publicationId} onChange={e => choose(e.target.value)} aria-label="Publication">
          <option value="" disabled>Sélectionnez une publication…</option>
          {filtered.map(p => <option key={p.publication_id} value={p.publication_id}>{p.publication_id} — {titleOf(p, p.publication_id)}</option>)}
        </select>
      </div>
    </section>

    {source && <section className="nb-wrap">
      <div className="nb-tree" aria-label={`Arbre de ${titleOf(source)} : ${branches.length} sujets, ${neighbourCount} publications voisines`}>
        {branches.length ? <>
          <div className="nb-crown" style={{ '--n': branches.length }}>
            {branches.map((b, bi) => <div className="nb-branch" key={b.subject.node_id}>
              <div className="nb-leaves">{b.leaves.map((l, li) => {
                const p = byId[l.publicationId] || {}
                const on = selected?.b === bi && selected?.l === li
                return <button type="button" key={l.publicationId} className={`nb-leaf ${on ? 'on' : ''}`} onClick={() => setSelected(on ? null : { b: bi, l: li })}>
                  <small>{l.publicationId} · {metaOf(p)}</small>
                  <strong>{titleOf(p, l.publicationId)}</strong>
                  <span>via : {l.node.libelle}</span>
                </button>
              })}{b.more > 0 && <p className="nb-more">+ {b.more} autre{b.more > 1 ? 's' : ''} publication{b.more > 1 ? 's' : ''}</p>}</div>
              <svg className="nb-twig" viewBox="0 0 10 40" preserveAspectRatio="none" aria-hidden="true"><path d="M5 40 L5 0"/></svg>
              <div className="nb-subject"><small>Sujet</small><strong>{b.subject.libelle}</strong></div>
            </div>)}
          </div>
          <svg className="nb-limbs" viewBox="0 0 1000 90" preserveAspectRatio="none" aria-hidden="true">
            {branches.map((_, i) => { const x = (i + .5) * 1000 / branches.length; return <path key={i} d={`M500 90 C 500 50, ${x} 50, ${x} 0`}/> })}
          </svg>
        </> : <p className="nb-empty">Aucun sujet de cette publication n’a été rapproché d’une autre publication du corpus pour l’instant.</p>}
        <article className="nb-trunk">
          <img src={publicationImageSrc(source)} alt="" />
          <div><small>PUBLICATION DE DÉPART · {publicationId}</small><h2>{titleOf(source, publicationId)}</h2><p>{metaOf(source)}{branches.length ? ` · ${branches.length} sujet${branches.length > 1 ? 's' : ''} · ${neighbourCount} publication${neighbourCount > 1 ? 's' : ''} voisine${neighbourCount > 1 ? 's' : ''}` : ''}</p></div>
        </article>
      </div>

      <aside className="nb-side">
        {sel ? <>
          <button type="button" className="nb-close" onClick={() => setSelected(null)}>← Tous les sujets</button>
          <h3>Pourquoi ce rapprochement ?</h3>
          <p className="nb-muted">Les deux publications traitent d’un sujet proche. Lisez les deux passages pour en juger.</p>
          <Passage node={sel.branch.subject} publication={source} contentsById={contentsById} label="Dans la publication de départ"/>
          <Passage node={sel.leaf.node} publication={byId[sel.leaf.publicationId]} contentsById={contentsById} label="Dans la publication voisine"/>
          <div className="nb-actions">
            <button type="button" className="nb-primary" onClick={() => choose(sel.leaf.publicationId, { addHistory: true })}>Voir l’arbre de cette publication →</button>
            <a href={`#/explorer/${sel.leaf.publicationId}`}>Ouvrir dans Explorer</a>
            {sourceLink(byId[sel.leaf.publicationId]) && <a href={sourceLink(byId[sel.leaf.publicationId])} target="_blank" rel="noreferrer">Source ↗</a>}
          </div>
        </> : <>
          <h3>Lire l’arbre</h3>
          <p className="nb-muted">En bas, la publication choisie. Chaque branche est l’un de ses grands sujets ; sur la branche, les publications du corpus qui en traitent aussi, avec l’élément qui les relie.</p>
          <p className="nb-muted">Cliquez sur une publication voisine pour comparer les deux passages, puis passez à son propre arbre pour continuer de proche en proche.</p>
          <p className="nb-note">Les rapprochements sont calculés automatiquement à partir des éléments des publications : vérifiez-les toujours à l’aide des passages.</p>
        </>}
      </aside>
    </section>}
  </main>
}
