import React, { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import ExpertiseConstellation from '../components/ExpertiseConstellation.jsx'
import AtlasGuide from '../components/AtlasGuide.jsx'
import {
  expertiseGephiLayout,
  expertiseClusters,
} from '../components/expertiseGephiLayout.js'
import { atlasClusterColor } from '../components/atlasPalette.js'
import { normalize, sentenceCase } from '../lib/text.js'
// Feuilles historiques conservées : d'autres règles globales peuvent en
// dépendre. Le nouvel Atlas n'utilise que des classes « atlas-* ».
import '../expertises-fenetres-originales.css'
import '../eclaireur.css'
// Polices embarquées (latin uniquement) : Manrope pour l'interface,
// Source Serif 4 pour les titres. Aucun appel réseau externe.
import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-500.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'
import '@fontsource/source-serif-4/latin-500.css'
import '@fontsource/source-serif-4/latin-600.css'
import '@fontsource/source-serif-4/latin-400-italic.css'
import '../atlas-expertises.css'

const familyColor = {
  'Instrument / dispositif': '#9B7BFF',
  'Méthode / savoir-faire': '#FFC24A',
  'Problème public': '#2EF0C3',
}

const MINISTRY_ENTITIES = new Set([
  'Centre de recherche de la Gendarmerie nationale',
  'Service statistique ministériel de la sécurité intérieure',
  'Inspection générale de l’administration',
  'Commandement du ministère de l’Intérieur dans le cyberespace / Centre d’analyse des cybermenaces',
  'École nationale supérieure de la police',
  'Centre d’analyse et de lutte contre les atteintes aux élus',
  'Direction générale des étrangers en France',
  'Préfecture de la région Auvergne-Rhône-Alpes',
  'Direction générale de la sécurité intérieure',
])

function Accordion({ title, count, children, defaultOpen = false, className = '' }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`atlas-accordion ${open ? 'open' : ''} ${className}`}>
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span>
          {title}
          {count !== undefined && <b className="atlas-accordion-count">{count}</b>}
        </span>
        <span aria-hidden="true" className="atlas-accordion-chevron">⌄</span>
      </button>

      {open && (
        <div className="atlas-accordion-body">
          {children}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panneau gauche — Communautés d'expertise (clusters réels du layout Gephi)
// ---------------------------------------------------------------------------
function CommunitiesPanel({
  open,
  onToggle,
  communities,
  totalInCommunities,
  isolatedCount,
  activeId,
  hoverId,
  onHover,
  onOpen,
  onOverview,
  guideTarget,
}) {
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = normalize(query)
    return q
      ? communities.filter(c => normalize(c.label).includes(q))
      : communities
  }, [communities, query])

  if (!open) {
    return (
      <aside className="atlas-communities is-collapsed" aria-label="Communautés d’expertise (panneau replié)">
        <button
          type="button"
          className="atlas-communities-expand"
          onClick={onToggle}
          aria-label="Déplier le panneau Communautés d’expertise"
          title="Déplier le panneau Communautés d’expertise"
        >
          <span aria-hidden="true">»</span>
          <span className="atlas-communities-vertical">Communautés d’expertise</span>
        </button>
        <div className="atlas-communities-dots" aria-hidden="true">
          {communities.map(c => (
            <i key={c.id} style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
          ))}
        </div>
      </aside>
    )
  }

  return (
    <aside className={`atlas-communities ${guideTarget ? 'atlas-guide-target' : ''}`} aria-label="Communautés d’expertise">
      <header className="atlas-panel-head">
        <h2><i aria-hidden="true" />Communautés d’expertise</h2>
        <button
          type="button"
          className="atlas-icon-button"
          onClick={onToggle}
          aria-label="Replier le panneau Communautés d’expertise"
          title="Replier le panneau"
        >
          «
        </button>
      </header>

      <div className="atlas-input-wrap">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Trouver une communauté"
          aria-label="Rechercher une communauté"
        />
        <Icon name="search" size={17} />
      </div>

      <ul className="atlas-community-list">
        {!query && (
          <li>
            <button
              type="button"
              className={`atlas-community ${activeId === null ? 'is-active' : ''}`}
              onClick={onOverview}
            >
              <i className="atlas-community-dot all" aria-hidden="true" />
              <span className="atlas-community-name">Toutes les communautés</span>
              <b>{totalInCommunities}</b>
            </button>
          </li>
        )}

        {visible.map(c => (
          <li key={c.id}>
            <button
              type="button"
              className={`atlas-community ${activeId === c.id ? 'is-active' : ''} ${hoverId === c.id ? 'is-hover' : ''}`}
              disabled={c.count === 0}
              onMouseEnter={() => onHover(c.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(c.id)}
              onBlur={() => onHover(null)}
              onClick={() => onOpen(c.id)}
              title={c.count === 0 ? 'Aucune expertise avec les filtres actuels' : `Explorer : ${c.label}`}
            >
              <i
                className="atlas-community-dot"
                style={{ background: c.color, boxShadow: `0 0 10px ${c.color}` }}
                aria-hidden="true"
              />
              <span className="atlas-community-name">
                {c.label}
                {c.transdirectional && <em>Cluster transdirectionnel</em>}
              </span>
              <b>{c.count}</b>
            </button>
          </li>
        ))}

        {visible.length === 0 && (
          <li className="atlas-community-empty">Aucune communauté ne correspond à « {query} ».</li>
        )}
      </ul>

      {isolatedCount > 0 && (
        <p className="atlas-isolated-note">
          <i aria-hidden="true" />
          {isolatedCount} micro-expertise{isolatedCount > 1 ? 's' : ''} isolée{isolatedCount > 1 ? 's' : ''}, rattachée{isolatedCount > 1 ? 's' : ''} à aucune communauté, figure{isolatedCount > 1 ? 'nt' : ''} aussi sur le graphe.
        </p>
      )}
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Fiche détaillée d'une expertise (contenu identique à l'ancien volet)
// ---------------------------------------------------------------------------
function ExpertiseCard({ selected, data, onClose, onOpen, guideTarget }) {
  const layout = expertiseGephiLayout[selected.id]
  const cluster = layout
    ? expertiseClusters.find(c => c.id === layout.cluster)
    : null

  return (
    <article className={`atlas-card ${guideTarget ? 'atlas-guide-target' : ''}`} aria-label={`Fiche : ${selected.label}`}>
      <button
        type="button"
        className="atlas-card-close"
        onClick={onClose}
        aria-label="Fermer la fiche"
      >
        <Icon name="close" size={18} />
      </button>

      <div className="atlas-card-type">
        <i style={{ background: familyColor[selected.family] || '#FFC24A' }} />
        {selected.family}
      </div>

      <h2>{selected.label}</h2>

      {selected.definition && (
        <p className="atlas-card-definition">
          {selected.definition}
        </p>
      )}

      {cluster && (
        <Accordion title="Cluster">
          <p className="atlas-card-cluster">
            <i style={{ background: atlasClusterColor(cluster.id), boxShadow: `0 0 8px ${atlasClusterColor(cluster.id)}` }} />
            <span>
              {cluster.label}
              {cluster.transdirectional && <em>Cluster transdirectionnel</em>}
            </span>
          </p>
        </Accordion>
      )}

      <Accordion title="Entité(s)" count={(selected.entities || []).length}>
        <div className="atlas-chips">
          {(selected.entities || []).length === 0 && <span className="atlas-muted">Non renseignée</span>}
          {(selected.entities || []).map(x => (
            <span className="atlas-chip" key={x}>
              {x}
            </span>
          ))}
        </div>
      </Accordion>

      <Accordion title="Expertises directement associées" count={(selected.associated || []).filter(a => data.expertise_nodes.some(x => x.id === a.id)).slice(0, 12).length}>
        <div className="atlas-chips">
          {(selected.associated || [])
            .slice(0, 12)
            .map(a => {
              const n = data.expertise_nodes.find(
                x => x.id === a.id
              )

              return n ? (
                <button
                  type="button"
                  className="atlas-chip clickable"
                  key={a.id}
                  onClick={() => onOpen(n)}
                >
                  {n.label}
                </button>
              ) : null
            })}
          {(selected.associated || []).length === 0 && <span className="atlas-muted">Aucune</span>}
        </div>
      </Accordion>

      <Accordion title="Domaines mobilisés" count={(selected.domains || []).length}>
        <div className="atlas-chips">
          {(selected.domains || []).map(x => (
            <span className="atlas-chip" key={x}>
              {x}
            </span>
          ))}
          {(selected.domains || []).length === 0 && <span className="atlas-muted">Non renseignés</span>}
        </div>
      </Accordion>

      <Accordion title="Publications associées" count={(selected.publications || []).length}>
      <div className="atlas-publications">
        {(selected.publications || []).length === 0 && <span className="atlas-muted">Aucune publication associée</span>}
        {(selected.publications || [])
          .map(p => {
            const href = p.url_contenu || p.url_source

            const content = (
              <>
                {p.image_path ? (
                  <img
                    src={`.${p.image_path}`}
                    alt=""
                  />
                ) : (
                  <div className="atlas-pub-placeholder">
                    {p.publication_id}
                  </div>
                )}

                <div>
                  <strong>
                    {sentenceCase(p.titre)}
                  </strong>

                  <small>
                    {p.organisme} · {p.annee}
                  </small>
                </div>
              </>
            )

            return href ? (
              <a
                className="atlas-publication"
                key={p.publication_id}
                href={href}
                target="_blank"
                rel="noreferrer"
                title="Ouvrir la publication dans un nouvel onglet"
              >
                {content}
              </a>
            ) : (
              <div className="atlas-publication" key={p.publication_id}>
                {content}
              </div>
            )
          })}
      </div>
      </Accordion>
    </article>
  )
}

export default function Expertises({ data }) {
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [entity, setEntity] = useState('Toutes les entités')
  const [family, setFamily] = useState('Tous')
  const [eclaireurCollapsed, setEclaireurCollapsed] = useState(false)
  const [eclaireurStep, setEclaireurStep] = useState(1)
  const [eclaireurCluster, setEclaireurCluster] = useState(null)
  const [understandOpen, setUnderstandOpen] = useState(false)
  const [communitiesOpen, setCommunitiesOpen] = useState(true)
  const [panelHoverCluster, setPanelHoverCluster] = useState(null)
  const [graphHoverCluster, setGraphHoverCluster] = useState(null)
  const [focusRequest, setFocusRequest] = useState(null)

  const [resetToken, setResetToken] = useState(0)
  const [fitToken, setFitToken] = useState(0)
  const sideRef = useRef(null)
  const screenRef = useRef(null)
  const stageRef = useRef(null)

  const entities = useMemo(
    () => [
      'Toutes les entités',
      ...new Set(
        data.expertise_nodes
          .flatMap(n => n.entities || [])
          .filter(x => MINISTRY_ENTITIES.has(x))
      ),
    ].sort((a, b) => a.localeCompare(b, 'fr')),
    [data]
  )

  const filtered = useMemo(
    () =>
      data.expertise_nodes.filter(
        n =>
          (
            entity === 'Toutes les entités' ||
            (n.entities || []).includes(entity)
          ) &&
          (
            family === 'Tous' ||
            n.family === family
          )
      ),
    [data, entity, family]
  )

  const found = useMemo(() => {
    const q = normalize(search)

    return q
      ? filtered
          .filter(n =>
            normalize(
              `${n.label} ${n.definition} ${(n.entities || []).join(' ')}`
            ).includes(q)
          )
          .slice(0, 8)
      : []
  }, [search, filtered])

  const visibleEdges = useMemo(() => {
    const ids = new Set(filtered.map(n => n.id))

    return data.expertise_edges.filter(
      e => ids.has(e.source) && ids.has(e.target)
    )
  }, [filtered, data])

  // Communautés réelles : les 15 clusters nommés du layout Gephi, avec leur
  // nombre de micro-expertises calculé sur les nœuds actuellement filtrés.
  const communities = useMemo(() => {
    const counts = new Map()
    filtered.forEach(n => {
      const c = expertiseGephiLayout[n.id]?.cluster
      if (c === undefined) return
      counts.set(c, (counts.get(c) || 0) + 1)
    })

    return expertiseClusters
      .map(c => ({
        id: c.id,
        label: c.label,
        transdirectional: Boolean(c.transdirectional),
        color: atlasClusterColor(c.id),
        count: counts.get(c.id) || 0,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr'))
  }, [filtered])

  const namedIds = useMemo(() => new Set(expertiseClusters.map(c => c.id)), [])
  const totalInCommunities = communities.reduce((a, c) => a + c.count, 0)
  const isolatedCount = filtered.filter(n => {
    const c = expertiseGephiLayout[n.id]?.cluster
    return c !== undefined && !namedIds.has(c)
  }).length

  const openExpertise = node => {
    setSelected(node)
    // Pendant le parcours guidé, L'Éclaireur vient se placer près de la
    // fiche. S'il a été réduit, il reste discret.
    if (node && !eclaireurCollapsed) {
      setEclaireurStep(4)
    }
  }

  // La fiche s'ouvre sous L'Éclaireur : on la fait défiler en vue.
  useEffect(() => {
    if (!selected || !sideRef.current) return
    sideRef.current.scrollTo?.({ top: 0, behavior: 'smooth' })
  }, [selected])

  const handleClusterChange = cluster => {
    setEclaireurCluster(cluster)

    if (cluster && !eclaireurCollapsed && eclaireurStep === 3) {
      setEclaireurStep(4)
    }

    if (!cluster && !selected && eclaireurStep === 4) {
      setEclaireurStep(3)
    }
  }

  const nextEclaireur = () => {
    if (eclaireurStep < 4) {
      setEclaireurStep(step => step + 1)
    } else {
      setEclaireurCollapsed(true)
    }
  }

  const previousEclaireur = () => {
    setEclaireurStep(step => Math.max(1, step - 1))
    setEclaireurCollapsed(false)
  }

  const clear = () => {
    setSelected(null)
    setSearch('')
    setEntity('Toutes les entités')
    setFamily('Tous')
    setEclaireurCluster(null)
    setPanelHoverCluster(null)
    setResetToken(x => x + 1)
  }

  const requestCluster = id => {
    setFocusRequest(current => ({ id, token: (current?.token || 0) + 1 }))
  }

  const guideActive = !eclaireurCollapsed

  return (
    <main
      ref={screenRef}
      className={`expertise-screen atlas-screen ${communitiesOpen ? '' : 'communities-collapsed'} ${selected ? 'has-card' : ''}`}
    >
      <div className={`atlas-toolbar ${guideActive && eclaireurStep === 2 ? 'atlas-guide-target' : ''}`} role="search">
        <div className="atlas-search">
          <Icon name="search" size={18} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            onKeyDown={e => {
              if (e.key === 'Enter' && found[0]) {
                openExpertise(found[0])
                setSearch('')
              }
              if (e.key === 'Escape') setSearch('')
            }}
            placeholder="Rechercher une expertise, un mot-clé, une entité…"
            aria-label="Rechercher une expertise ou un mot-clé"
          />

          {searchFocused && search && (
            <div className="atlas-search-results" role="listbox">
              {found.length === 0 && (
                <p className="atlas-muted">Aucune expertise ne correspond.</p>
              )}
              {found.map(n => {
                const c = expertiseGephiLayout[n.id]?.cluster
                return (
                  <button
                    type="button"
                    key={n.id}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      openExpertise(n)
                      setSearch('')
                    }}
                  >
                    <i style={{ background: atlasClusterColor(c) }} aria-hidden="true" />
                    <span>
                      {n.label}
                      <small>{n.family}</small>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <label className="atlas-select">
          <span>Entité</span>
          <select
            value={entity}
            onChange={e => {
              setEntity(e.target.value)
              setSelected(null)
            }}
          >
            {entities.map(x => (
              <option key={x}>
                {x}
              </option>
            ))}
          </select>
        </label>

        <label className="atlas-select atlas-select-type">
          <span>Type d’expertise</span>
          <select
            value={family}
            onChange={e => {
              setFamily(e.target.value)
              setSelected(null)
            }}
          >
            <option>Tous</option>
            <option>Instrument / dispositif</option>
            <option>Méthode / savoir-faire</option>
            <option>Problème public</option>
          </select>
        </label>

        <div className="atlas-counters" aria-label="Statistiques du graphe">
          <span><strong>{filtered.length}</strong> nœuds</span>
          <span aria-hidden="true">·</span>
          <span><strong>{visibleEdges.length}</strong> relations</span>
        </div>

        <div className="atlas-toolbar-actions">
          <button type="button" className="atlas-btn ghost" onClick={() => setFitToken(x => x + 1)} title="Ajuster à l’écran">
            <Icon name="target" size={16} />
            <span>Ajuster</span>
          </button>
          <button type="button" className="atlas-btn outline" onClick={clear}>
            <Icon name="reset" size={16} />
            <span>Réinitialiser</span>
          </button>
        </div>
      </div>

      <div className="atlas-body">
        <CommunitiesPanel
          open={communitiesOpen}
          onToggle={() => setCommunitiesOpen(v => !v)}
          communities={communities}
          totalInCommunities={totalInCommunities}
          isolatedCount={isolatedCount}
          activeId={eclaireurCluster?.id ?? null}
          hoverId={panelHoverCluster ?? graphHoverCluster}
          onHover={setPanelHoverCluster}
          onOpen={requestCluster}
          onOverview={() => requestCluster(null)}
          guideTarget={guideActive && (eclaireurStep === 2 || eclaireurStep === 3)}
        />

        <section className="atlas-stage" ref={stageRef} aria-label="Graphe des expertises">
          <ExpertiseConstellation
            nodes={filtered}
            edges={visibleEdges}
            selected={selected}
            onSelect={openExpertise}
            onClusterChange={handleClusterChange}
            onHoverCluster={setGraphHoverCluster}
            highlightClusterId={panelHoverCluster}
            focusClusterRequest={focusRequest}
            guideOverviewStep={
              guideActive && eclaireurStep === 3 && !selected
                ? 2
                : null
            }
            guidePulseNode={
              guideActive &&
              eclaireurStep === 4 &&
              !selected &&
              Boolean(eclaireurCluster)
            }
            resetToken={resetToken}
            fitToken={fitToken}
          />
        </section>

        {selected && (
          <aside className="atlas-side" ref={sideRef} aria-label="Fiche de l’expertise">
            <ExpertiseCard
              selected={selected}
              data={data}
              onClose={() => setSelected(null)}
              onOpen={openExpertise}
              guideTarget={false}
            />
          </aside>
        )}
      </div>

      <AtlasGuide
        step={eclaireurStep}
        collapsed={eclaireurCollapsed}
        selected={selected}
        activeCluster={eclaireurCluster?.id ?? null}
        onNext={nextEclaireur}
        onPrevious={previousEclaireur}
        onCollapse={() => setEclaireurCollapsed(true)}
        onExpand={() => setEclaireurCollapsed(false)}
        understandOpen={understandOpen}
        setUnderstandOpen={setUnderstandOpen}
        screenRef={screenRef}
        stageRef={stageRef}
        relayoutKey={`${entity}|${family}|${communitiesOpen}|${resetToken}|${fitToken}`}
      />
    </main>
  )
}
