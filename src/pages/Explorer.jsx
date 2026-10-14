import React, { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import ProofModal from '../components/ProofModal.jsx'
import PublicationOrbit, {
  ORBIT_TYPES,
  normalizeType,
  typeLabel,
  typeColor,
  verbLabel,
  pagesOf,
} from '../components/PublicationOrbit.jsx'
import ExplorerGuide from '../components/ExplorerGuide.jsx'
import { askGraph } from '../services/chatApi.js'
import { normalize, sentenceCase } from '../lib/text.js'
// Feuilles historiques conservées (règles éventuellement partagées).
import '../explorer-eclaireur.css'
import '../explorer-publication-controls.css'
// Polices embarquées, identiques à l'Atlas.
import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-500.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'
import '@fontsource/source-serif-4/latin-500.css'
import '@fontsource/source-serif-4/latin-600.css'
import '@fontsource/source-serif-4/latin-400-italic.css'
import '../atlas-expertises.css'
import '../explorer-orbits.css'

const GUIDE_DONE_KEY = 'quirites-explorer-orbits-guide-done'

const CHAT_SUGGESTIONS = [
  'Quels sont les principaux problèmes identifiés ?',
  'Quelles recommandations sont formulées ?',
  'Quels acteurs sont mentionnés ?',
  'Quelles relations relient les éléments importants ?',
]

function cleanChatText(value = '') {
  return String(value || '')
    .replace(/\\?\*\*/g, '')
    .replace(/`+/g, '')
    .replace(/\b[NR]\d{3,}(?:_\d+)?\b/gi, '')
    .replace(/\(\s*[,;:]?\s*\)/g, '')
    .replace(/\s+([,;:.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function legacyChatItems(text = '') {
  const cleaned = cleanChatText(text)
  if (!cleaned) return { intro: '', items: [] }
  const parts = cleaned.split(/\s+(?=\d+\.\s+)/g)
  if (parts.length < 2) return { intro: cleaned, items: [] }
  const intro = parts.shift().replace(/[:\s]+$/, '').trim()
  const items = parts.map(x => x.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
  return { intro, items }
}

function ChatAnswer({ chat }) {
  if (!chat) return null
  if (chat.error) return <div className="chat-answer chat-answer-error"><p>{chat.reponse || chat.error}</p></div>
  const sections = Array.isArray(chat.sections) ? chat.sections.filter(s => s && Array.isArray(s.items) && s.items.length) : []
  const intro = cleanChatText(chat.reponse || '')
  const legacy = sections.length ? null : legacyChatItems(chat.reponse || '')
  return (
    <div className="chat-answer">
      {(sections.length ? intro : legacy?.intro) && <p className="chat-answer-intro">{sections.length ? intro : legacy.intro}</p>}
      {sections.map((section, index) => (
        <section className="chat-answer-section" key={`${section.titre}-${index}`}>
          <h4>{cleanChatText(section.titre)}</h4>
          <ul>{section.items.map((item, i) => <li key={i}>{cleanChatText(item)}</li>)}</ul>
        </section>
      ))}
      {!sections.length && legacy?.items?.length > 0 && (
        <section className="chat-answer-section"><ul>{legacy.items.map((item, i) => <li key={i}>{item}</li>)}</ul></section>
      )}
    </div>
  )
}

function PublicationDrawer({ open, onClose, publications, search, setSearch, onSelect, selectedId }) {
  const matches = useMemo(() => {
    const q = normalize(search)
    if (!q) return publications
    return publications.filter(p => normalize(`${p.publication_id} ${p.titre} ${p.organisme_producteur} ${p.domaine || ''} ${p.année_publication || ''}`).includes(q))
  }, [search, publications])
  return (
    <>
      <button className={`orbit-drawer-scrim ${open ? 'open' : ''}`} aria-label="Fermer le volet publications" onClick={onClose} tabIndex={open ? 0 : -1} />
      <aside className={`orbit-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="orbit-drawer-head">
          <div>
            <span className="orbit-kicker">Corpus</span>
            <h2>Choisir une publication</h2>
            <p>{publications.length} publication{publications.length > 1 ? 's' : ''} avec graphe</p>
          </div>
          <button onClick={onClose} className="orbit-icon-btn" title="Fermer" aria-label="Fermer"><Icon name="close" size={18} /></button>
        </div>
        <div className="orbit-drawer-search">
          <Icon name="search" size={17} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Titre, organisme, domaine, identifiant…" aria-label="Rechercher une publication" />
        </div>
        <div className="orbit-drawer-count">{matches.length} résultat{matches.length > 1 ? 's' : ''}</div>
        <div className="orbit-drawer-list">
          {matches.map(p => (
            <button key={p.publication_id} className={`orbit-drawer-item ${selectedId === p.publication_id ? 'selected' : ''}`} onClick={() => onSelect(p)}>
              {p.has_image ? <img src={`.${p.image_path}`} alt="" /> : <div className="orbit-mini-placeholder">{p.publication_id}</div>}
              <div>
                <small>{p.publication_id}</small>
                <strong>{sentenceCase(p.titre)}</strong>
                <span>{p.organisme_producteur}{p.année_publication ? ` · ${p.année_publication}` : ''}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>
    </>
  )
}

function OrbitIllustration() {
  const pts = [[0, -78], [74, -26], [46, 64], [-46, 64], [-74, -26]]
  const cols = ['#7FB2FF', '#FF6B81', '#3FE0C5', '#8CF08A', '#FFB86B']
  return (
    <svg className="orbit-home-art" viewBox="-160 -120 320 240" aria-hidden="true">
      <ellipse cx="0" cy="0" rx="92" ry="80" fill="none" stroke="#3FE0C5" strokeOpacity=".25" strokeDasharray="2 6" />
      <ellipse cx="0" cy="0" rx="146" ry="112" fill="none" stroke="#8fa8b4" strokeOpacity=".15" strokeDasharray="2 8" />
      {pts.map(([x, y], i) => <line key={`l${i}`} x1="0" y1="0" x2={x} y2={y} stroke={cols[i]} strokeOpacity=".6" />)}
      <circle r="44" fill="#B79CFF" opacity=".12" />
      <circle r="16" fill="#e8deff" />
      <circle r="16" fill="none" stroke="#fff" strokeDasharray="3 4" strokeOpacity=".8" transform="scale(1.45)" />
      {pts.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="18" fill={cols[i]} opacity=".18" /><circle cx={x} cy={y} r="7" fill={cols[i]} /></g>)}
      {[[-130, -60], [128, 40], [-120, 70], [140, -70], [10, 110], [-20, -112]].map(([x, y], i) => <circle key={`d${i}`} cx={x} cy={y} r="3" fill="#8fa8b4" opacity=".5" />)}
    </svg>
  )
}

function ExplorerHome({ onChoose, count }) {
  return (
    <main className="orbit-home">
      <section className="orbit-home-hero">
        <div className="orbit-home-copy">
          <span className="orbit-kicker">Explorer une publication</span>
          <h1>Naviguez dans les publications et dans les univers métiers du ministère de l’Intérieur</h1>
          <p>
            <strong>À la différence d’un graphe de réseaux</strong>, qui met principalement en évidence des
            connexions entre acteurs ou objets, le graphe de connaissances organise l’information sous la forme
            d’entités — idées, personnes, lieux, événements, dispositifs, etc. — reliées entre elles par des
            relations sémantiques explicites, souvent formulées à l’aide de verbes d’action.
          </p>
          <p>
            Il permet ainsi de <strong>naviguer à l’intérieur d’un texte et des connaissances qu’il mobilise</strong>,
            en passant d’une entité à une autre et en suivant les relations qui les relient.
          </p>
          <p>
            Le <strong>GraphRAG</strong> prolonge cette logique en permettant d’interroger les contenus documentaires
            et d’en extraire des objets spécifiques : <strong>acteurs, recommandations, localisations, actions,
            enjeux, concepts</strong>, etc.
          </p>
          <button className="atlas-btn primary orbit-home-cta" onClick={onChoose}>
            <Icon name="file" size={17} />Choisir une publication
            <small>{count} publications avec graphe</small>
          </button>
        </div>
        <OrbitIllustration />
      </section>

      <aside className="orbit-home-howto">
        <h3>Comment fonctionne cet espace ?</h3>
        {[
          ['Choisissez une publication', 'Recherchez une source dans le corpus.'],
          ['Placez un sujet au centre', 'Les entités liées gravitent autour, avec le verbe de chaque relation.'],
          ['Suivez le fil du document', 'Les pages où le sujet apparaît, et l’extrait qui le prouve.'],
          ['Interrogez la publication', 'Posez vos questions en langage naturel.'],
        ].map(([t, d], i) => (
          <div className="orbit-home-step" key={t}><b>{i + 1}</b><div><strong>{t}</strong><p>{d}</p></div></div>
        ))}
      </aside>
    </main>
  )
}

function Accordion({ title, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`atlas-accordion ${open ? 'open' : ''}`}>
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span>{title}{count !== undefined && <b className="atlas-accordion-count">{count}</b>}</span>
        <span aria-hidden="true" className="atlas-accordion-chevron">⌄</span>
      </button>
      {open && <div className="atlas-accordion-body">{children}</div>}
    </div>
  )
}

export default function Explorer({ data, onOpenAtlas }) {
  const graphPubs = useMemo(() => data.publications.filter(p => p.has_graph), [data])
  const [selectedPub, setSelectedPub] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [nodeSearch, setNodeSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [focusId, setFocusId] = useState(null)
  const [trail, setTrail] = useState([])
  const [disabledTypes, setDisabledTypes] = useState(() => new Set())
  const [proof, setProof] = useState(null)
  const [question, setQuestion] = useState('')
  const [chat, setChat] = useState(null)
  const [loading, setLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [resetToken, setResetToken] = useState(0)
  const [understandOpen, setUnderstandOpen] = useState(false)
  const [guideStep, setGuideStep] = useState(1)
  const [guideCollapsed, setGuideCollapsed] = useState(() => {
    try { return Boolean(window.sessionStorage.getItem(GUIDE_DONE_KEY)) } catch (_e) { return false }
  })
  const screenRef = useRef(null)
  const stageRef = useRef(null)

  // En vue publication, l'écran reste calé sur la fenêtre (pas de défilement).
  useEffect(() => {
    if (!selectedPub) return undefined
    const prev = document.body.style.overflow
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [selectedPub?.publication_id])

  const pubId = selectedPub?.publication_id
  const allNodes = useMemo(() => (pubId ? data.nodes.filter(n => n.publication_id === pubId) : []), [data, pubId])
  const allRelations = useMemo(() => (pubId ? data.relations.filter(r => r.publication_id === pubId) : []), [data, pubId])
  const contents = useMemo(() => (pubId ? data.contents.filter(c => c.publication_id === pubId) : []), [data, pubId])
  const nodeMap = useMemo(() => Object.fromEntries(allNodes.map(n => [n.node_id, n])), [allNodes])

  const presentTypes = useMemo(() => {
    const counts = {}
    allNodes.forEach(n => { const t = normalizeType(n.type_noeud); counts[t] = (counts[t] || 0) + 1 })
    const order = Object.keys(ORBIT_TYPES)
    return Object.entries(counts).sort((a, b) => (order.indexOf(a[0]) + 99 * (order.indexOf(a[0]) < 0)) - (order.indexOf(b[0]) + 99 * (order.indexOf(b[0]) < 0)))
  }, [allNodes])

  const nodes = useMemo(() => allNodes.filter(n => !disabledTypes.has(normalizeType(n.type_noeud))), [allNodes, disabledTypes])
  const relations = useMemo(() => {
    const ids = new Set(nodes.map(n => n.node_id))
    return allRelations.filter(r => ids.has(r.source_id) && ids.has(r.cible_id))
  }, [nodes, allRelations])

  const degree = useMemo(() => {
    const d = {}
    relations.forEach(r => { d[r.source_id] = (d[r.source_id] || 0) + 1; d[r.cible_id] = (d[r.cible_id] || 0) + 1 })
    return d
  }, [relations])
  const hub = useMemo(() => [...nodes].sort((a, b) => (degree[b.node_id] || 0) - (degree[a.node_id] || 0))[0], [nodes, degree])
  const focus = (focusId && nodes.find(n => n.node_id === focusId)) || hub || null

  const expertises = useMemo(
    () => (pubId ? data.expertise_nodes.filter(x => (x.publications || []).some(p => p.publication_id === pubId)) : []),
    [data, pubId]
  )

  const choosePublication = p => {
    setSelectedPub(p)
    setFocusId(null)
    setTrail([])
    setDisabledTypes(new Set())
    setChat(null)
    setQuestion('')
    setChatOpen(false)
    setNodeSearch('')
    setDrawerOpen(false)
    setResetToken(x => x + 1)
    if (!guideCollapsed) setGuideStep(s => (s === 1 ? 1 : 2))
  }

  const goTo = node => {
    if (!node) return
    const t = normalizeType(node.type_noeud)
    if (disabledTypes.has(t)) setDisabledTypes(s => { const n = new Set(s); n.delete(t); return n })
    setFocusId(node.node_id)
    setTrail(prev => {
      const base = prev.length ? prev : (focus ? [focus.node_id] : [])
      const cut = base.indexOf(node.node_id)
      const next = cut >= 0 ? base.slice(0, cut + 1) : [...base, node.node_id]
      return next.slice(-6)
    })
    if (!guideCollapsed && guideStep === 2) setGuideStep(3)
  }

  const resetView = () => {
    setFocusId(null)
    setTrail([])
    setDisabledTypes(new Set())
    setNodeSearch('')
    setResetToken(x => x + 1)
  }

  const toggleType = t => setDisabledTypes(s => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n })

  async function runQuestion(value) {
    const q = String(value || '').trim()
    if (!q || loading) return
    setQuestion(q)
    setLoading(true)
    setChatOpen(true)
    try { setChat(await askGraph(q, selectedPub, allNodes, allRelations)) }
    catch (err) { setChat({ error: err.message, reponse: err.message || 'Le service de dialogue n’est pas disponible.', noeuds_selectionnes: [] }) }
    finally { setLoading(false) }
  }

  const nextGuide = () => {
    if (guideStep < 4) setGuideStep(s => s + 1)
    else {
      setGuideCollapsed(true)
      try { window.sessionStorage.setItem(GUIDE_DONE_KEY, '1') } catch (_e) {}
    }
  }

  if (!selectedPub) {
    return (
      <div className="atlas-screen orbit-screen orbit-screen-home">
        <ExplorerHome onChoose={() => setDrawerOpen(true)} count={graphPubs.length} />
        <PublicationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} publications={graphPubs} search={search} setSearch={setSearch} onSelect={choosePublication} />
      </div>
    )
  }

  const q = normalize(nodeSearch)
  const nodeMatches = q ? allNodes.filter(n => normalize(n.libelle).includes(q)).slice(0, 8) : []
  const highlighted = chat?.noeuds_selectionnes || []

  const focusRelations = focus ? allRelations.filter(r => r.source_id === focus.node_id || r.cible_id === focus.node_id) : []
  const linked = [...new Map(focusRelations.map(r => {
    const other = nodeMap[r.source_id === focus.node_id ? r.cible_id : r.source_id]
    return [other?.node_id, other]
  })).values()].filter(Boolean)
  const chunk = focus
    ? String(focus.chunk_id_source || '').split(';').map(s => s.trim()).map(id => contents.find(c => c.chunk_id === id)).find(Boolean)
    : null
  const focusPages = focus ? [...new Set(pagesOf(focus))].sort((a, b) => a - b) : []

  return (
    <div className="atlas-screen orbit-screen" ref={screenRef}>
      <div className="orbit-toolbar" role="search">
        <button type="button" className="orbit-pubbtn" onClick={() => setDrawerOpen(true)} title="Changer de publication">
          <Icon name="file" size={17} />
          <span><small>Publication · {selectedPub.publication_id}</small><strong>{sentenceCase(selectedPub.titre)}</strong></span>
          <Icon name="chevron" size={16} />
        </button>

        <div className="atlas-search orbit-search">
          <Icon name="search" size={18} />
          <input
            value={nodeSearch}
            onChange={e => setNodeSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            onKeyDown={e => {
              if (e.key === 'Enter' && nodeMatches[0]) { goTo(nodeMatches[0]); setNodeSearch('') }
              if (e.key === 'Escape') setNodeSearch('')
            }}
            placeholder="Rechercher une entité dans la publication…"
            aria-label="Rechercher une entité dans la publication"
          />
          {searchFocused && nodeSearch && (
            <div className="atlas-search-results" role="listbox">
              {nodeMatches.length === 0 && <p className="atlas-muted">Aucune entité ne correspond.</p>}
              {nodeMatches.map(n => (
                <button type="button" key={n.node_id} onMouseDown={e => e.preventDefault()} onClick={() => { goTo(n); setNodeSearch('') }}>
                  <i style={{ background: typeColor(normalizeType(n.type_noeud)) }} aria-hidden="true" />
                  <span>{n.libelle}<small>{typeLabel(normalizeType(n.type_noeud))}</small></span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="atlas-counters" aria-label="Statistiques du graphe">
          <span><strong>{nodes.length}</strong> entités</span>
          <span aria-hidden="true">·</span>
          <span><strong>{relations.length}</strong> relations</span>
        </div>

        <button type="button" className={`orbit-chat-pill ${chatOpen ? 'is-open' : ''}`} onClick={() => setChatOpen(v => !v)} aria-expanded={chatOpen}>
          <span className="orbit-chat-orb" aria-hidden="true" />Interroger la publication
        </button>

        <button type="button" className="atlas-btn outline" onClick={resetView}>
          <Icon name="reset" size={16} /><span>Réinitialiser</span>
        </button>
      </div>

      <div className="orbit-body">
        <aside className="orbit-left" aria-label="Publication et types d’entités">
          <h2 className="orbit-panel-title"><i aria-hidden="true" />Publication</h2>
          <article className="orbit-pubcard">
            {selectedPub.has_image ? <img src={`.${selectedPub.image_path}`} alt="" /> : <div className="orbit-mini-placeholder">{selectedPub.publication_id}</div>}
            <div>
              <strong>{sentenceCase(selectedPub.titre)}</strong>
              <small>{selectedPub.organisme_producteur}{selectedPub.année_publication ? ` · ${selectedPub.année_publication}` : ''}</small>
            </div>
          </article>

          <div className="orbit-types-head">
            <h2 className="orbit-panel-title small">Types d’entités</h2>
            {disabledTypes.size > 0 && <button type="button" className="orbit-link" onClick={() => setDisabledTypes(new Set())}>Tout afficher</button>}
          </div>
          <div className="orbit-types">
            {presentTypes.map(([t, count]) => (
              <button
                type="button"
                key={t}
                className={`orbit-type ${disabledTypes.has(t) ? 'off' : ''}`}
                onClick={() => toggleType(t)}
                aria-pressed={!disabledTypes.has(t)}
                title={disabledTypes.has(t) ? 'Afficher ce type' : 'Masquer ce type'}
              >
                <i style={{ background: typeColor(t), boxShadow: disabledTypes.has(t) ? 'none' : `0 0 8px ${typeColor(t)}` }} />
                <span>{typeLabel(t)}</span>
                <b>{count}</b>
              </button>
            ))}
          </div>
          <p className="orbit-hint">Cliquez sur un type pour le masquer ou l’afficher. Tous les types présents dans la publication sont listés.</p>
        </aside>

        <section className="orbit-stage" ref={stageRef} aria-label="Graphe de la publication">
          {trail.length > 1 && (
            <nav className="orbit-crumb" aria-label="Parcours">
              <span className="orbit-crumb-k">Parcours</span>
              {trail.map((id, i) => {
                const n = nodeMap[id]
                if (!n) return null
                const last = i === trail.length - 1
                return (
                  <React.Fragment key={`${id}-${i}`}>
                    {i > 0 && <span className="orbit-crumb-sep" aria-hidden="true">›</span>}
                    <button type="button" className={last ? 'current' : ''} onClick={() => !last && goTo(n)} disabled={last} title={n.libelle}>
                      {n.libelle.length > 34 ? `${n.libelle.slice(0, 32)}…` : n.libelle}
                    </button>
                  </React.Fragment>
                )
              })}
            </nav>
          )}

          {focus ? (
            <PublicationOrbit
              nodes={nodes}
              relations={relations}
              focusId={focus.node_id}
              onFocus={goTo}
              onOpenRelation={r => setProof(r)}
              onOpenProof={n => setProof(n)}
              highlightIds={highlighted}
              contents={contents}
              resetToken={resetToken}
            />
          ) : (
            <p className="orbit-empty">Aucune entité à afficher avec les filtres actuels.</p>
          )}

          {chatOpen && (
            <div className="orbit-chat" role="dialog" aria-label="Interroger la publication">
              <header>
                <span className="orbit-chat-orb" aria-hidden="true" />
                <strong>Interroger la publication</strong>
                <button type="button" className="orbit-icon-btn" onClick={() => setChatOpen(false)} aria-label="Réduire">−</button>
              </header>
              <div className="orbit-chat-scroll">
                {!chat && !loading && <p className="orbit-chat-welcome">Posez une question sur les connaissances et les relations présentes dans cette publication.</p>}
                {loading && <div className="orbit-chat-loading"><span /><p>Recherche dans le graphe documentaire…</p></div>}
                {chat && (
                  <div className="orbit-chat-response">
                    <ChatAnswer chat={chat} />
                    {highlighted.length > 0 && (
                      <div className="atlas-chips orbit-chat-links">
                        {highlighted.slice(0, 8).map(id => nodeMap[id] ? (
                          <button type="button" className="atlas-chip clickable" key={id} onClick={() => goTo(nodeMap[id])}>{nodeMap[id].libelle}</button>
                        ) : null)}
                      </div>
                    )}
                  </div>
                )}
                <div className="orbit-chat-suggestions">
                  {CHAT_SUGGESTIONS.map(s => <button type="button" key={s} disabled={loading} onClick={() => runQuestion(s)}>{s}</button>)}
                </div>
              </div>
              <form onSubmit={e => { e.preventDefault(); runQuestion(question) }} className="orbit-chat-form">
                <textarea
                  rows="2"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }}
                  placeholder="Posez une question sur cette publication…"
                  aria-label="Votre question"
                />
                <button disabled={loading || !question.trim()} title="Envoyer" aria-label="Envoyer"><Icon name="send" size={18} /></button>
              </form>
            </div>
          )}
        </section>

        <aside className="orbit-side" aria-label="Fiche de l’entité">
          {focus && (
            <article className="atlas-card orbit-card">
              <div className="atlas-card-type">
                <i style={{ background: typeColor(normalizeType(focus.type_noeud)) }} />
                {typeLabel(normalizeType(focus.type_noeud))}
              </div>
              <h2>{focus.libelle}</h2>

              <p className="orbit-card-meta">
                {focusPages.length
                  ? `Apparaît sur ${focusPages.length} page${focusPages.length > 1 ? 's' : ''} de la publication`
                  : 'Pages non renseignées pour cette entité'}
              </p>
              {focusPages.length > 0 && (
                <div className="orbit-pages">
                  {focusPages.slice(0, 10).map(p => <span key={p}>p. {p}</span>)}
                  {focusPages.length > 10 && <span>+{focusPages.length - 10}</span>}
                </div>
              )}

              <div className="orbit-proof">
                {chunk ? (
                  <>
                    <b>Preuve · p. {chunk.page_debut}{chunk.page_fin && chunk.page_fin !== chunk.page_debut ? `–${chunk.page_fin}` : ''}{chunk.section ? ` · ${chunk.section}` : ''}</b>
                    <p>{chunk.texte.replace(/\s+/g, ' ').slice(0, 320)}{chunk.texte.length > 320 ? '…' : ''}</p>
                  </>
                ) : (
                  <p>Aucun extrait associé n’est disponible pour cette entité.</p>
                )}
                <button type="button" className="orbit-link" onClick={() => setProof(focus)}>
                  <Icon name="eye" size={15} /> Voir la preuve complète
                </button>
              </div>

              <Accordion title="Entités liées" count={linked.length}>
                <div className="orbit-linked">
                  {linked.length === 0 && <span className="atlas-muted">Aucune</span>}
                  {linked.map(n => (
                    <button type="button" key={n.node_id} onClick={() => goTo(n)}>
                      <i style={{ background: typeColor(normalizeType(n.type_noeud)) }} />
                      <span>{n.libelle}<small>{typeLabel(normalizeType(n.type_noeud))}</small></span>
                    </button>
                  ))}
                </div>
              </Accordion>

              <Accordion title="Relations" count={focusRelations.length}>
                <div className="orbit-relations">
                  {focusRelations.length === 0 && <span className="atlas-muted">Aucune</span>}
                  {focusRelations.map((r, i) => (
                    <button type="button" key={r.relation_id || i} onClick={() => setProof(r)} title="Voir la preuve de cette relation">
                      <span className={r.source_id === focus.node_id ? 'is-focus' : ''}>{nodeMap[r.source_id]?.libelle}</span>
                      <em>{verbLabel(r.type_relation)}</em>
                      <span className={r.cible_id === focus.node_id ? 'is-focus' : ''}>{nodeMap[r.cible_id]?.libelle}</span>
                    </button>
                  ))}
                </div>
              </Accordion>

              <Accordion title="Expertises révélées par la publication" count={expertises.length}>
                <div className="orbit-expertises">
                  {expertises.length === 0 && <span className="atlas-muted">Aucune expertise de l’Atlas n’est rattachée à cette publication.</span>}
                  {expertises.map(x => (
                    <button type="button" key={x.id} onClick={() => onOpenAtlas?.(x.id)} title="Ouvrir dans l’Atlas des expertises">
                      <span>{x.label}</span>
                      <small>Voir dans l’Atlas →</small>
                    </button>
                  ))}
                </div>
              </Accordion>
            </article>
          )}
        </aside>
      </div>

      <ExplorerGuide
        step={guideStep}
        collapsed={guideCollapsed}
        onNext={nextGuide}
        onPrevious={() => setGuideStep(s => Math.max(1, s - 1))}
        onCollapse={() => setGuideCollapsed(true)}
        onExpand={() => setGuideCollapsed(false)}
        understandOpen={understandOpen}
        setUnderstandOpen={setUnderstandOpen}
        screenRef={screenRef}
        stageRef={stageRef}
        relayoutKey={`${pubId}|${focus?.node_id}|${chatOpen}|${disabledTypes.size}|${trail.length > 1}`}
      />

      <ProofModal proof={proof} publication={selectedPub} contents={contents} nodeMap={nodeMap} onClose={() => setProof(null)} />
      <PublicationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} publications={graphPubs} search={search} setSearch={setSearch} onSelect={choosePublication} selectedId={selectedPub.publication_id} />
    </div>
  )
}
