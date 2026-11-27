import React, { useMemo, useState, useEffect } from 'react'
import { navigate } from '../lib/router.js'
import { searchMatcher, searchText } from '../lib/searchFamilies.js'
import { domainLabel } from './Home.jsx'
import '../publications.css'

// Thèmes d'une publication : son domaine, découpé quand il en réunit plusieurs
// (« Criminalité organisée / Narcotrafic / État de droit » → trois thèmes distincts).
// « Criminalités » et « Criminalité organisée », « Drogues » et « Narcotrafic »
// restent des thèmes séparés.
export const themesOf = p => String(p?.domaine || '').split(/\s+\/\s+/).map(t => t.trim()).filter(Boolean).map(domainLabel)

function imageSrc(p) {
  const base = import.meta.env.BASE_URL || '/'
  const raw = String(p?.image_path || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  return `${base}${raw.replace(/^\.?\/+/, '')}`
}
const firstUrl = v => String(v || '').split(/\s+/).find(x => /^https?:\/\//i.test(x)) || ''
const sortFr = (a, b) => a.localeCompare(b, 'fr')

// Même sujet sous deux noms : comptés comme correspondance exacte.
const canon = t => searchText(t).replace(/\bcrimes? organises?\b/g, 'criminalite organisee').replace(/\bstupefiants?\b/g, 'drogue')
// Thèmes voisins mais distincts : « criminalité organisée » n'est pas
// « criminalités ». Tant que la recherche ne les nomme pas, ces expressions
// sont retirées du texte pour la correspondance exacte.
const NARROWER = [
  { key: /organise/, re: /\bcriminalites? organisees?\b/g },
  { key: /environnement/, re: /\bcriminalites? environnementales?\b/g },
]
const stripNarrower = (text, q) => NARROWER.reduce((t, n) => (n.key.test(q) ? t : t.replace(n.re, ' ')), text)

export default function Publications({ data, args = [] }) {
  const pubs = data.publications || []
  const initialQuery = args[0] === 'recherche' ? args[1] || '' : ''
  const initialTheme = args[0] === 'theme' ? args[1] || '' : ''
  const [query, setQuery] = useState(initialQuery)
  const [theme, setTheme] = useState(initialTheme)
  const [org, setOrg] = useState('')
  const [type, setType] = useState('')
  const [year, setYear] = useState('')
  useEffect(() => { setQuery(initialQuery); setTheme(initialTheme) }, [initialQuery, initialTheme])

  // Texte cherchable : métadonnées + éléments du graphe de chaque publication.
  const labelsByPub = useMemo(() => {
    const m = new Map()
    for (const n of data.nodes || []) {
      if (!m.has(n.publication_id)) m.set(n.publication_id, [])
      m.get(n.publication_id).push({ text: `${n.libelle || ''} ${n.libelle_normalise || ''}`, label: n.libelle || n.libelle_normalise || '' })
    }
    return m
  }, [data.nodes])

  const facets = useMemo(() => {
    const count = (fn) => { const c = new Map(); pubs.forEach(p => [].concat(fn(p)).filter(Boolean).forEach(v => c.set(v, (c.get(v) || 0) + 1))); return [...c].sort((a, b) => b[1] - a[1] || sortFr(String(a[0]), String(b[0]))) }
    return { themes: count(themesOf), orgs: count(p => p.organisme_producteur), types: count(p => p.type_document), years: count(p => String(p['année_publication'] || '')).sort((a, b) => b[0].localeCompare(a[0])) }
  }, [pubs])

  const filtered = pubs.filter(p => (!theme || themesOf(p).includes(theme)) && (!org || p.organisme_producteur === org) && (!type || p.type_document === type) && (!year || String(p['année_publication']) === year))

  const results = useMemo(() => {
    const q = query.trim()
    if (!q) return { exact: filtered.map(p => ({ p })), near: [], also: [] }
    const cq = canon(q)
    const m = searchMatcher(cq)
    const direct = t => m.testDirect(stripNarrower(canon(t), cq))
    const loose = t => m.test(canon(t))
    const exact = [], near = []
    for (const p of filtered) {
      const meta = [p.titre, p.organisme_producteur, p.domaine, p.type_document, p.publication_id].join(' ')
      const labels = labelsByPub.get(p.publication_id) || []
      if (direct(meta)) { exact.push({ p, why: 'dans le titre ou la fiche', rank: 0 }); continue }
      const hits = labels.filter(l => direct(l.text))
      if (hits.length) { exact.push({ p, why: `dans ${hits.length} élément${hits.length > 1 ? 's' : ''} de la publication`, sample: hits[0].label, rank: 1, n: hits.length }); continue }
      const fam = loose(meta) ? ['__meta'] : labels.filter(l => loose(l.text))
      if (fam.length) near.push({ p, why: fam[0] === '__meta' ? 'dans le titre ou la fiche' : `dans ${fam.length} élément${fam.length > 1 ? 's' : ''}`, sample: fam[0] === '__meta' ? '' : fam[0].label })
    }
    exact.sort((a, b) => a.rank - b.rank || (b.n || 0) - (a.n || 0))
    return { exact, near, also: m.alsoSearched }
  }, [query, filtered, labelsByPub])

  const go = parts => e => { e.preventDefault(); navigate(parts) }
  const clearAll = () => { setQuery(''); setTheme(''); setOrg(''); setType(''); setYear(''); navigate(['publications'], { replace: true }) }
  const active = query || theme || org || type || year

  const Card = ({ p, why, sample }) => {
    const src = firstUrl(p.url_source) || firstUrl(p.url_contenu)
    return <article className="pl-card">
      <div className="pl-cover">{imageSrc(p) ? <img src={imageSrc(p)} alt="" loading="lazy"/> : <span aria-hidden="true">{p.publication_id}</span>}</div>
      <div className="pl-body">
        <p className="pl-meta">{p.publication_id} · {p.type_document}{p['année_publication'] ? ` · ${p['année_publication']}` : ''}</p>
        <h3>{p.titre}</h3>
        <p className="pl-org">{p.organisme_producteur}</p>
        <div className="pl-themes">{themesOf(p).map(t => <button key={t} type="button" className={theme === t ? 'on' : ''} onClick={() => setTheme(theme === t ? '' : t)}>{t}</button>)}</div>
        {why && <p className="pl-why">Trouvé {why}{sample ? <> : « {sample.trim().slice(0, 110)}{sample.trim().length > 110 ? '…' : ''} »</> : ''}</p>}
        <div className="pl-actions">
          {p.has_graph !== false && <a href={`#/explorer/${p.publication_id}`} onClick={go(['explorer', p.publication_id])}>Explorer la publication</a>}
          <a href={`#/documents/recommandations/${p.publication_id}`} onClick={go(['documents', 'recommandations', p.publication_id])}>Voir son arbre</a>
          {src && <a href={src} target="_blank" rel="noreferrer">Lire la source ↗</a>}
        </div>
      </div>
    </article>
  }

  const Select = ({ label, value, set, options }) => <label className="pl-select"><span>{label}</span>
    <select value={value} onChange={e => set(e.target.value)}><option value="">Tous</option>{options.map(([v, n]) => <option key={v} value={v}>{v} ({n})</option>)}</select></label>

  return <main className="page pl-page">
    <header className="pl-head">
      <p className="pl-kicker">Les publications du bulletin</p>
      <h1>{pubs.length} publications à consulter</h1>
      <form className="pl-search" onSubmit={e => { e.preventDefault(); navigate(query.trim() ? ['publications', 'recherche', query.trim()] : ['publications'], { replace: true }) }} role="search">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Chercher un sujet, un titre, un organisme…" aria-label="Chercher une publication"/>
        <button type="submit">Chercher</button>
      </form>
      <div className="pl-filters">
        <Select label="Thème" value={theme} set={setTheme} options={facets.themes}/>
        <Select label="Organisme" value={org} set={setOrg} options={facets.orgs}/>
        <Select label="Type" value={type} set={setType} options={facets.types}/>
        <Select label="Année" value={year} set={setYear} options={facets.years}/>
        {active && <button type="button" className="pl-reset" onClick={clearAll}>Tout effacer</button>}
      </div>
    </header>

    <section className="pl-results" aria-live="polite">
      <h2>{query.trim() ? <>{results.exact.length} publication{results.exact.length > 1 ? 's' : ''} sur « {query.trim()} »</> : <>{results.exact.length} publication{results.exact.length > 1 ? 's' : ''}</>}{theme ? <> · thème {theme}</> : ''}</h2>
      {results.exact.length ? <div className="pl-grid">{results.exact.map(r => <Card key={r.p.publication_id} {...r}/>)}</div>
        : <p className="pl-empty">Aucune publication ne traite directement de ce sujet{results.near.length ? ' ; voyez les thèmes voisins ci-dessous.' : '.'}</p>}
      {results.near.length > 0 && <>
        <h2 className="pl-near-title">Thèmes voisins <span>{results.near.length} publication{results.near.length > 1 ? 's' : ''}</span></h2>
        <p className="pl-near-lead">Ces publications ne traitent pas de « {query.trim()} » en tant que tel, mais d’un sujet voisin{results.also.length ? ` (${results.also.join(', ')})` : ''}.</p>
        <div className="pl-grid near">{results.near.map(r => <Card key={r.p.publication_id} {...r}/>)}</div>
      </>}
    </section>
  </main>
}
