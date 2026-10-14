import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

// ---------------------------------------------------------------------------
// L'ÉCLAIREUR MOBILE — « sentient design »
//
// L'Éclaireur n'a plus de place fixe : à chaque étape, il se pose PRÈS de ce
// qu'il explique (la barre de filtres, une communauté, un point lumineux, la
// fiche ouverte), dans la zone libre la plus proche. Sa position est calculée
// à partir de ce qui est réellement affiché à l'écran :
//   - interdit : couvrir un bouton (zoom, retour) ou la cible elle-même ;
//   - fortement pénalisé : couvrir un intitulé ou une étiquette ;
//   - pénalisé : couvrir un nœud lumineux ;
//   - recherché : être proche de la cible, et bouger le moins possible.
// Un fin faisceau lumineux relie L'Éclaireur à ce qu'il désigne.
// Réduit, il devient une pastille qui se range dans un coin libre.
// ---------------------------------------------------------------------------

const STEP_PX = 16
const MARGIN_PX = 12

function inflate(r, d) {
  return { left: r.left - d, top: r.top - d, right: r.right + d, bottom: r.bottom + d }
}

function intersectArea(a, b) {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return w > 0 && h > 0 ? w * h : 0
}

function rectGap(a, b) {
  const dx = Math.max(0, a.left - b.right, b.left - a.right)
  const dy = Math.max(0, a.top - b.bottom, b.top - a.bottom)
  return Math.hypot(dx, dy)
}

function unionRect(rects) {
  const list = rects.filter(r => r && r.width > 0 && r.height > 0)
  if (!list.length) return null
  const left = Math.min(...list.map(r => r.left))
  const top = Math.min(...list.map(r => r.top))
  const right = Math.max(...list.map(r => r.right))
  const bottom = Math.max(...list.map(r => r.bottom))
  return { left, top, right, bottom, width: right - left, height: bottom - top }
}

function nearestPoint(rect, x, y) {
  return {
    x: Math.max(rect.left, Math.min(x, rect.right)),
    y: Math.max(rect.top, Math.min(y, rect.bottom)),
  }
}

export default function ExplorerGuide({
  step,
  collapsed,
  selected,
  onNext,
  onPrevious,
  onCollapse,
  onExpand,
  understandOpen,
  setUnderstandOpen,
  screenRef,
  stageRef,
  relayoutKey,
}) {
  const cardRef = useRef(null)
  const [pos, setPos] = useState(null)
  const [beam, setBeam] = useState(null)
  const [maxHeight, setMaxHeight] = useState(560)
  const posRef = useRef(null)
  // Forme compacte (bandeau) quand la carte complète ne trouve aucune place
  // libre : L'Éclaireur s'adapte à l'espace plutôt que de masquer le contenu.
  const [compact, setCompact] = useState(false)
  const compactRef = useRef(false)
  // Réouverture demandée par l'utilisateur : jamais de rangement automatique.
  const userOpenedRef = useRef(false)
  useEffect(() => { userOpenedRef.current = false }, [selected?.id])
  // Lecture de « Comprendre cette carte » : la carte complète est voulue.
  const forceFull = step === 1 && understandOpen
  const timers = useRef([])

  // Cible désignée par l'étape en cours (rectangle écran) -------------------
  const findTarget = useCallback(() => {
    const screen = screenRef.current
    if (!screen || collapsed) return null
    if (step === 2) {
      const core = screen.querySelector('.orbit-node.ring-0 .orbit-core')
      return core ? core.getBoundingClientRect() : null
    }
    if (step === 3) {
      const strip = screen.querySelector('.orbit-strip')
      return strip ? strip.getBoundingClientRect() : null
    }
    if (step === 4) {
      const chat = screen.querySelector('.orbit-chat-pill, .orbit-chat')
      return chat ? chat.getBoundingClientRect() : null
    }
    return null
  }, [screenRef, collapsed, step])

  // Calcul de la meilleure position ----------------------------------------
  const place = useCallback(() => {
    const screen = screenRef.current
    const stage = stageRef.current
    const card = cardRef.current
    if (!screen || !stage || !card) return

    const S = screen.getBoundingClientRect()
    const G = stage.getBoundingClientRect()
    if (G.width < 50 || G.height < 50) return

    const limitH = Math.max(220, G.height - 2 * MARGIN_PX)
    if (Math.abs(limitH - maxHeight) > 1) setMaxHeight(limitH)

    const w = card.offsetWidth
    const h = Math.min(card.offsetHeight, limitH)

    const target = findTarget()
    const targetInStage =
      target && target.right > G.left && target.left < G.right && target.bottom > G.top && target.top < G.bottom

    // Obstacles visibles dans le graphe.
    const obstacles = []
    stage.querySelectorAll('.orbit-node').forEach(g => {
      const core = g.querySelector('.orbit-core')
      if (!core) return
      const r = core.getBoundingClientRect()
      const strong = g.classList.contains('ring-0') || g.classList.contains('ring-1')
      obstacles.push({ r: inflate(r, 4), w: strong ? 4 : 0.5 })
    })
    stage.querySelectorAll('.orbit-label, .orbit-pill, .orbit-focus-label').forEach(e => {
      obstacles.push({ r: inflate(e.getBoundingClientRect(), 4), w: 10 })
    })
    obstacles.forEach(o => { o.area = Math.max(1, (o.r.right - o.r.left) * (o.r.bottom - o.r.top)) })
    const texts = obstacles.filter(o => o.w >= 10).map(o => o.r)

    const forbidden = []
    stage.querySelectorAll('.orbit-zoom, .orbit-strip, .orbit-crumb, .orbit-chat-pill, .orbit-chat').forEach(e => {
      forbidden.push(inflate(e.getBoundingClientRect(), 8))
    })
    if (targetInStage) forbidden.push(inflate(target, 14))

    const prev = posRef.current
    let best = null
    let strictFound = false

    // Passe 1 : aucun intitulé ne peut être recouvert. Passe 2 (si aucune
    // place n'existe) : les intitulés deviennent seulement très pénalisés.
    for (const strict of [true, false]) {
    for (let y = G.top + MARGIN_PX; y + h <= G.bottom - MARGIN_PX + 0.5; y += STEP_PX) {
      for (let x = G.left + MARGIN_PX; x + w <= G.right - MARGIN_PX + 0.5; x += STEP_PX) {
        const r = { left: x, top: y, right: x + w, bottom: y + h }
        if (forbidden.some(f => intersectArea(r, f) > 0)) continue
        if (strict && texts.some(t => intersectArea(r, t) > 0)) continue

        let cost = 0
        for (const o of obstacles) {
          const a = intersectArea(r, o.r)
          if (a) cost += (o.w * a) / o.area
        }
        const overlap = cost

        if (target) {
          const gap = rectGap(r, target)
          cost += Math.max(0, gap - 28) * 0.016
        } else if (collapsed) {
          // Pastille : de préférence en bas à droite du graphe.
          cost += Math.hypot(G.right - r.right, G.bottom - r.bottom) * 0.004
        } else {
          // Accueil : de préférence en haut à droite, à l'écart du centre.
          cost += Math.hypot(G.right - r.right, r.top - G.top) * 0.004
        }

        if (prev) cost += Math.hypot(prev.x + S.left - x, prev.y + S.top - y) * 0.0025

        if (!best || cost < best.cost) best = { cost, overlap, x, y, r }
      }
    }
    if (best) { strictFound = strict; break }
    }

    // Pas de place libre pour la carte complète : passage au bandeau compact
    // (sauf à l'accueil, où l'on lit « Comprendre cette carte »).
    // Le graphe passe avant le guide : si la carte complète masquerait plus de
    // trois nœuds lumineux (ou un intitulé), L'Éclaireur se fait bandeau.
    const crowded = !strictFound || (best && best.overlap > 13)
    // Fiche ouverte et aucune place libre, même pour le bandeau : la fiche
    // porte l'information, L'Éclaireur se range en pastille.
    if (!strictFound && compactRef.current && !collapsed && step === 4 && selected && !userOpenedRef.current) {
      onCollapse?.()
      return
    }
    if (crowded && !compactRef.current && !collapsed && !forceFull) {
      compactRef.current = true
      setCompact(true)
      timers.current.push(setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(place)), 40))
      return
    }

    if (!best) {
      best = { x: G.right - MARGIN_PX - w, y: G.top + MARGIN_PX, r: null }
      best.r = { left: best.x, top: best.y, right: best.x + w, bottom: best.y + h }
    }

    const next = { x: best.x - S.left, y: best.y - S.top }
    posRef.current = next
    setPos(next)

    if (target) {
      const tc = { x: (target.left + target.right) / 2, y: (target.top + target.bottom) / 2 }
      const from = nearestPoint(best.r, tc.x, tc.y)
      const to = nearestPoint(target, from.x, from.y)
      const len = Math.hypot(to.x - from.x, to.y - from.y)
      setBeam(len > 18 ? { x1: from.x - S.left, y1: from.y - S.top, x2: to.x - S.left, y2: to.y - S.top, key: `${step}-${Math.round(to.x)}-${Math.round(to.y)}` } : null)
    } else {
      setBeam(null)
    }
  }, [screenRef, stageRef, findTarget, collapsed, maxHeight, step, forceFull, selected, onCollapse])

  const schedule = useCallback((delays = [0, 120, 420]) => {
    timers.current.forEach(clearTimeout)
    timers.current = delays.map(d =>
      setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(place)), d)
    )
  }, [place])

  useLayoutEffect(() => {
    if (compactRef.current) {
      compactRef.current = false
      setCompact(false)
    }
    schedule()
  }, [relayoutKey, step, collapsed, understandOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Taille de la carte ou du graphe modifiée → on se repositionne.
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => schedule([60, 260]))
    if (cardRef.current) ro.observe(cardRef.current)
    if (stageRef.current) ro.observe(stageRef.current)
    return () => ro.disconnect()
  }, [schedule, stageRef, collapsed])

  // Après un déplacement ou un zoom du graphe, L'Éclaireur se décale s'il
  // masque désormais quelque chose (la pénalité de déplacement le garde
  // immobile sinon).
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    let t = null
    const later = () => { clearTimeout(t); t = setTimeout(() => schedule([0]), 650) }
    stage.addEventListener('pointerup', later)
    stage.addEventListener('wheel', later, { passive: true })
    window.addEventListener('resize', later)
    return () => {
      clearTimeout(t)
      stage.removeEventListener('pointerup', later)
      stage.removeEventListener('wheel', later)
      window.removeEventListener('resize', later)
    }
  }, [stageRef, schedule])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const style = pos
    ? { transform: `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px)`, opacity: 1 }
    : { transform: 'translate(-9999px, 0)', opacity: 0 }

  // Contenu ------------------------------------------------------------------
  const content = {
    2: {
      title: 'Le sujet au centre',
      body: (
        <p>
          L’entité au centre est le sujet que vous explorez. Les entités qui lui
          sont <strong>directement liées</strong> gravitent autour, avec le
          <strong> verbe</strong> de la relation. Cliquez sur l’une d’elles :
          elle passe au centre, et vous suivez le fil du texte.
        </p>
      ),
    },
    3: {
      title: 'Le fil du document',
      body: (
        <p>
          En bas, les repères ambrés montrent les <strong>pages</strong> où le
          sujet apparaît. La fiche, à droite, donne l’<strong>extrait</strong>{' '}
          qui le prouve ; un clic sur un verbe ouvre la preuve de la relation.
        </p>
      ),
    },
    4: {
      title: 'Interrogez la publication',
      body: (
        <p>
          Posez une question en langage naturel : les entités concernées
          s’allument dans le graphe.
        </p>
      ),
    },
  }[step]

  const shortText = {
    1: 'Bonjour ! Je suis L’Éclaireur, votre guide dans ce graphe.',
    2: 'Cliquez sur une entité de l’orbite pour la placer au centre.',
    3: 'Les repères ambrés situent le sujet dans les pages du document.',
    4: 'Posez une question à la publication : les entités concernées s’allument.',
  }[step]

  const beamSvg = beam && (
    <svg className="atlas-guide-beam" aria-hidden="true">
      <defs>
        <linearGradient id="orbit-beam-grad" gradientUnits="userSpaceOnUse" x1={beam.x1} y1={beam.y1} x2={beam.x2} y2={beam.y2}>
          <stop offset="0%" stopColor="#3FE0C5" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFB86B" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <g key={beam.key} className="atlas-guide-beam-in">
        <line x1={beam.x1} y1={beam.y1} x2={beam.x2} y2={beam.y2} stroke="url(#orbit-beam-grad)" strokeWidth="6" opacity="0.18" strokeLinecap="round" />
        <line x1={beam.x1} y1={beam.y1} x2={beam.x2} y2={beam.y2} stroke="url(#orbit-beam-grad)" strokeWidth="1.5" strokeLinecap="round" />
        <circle className="atlas-guide-beam-dot" cx={beam.x2} cy={beam.y2} r="4.5" />
      </g>
    </svg>
  )

  const actions = (compactMode) => (
    <div className="atlas-guide-actions">
      {step === 1 && compactMode && (
        <button type="button" className="atlas-btn ghost atlas-btn-text" onClick={() => setUnderstandOpen(true)}>
          Comprendre
        </button>
      )}
      {step > 1 && (
        <button type="button" className="atlas-btn ghost" onClick={onPrevious} aria-label="Étape précédente" title="Étape précédente">
          {compactMode ? '‹' : 'Précédent'}
        </button>
      )}
      <button type="button" className="atlas-btn primary" onClick={onNext}>
        {step === 1 ? 'Commencer' : step < 4 ? 'Suivant' : 'Compris'}
      </button>
      {compactMode && (
        <button type="button" className="atlas-guide-reduce" onClick={onCollapse} aria-label="Réduire L’Éclaireur" title="Réduire L’Éclaireur">−</button>
      )}
    </div>
  )

  if (!collapsed && !forceFull && compact) {
    return (
      <>
        {beamSvg}
        <section ref={cardRef} className="atlas-guide atlas-guide-compact" style={style} aria-label="L’Éclaireur" aria-live="polite">
          <span className="atlas-orb atlas-orb-small" aria-hidden="true" />
          <div className="atlas-guide-compact-text">
            <span className="atlas-guide-kicker">L’Éclaireur{step > 1 ? ` · étape ${step} sur 4` : ''}</span>
            <p>{shortText}</p>
          </div>
          {actions(true)}
        </section>
      </>
    )
  }

  if (collapsed) {
    return (
      <button
        ref={cardRef}
        type="button"
        className="atlas-guide-pill"
        style={style}
        onClick={() => { userOpenedRef.current = true; onExpand?.() }}
        aria-label="Ouvrir L’Éclaireur"
        title="Ouvrir L’Éclaireur"
      >
        <span className="atlas-orb atlas-orb-small" aria-hidden="true" />
        <span>L’Éclaireur</span>
      </button>
    )
  }

  return (
    <>
      {beamSvg}
      <section ref={cardRef} className="atlas-guide" style={{ ...style, maxHeight }} aria-label="L’Éclaireur" aria-live="polite">
        <header className="atlas-guide-head">
          <span className="atlas-orb atlas-orb-small" aria-hidden="true" />
          <span className="atlas-eclaireur-name">
            <strong>L’Éclaireur</strong>
            <small>Votre guide dans la publication</small>
          </span>
          <span className="atlas-eclaireur-step">{step}/4</span>
          <button type="button" className="atlas-guide-reduce" onClick={onCollapse} aria-label="Réduire L’Éclaireur" title="Réduire L’Éclaireur">−</button>
        </header>

        <div className="atlas-guide-body">
          {step === 1 ? (
            <>
              <h3 className="atlas-guide-hello">Bonjour !</h3>
              <p className="atlas-eclaireur-intro">
                Je suis L’Éclaireur. Ce graphe représente les <strong>connaissances
                extraites de la publication</strong> : des entités (acteurs,
                notions, problèmes, lieux, recommandations…) reliées par des
                relations formulées avec des verbes.
              </p>
              <div className={`atlas-accordion atlas-understand ${understandOpen ? 'open' : ''}`}>
                <button type="button" onClick={() => setUnderstandOpen(v => !v)} aria-expanded={understandOpen}>
                  <span>Comprendre ce graphe</span>
                  <span aria-hidden="true" className="atlas-accordion-chevron">⌄</span>
                </button>
                {understandOpen && (
                  <div className="atlas-accordion-body atlas-understand-body">
                    <h4>Un graphe de connaissances</h4>
                    <p>
                      <strong>À la différence d’un graphe de réseaux</strong>, qui met
                      principalement en évidence des connexions entre acteurs ou objets,
                      le graphe de connaissances organise l’information sous la forme
                      d’entités — idées, personnes, lieux, événements, dispositifs, etc. —
                      reliées entre elles par des relations sémantiques explicites,
                      souvent formulées à l’aide de verbes d’action.
                    </p>
                    <p>
                      Il permet ainsi de <strong>naviguer à l’intérieur d’un texte et des
                      connaissances qu’il mobilise</strong>, en passant d’une entité à une
                      autre et en suivant les relations qui les relient.
                    </p>
                    <p>
                      Le <strong>GraphRAG</strong> prolonge cette logique en permettant
                      d’interroger les contenus documentaires et d’en extraire des objets
                      spécifiques : acteurs, recommandations, localisations, actions,
                      enjeux, concepts, etc.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="atlas-guide-step">
              <span className="atlas-guide-kicker">Parcours guidé · étape {step} sur 4</span>
              <h3>{content.title}</h3>
              {content.body}
            </div>
          )}

          <div className="atlas-guide-footer">
            <div className="atlas-dots" aria-hidden="true">
              {[1, 2, 3, 4].map(n => <i key={n} className={n === step ? 'active' : ''} />)}
            </div>
            {actions(false)}
          </div>
        </div>
      </section>
    </>
  )
}
