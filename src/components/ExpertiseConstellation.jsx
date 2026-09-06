import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  expertiseGephiLayout,
  expertiseClusters,
} from './expertiseGephiLayout.js'

const FAMILY_COLORS = {
  'Instrument / dispositif': '#7258d9',
  'Méthode / savoir-faire': '#ffb20e',
  'Problème public': '#14af75',
}

const DEFAULT_CLUSTER_COLOR = '#cfd5dd'

// Plafond de zoom. Relevé de 3 à 6 : les petites constellations butaient
// dessus et ne remplissaient pas le cadre à l'ouverture.
const MAX_SCALE = 6

// ---------------------------------------------------------------------------
// COMPACTAGE GÉOMÉTRIQUE — calculé une seule fois, au chargement du module.
//
// Les coordonnées Gephi ne sont PAS recalculées : chaque cluster est déplacé
// comme un CORPS RIGIDE (translation pure), donc la forme interne de chaque
// constellation est conservée au pixel près. Seule la position relative des
// constellations change, ainsi que celle des micro-expertises isolées.
//
// Une expertise est « isolée » lorsqu'elle est seule dans sa classe de
// modularité : critère déduit du seul expertiseGephiLayout, donc stable et
// indépendant des filtres de la page.
// ---------------------------------------------------------------------------

const COMPACT = {
  R0: 350,      // rayon en deçà duquel rien n'est déplacé
  F: 0.45,      // compression radiale au-delà de R0
  KY: 0.70,     // aplatissement vertical (le cadre est plus large que haut)
  ITER: 300,    // passes de relaxation anti-chevauchement
  WY: 0.22,     // séparation biaisée vers l'horizontale
  CY: -46,      // barycentre du réseau connecté
}

function buildCompactLayout() {
  const ids = Object.keys(expertiseGephiLayout)

  const members = new Map()
  ids.forEach(id => {
    const c = expertiseGephiLayout[id].cluster
    if (!members.has(c)) members.set(c, [])
    members.get(c).push(id)
  })

  const bodies = []
  members.forEach((arr, clusterId) => {
    const solo = arr.length === 1
    const group = solo ? arr.map(id => [id]) : [arr]

    group.forEach(ids2 => {
      const cx =
        ids2.reduce((a, id) => a + expertiseGephiLayout[id].x, 0) / ids2.length
      const cy =
        ids2.reduce((a, id) => a + expertiseGephiLayout[id].y, 0) / ids2.length

      const spread = Math.max(
        ...ids2.map(id =>
          Math.hypot(
            expertiseGephiLayout[id].x - cx,
            expertiseGephiLayout[id].y - cy
          )
        )
      )

      const r = Math.hypot(cx, cy - COMPACT.CY) || 1
      const factor = solo ? COMPACT.F * 0.8 : COMPACT.F
      const nr = r <= COMPACT.R0 ? r : COMPACT.R0 + (r - COMPACT.R0) * factor
      const sc = nr / r

      bodies.push({
        ids: ids2,
        clusterId,
        solo,
        ox: cx,
        oy: cy,
        x: cx * sc,
        y: (cy - COMPACT.CY) * sc * COMPACT.KY + COMPACT.CY,
        rad: spread + (solo ? 30 : 60),
      })
    })
  })

  for (let t = 0; t < COMPACT.ITER; t += 1) {
    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        const a = bodies[i]
        const b = bodies[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = Math.hypot(dx, dy) || 0.01
        const need = a.rad + b.rad
        if (d >= need) continue

        let ux = dx / d
        let uy = (dy / d) * COMPACT.WY
        const un = Math.hypot(ux, uy) || 1
        ux /= un
        uy /= un

        const push = ((need - d) / 2) * 0.6
        a.x -= ux * push
        a.y -= uy * push
        b.x += ux * push
        b.y += uy * push
      }
    }
  }

  const positions = {}
  bodies.forEach(body => {
    const tx = body.x - body.ox
    const ty = body.y - body.oy
    body.ids.forEach(id => {
      positions[id] = {
        x: expertiseGephiLayout[id].x + tx,
        y: expertiseGephiLayout[id].y + ty,
        size: expertiseGephiLayout[id].size,
        cluster: expertiseGephiLayout[id].cluster,
        isolated: body.solo,
      }
    })
  })

  return positions
}

const compactLayout = buildCompactLayout()

const GRAPH_CENTER = (() => {
  const pts = Object.values(compactLayout)
  return {
    x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
    y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
  }
})()


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function nodeScore(node) {
  const layout = expertiseGephiLayout[node.id]
  return Number(layout?.size || 0)
}

// ÉTAPE 2A — le plafond par défaut passe de 80 à Infinity.
// La logique interne de la fonction est conservée telle quelle : elle reste
// utilisable avec une limite explicite si un besoin d'échantillonnage revient.
export function selectOverviewExpertises(nodes, limit = Infinity) {
  const eligible = (nodes || []).filter(node => expertiseGephiLayout[node.id])

  if (eligible.length <= limit) {
    return eligible
  }

  const sorted = [...eligible].sort((a, b) => nodeScore(b) - nodeScore(a))
  const selected = []
  const selectedIds = new Set()
  const representedClusters = new Set()

  for (const node of sorted) {
    const cluster = expertiseGephiLayout[node.id]?.cluster
    if (!representedClusters.has(cluster)) {
      representedClusters.add(cluster)
      selectedIds.add(node.id)
      selected.push(node)
    }
  }

  for (const node of sorted) {
    if (selected.length >= limit) break
    if (selectedIds.has(node.id)) continue
    selectedIds.add(node.id)
    selected.push(node)
  }

  return selected
}

function wrapLabel(label, maxChars = 32, maxLines = 3) {
  const words = String(label || '').split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''

  words.forEach(word => {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  })

  if (current) lines.push(current)
  return lines.slice(0, maxLines)
}

function familyColor(family) {
  return FAMILY_COLORS[family] || '#64748b'
}

export default function ExpertiseConstellation({
  nodes,
  edges,
  selected,
  onSelect,
  nodeSize = 1,
  linkDensity = 1,
  resetToken = 0,
  fitToken = 0,
  readingOpen = false,
  onToggleReading,
  onCloseReading,
}) {
  const svgRef = useRef(null)
  const dragRef = useRef(null)

  const [mode, setMode] = useState('cluster')
  const [activeCluster, setActiveCluster] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  // Dimensions réelles du cadre, en pixels. Elles servent à deux choses :
  // aligner le viewBox sur le format du conteneur (plus de bandes latérales)
  // et exprimer la taille des titres en pixels écran et non en unités monde.
  const [viewport, setViewport] = useState({ w: 1120, h: 740 })

  useEffect(() => {
    const el = svgRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined

    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setViewport({ w: rect.width, h: rect.height })
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])


  const overviewNodes = useMemo(
    // ÉTAPE 2A — vue globale complète : 152 nœuds, plus d'échantillonnage.
    () => selectOverviewExpertises(nodes, Infinity),
    [nodes]
  )

  const displayedNodes = useMemo(() => {
    if (!selected || overviewNodes.some(node => node.id === selected.id)) {
      return overviewNodes
    }

    if (!expertiseGephiLayout[selected.id]) {
      return overviewNodes
    }

    return [...overviewNodes, selected]
  }, [overviewNodes, selected])

  const positionedNodes = useMemo(
    () =>
      displayedNodes
        .map(node => {
          const layout = compactLayout[node.id]
          if (!layout) return null
          return {
            ...node,
            x: layout.x,
            y: layout.y,
            gephiSize: layout.size,
            clusterId: layout.cluster,
          }
        })
        .filter(Boolean),
    [displayedNodes]
  )

  const byId = useMemo(
    () => new Map(positionedNodes.map(node => [node.id, node])),
    [positionedNodes]
  )

  const visibleEdges = useMemo(
    () =>
      (edges || []).filter(
        edge => byId.has(edge.source) && byId.has(edge.target)
      ),
    [edges, byId]
  )

  // -------------------------------------------------------------------------
  // MODÈLE DE MISE EN PAGE — passe unique, sans rétroaction.
  //
  // La taille des titres est calée sur une RÉFÉRENCE STABLE (l'emprise des
  // nœuds seuls), jamais sur le cadre final. Sans cela on obtient une boucle
  // divergente : un titre plus grand agrandit le cadre, qui agrandit le titre.
  // Le cadre final, lui, englobe les boîtes de titre réelles — donc plus
  // aucun titre n'est rogné.
  // -------------------------------------------------------------------------
  const TITLE_PX = 21
  const TITLE_BOOST = 1.4

  // Seuil d'affichage permanent des titres de clusters. En deçà, le titre
  // n'apparaît qu'au survol, au zoom, ou quand le cluster est ouvert.
  const TITLE_MIN_NODES = 6

  // Géométrie des étiquettes de nœuds en vue cluster ouvert, exprimée en
  // pixels écran puis convertie en unités monde via `unit`.
  const OPEN_LABEL_WIDTH = 230
  const OPEN_LABEL_OFFSET = 30
  const OPEN_LABEL_FONT_MAX = 17
  const OPEN_LABEL_FONT_MIN = 11
  const OPEN_LABEL_LINES = 3

  const model = useMemo(() => {
    const frameRatio = viewport.w / Math.max(1, viewport.h)

    const frame = (box, padX, padY) => {
      const w = Math.max(1, box.maxX - box.minX) * padX
      const h = Math.max(1, box.maxY - box.minY) * padY
      const cx = (box.minX + box.maxX) / 2
      const cy = (box.minY + box.maxY) / 2

      let vw = w
      let vh = h
      if (vw / vh < frameRatio) vw = vh * frameRatio
      else vh = vw / frameRatio

      return { x: cx - vw / 2, y: cy - vh / 2, w: vw, h: vh }
    }

    if (!positionedNodes.length) {
      const empty = frame(
        { minX: -900, maxX: 900, minY: -650, maxY: 950 },
        1.05,
        1.06
      )
      return { view: empty, clusters: [], unit: empty.h / Math.max(1, viewport.h) }
    }

    const nodeBox = {
      minX: Math.min(...positionedNodes.map(n => n.x)),
      maxX: Math.max(...positionedNodes.map(n => n.x)),
      minY: Math.min(...positionedNodes.map(n => n.y)),
      maxY: Math.max(...positionedNodes.map(n => n.y)),
    }

    const reference = frame(nodeBox, 1.3, 1.3)
    const unit = reference.h / Math.max(1, viewport.h)
    const titleSize = TITLE_PX * TITLE_BOOST * unit
    const lineHeight = titleSize * 1.16

    const grouped = new Map()
    positionedNodes.forEach(node => {
      if (!grouped.has(node.clusterId)) grouped.set(node.clusterId, [])
      grouped.get(node.clusterId).push(node)
    })

    const clusters = expertiseClusters
      .filter(cluster => grouped.has(cluster.id))
      .map(cluster => {
        const clusterNodes = grouped.get(cluster.id)
        const xs = clusterNodes.map(n => n.x)
        const ys = clusterNodes.map(n => n.y)

        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const minY = Math.min(...ys)
        const maxY = Math.max(...ys)
        const centerX = (minX + maxX) / 2
        const centerY = (minY + maxY) / 2

        const spread = Math.max(
          ...clusterNodes.map(n => Math.hypot(n.x - centerX, n.y - centerY))
        )

        // Quatre lignes autorisées : plus aucun titre tronqué.
        const lines = wrapLabel(cluster.label, 26, 4)
        const blockHeight =
          lines.length * lineHeight + (cluster.transdirectional ? lineHeight : 0)
        const halfW =
          (Math.max(...lines.map(l => l.length)) * titleSize * 0.5) / 2
        const halfH = blockHeight / 2

        let dx = centerX - GRAPH_CENTER.x
        let dy = centerY - GRAPH_CENTER.y
        const norm = Math.hypot(dx, dy) || 1
        dx /= norm
        dy /= norm

        // L'écartement tient compte de la dimension du bloc DANS la direction
        // où il part : un titre large chassé latéralement doit s'éloigner de
        // sa demi-largeur, pas de sa demi-hauteur.
        let offset =
          spread + 20 * unit + Math.abs(dx) * halfW + Math.abs(dy) * halfH
        let labelX = centerX + dx * offset
        let labelY = centerY + dy * offset

        // Répulsion contre les nœuds, bornée pour ne pas exiler le titre.
        for (let step = 0; step < 12; step += 1) {
          const hit = positionedNodes.some(
            n =>
              Math.abs(n.x - labelX) < halfW + 8 * unit &&
              Math.abs(n.y - labelY) < halfH + 8 * unit
          )
          if (!hit) break
          offset += 16 * unit
          labelX = centerX + dx * offset
          labelY = centerY + dy * offset
        }

        return {
          ...cluster,
          showLabel: clusterNodes.length >= TITLE_MIN_NODES,
          nodeIds: new Set(clusterNodes.map(n => n.id)),
          minX,
          maxX,
          minY,
          maxY,
          centerX,
          centerY,
          lines,
          blockHeight,
          titleSize,
          lineHeight,
          halfW,
          halfH,
          labelWorldWidth: halfW * 2,
          labelX,
          labelY,
          radius: Math.max(70, spread + 46),
        }
      })

    // Désempilement vertical entre titres.
    for (let iter = 0; iter < 60; iter += 1) {
      for (let i = 0; i < clusters.length; i += 1) {
        for (let j = i + 1; j < clusters.length; j += 1) {
          const a = clusters[i]
          const b = clusters[j]
          if (!a.showLabel || !b.showLabel) continue
          if (Math.abs(a.labelX - b.labelX) >= a.halfW + b.halfW) continue
          const needY = a.halfH + b.halfH + 8 * unit
          const gapY = Math.abs(a.labelY - b.labelY)
          if (gapY >= needY) continue

          const push = (needY - gapY) / 2 + 1
          if (a.labelY <= b.labelY) {
            a.labelY -= push
            b.labelY += push
          } else {
            a.labelY += push
            b.labelY -= push
          }
        }
      }
    }

    // Cadre final : nœuds ET boîtes de titre réelles.
    const xs = [nodeBox.minX - 16 * unit, nodeBox.maxX + 16 * unit]
    const ys = [nodeBox.minY - 16 * unit, nodeBox.maxY + 16 * unit]
    clusters.forEach(c => {
      if (!c.showLabel) return
      xs.push(c.labelX - c.halfW, c.labelX + c.halfW)
      ys.push(c.labelY - c.halfH - c.lineHeight, c.labelY + c.halfH)
    })

    const view = frame(
      {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
      },
      1.03,
      1.04
    )

    return { view, clusters, unit: view.h / Math.max(1, viewport.h) }
  }, [positionedNodes, viewport])

  const view = model.view
  const unit = model.unit
  const clusterStats = model.clusters

  const viewCenter = useMemo(
    () => ({
      x: view.x + view.w / 2,
      y: view.y + view.h / 2,
    }),
    [view]
  )

  // Cluster actuellement survolé, déduit du nœud sous le curseur : il sert à
  // révéler le titre des petits clusters, masqués en vue globale.
  const hoveredClusterId = useMemo(() => {
    if (!hoveredId) return null
    const node = positionedNodes.find(n => n.id === hoveredId)
    return node ? node.clusterId : null
  }, [hoveredId, positionedNodes])

  const selectedId = selected?.id || null

  const neighbourIds = useMemo(() => {
    if (!selectedId) return new Set()
    const ids = new Set([selectedId])

    visibleEdges.forEach(edge => {
      if (edge.source === selectedId) ids.add(edge.target)
      if (edge.target === selectedId) ids.add(edge.source)
    })

    return ids
  }, [selectedId, visibleEdges])

  useEffect(() => {
    setActiveCluster(null)
    setHoveredId(null)
    setScale(1)
    setPan({ x: 0, y: 0 })
    setMode('cluster')
  }, [resetToken])

  useEffect(() => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }, [fitToken])

  const zoom = factor => {
    setScale(current => clamp(current * factor, 0.72, MAX_SCALE))
  }

  const resetView = () => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }

  const closeCluster = () => {
    setActiveCluster(null)
    onSelect?.(null)
    setScale(1)
    setPan({ x: 0, y: 0 })
  }

  const focusCluster = cluster => {
    if (!cluster) return

    if (activeCluster === cluster.id) {
      closeCluster()
      return
    }

    // A cluster focus must not inherit a previous node selection.
    onSelect?.(null)
    setActiveCluster(cluster.id)

    const clusterNodes = positionedNodes.filter(
      node => node.clusterId === cluster.id
    )

    if (!clusterNodes.length) return

    const xs = clusterNodes.map(node => node.x)
    const ys = clusterNodes.map(node => node.y)
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2

    // Le zoom n'est plus une valeur forfaitaire : il est calculé pour que la
    // constellation ET ses étiquettes de nœuds remplissent réellement le cadre.
    const spanX = Math.max(...xs) - Math.min(...xs)
    const spanY = Math.max(...ys) - Math.min(...ys)

    // Les étiquettes occupent une largeur FIXE en pixels de chaque côté ; on
    // résout donc le zoom sur la place qui reste réellement au nuage de nœuds.
    const freeW =
      viewport.w * 0.94 - 2 * (OPEN_LABEL_OFFSET + OPEN_LABEL_WIDTH)
    const freeH = viewport.h * 0.94 - 2 * OPEN_LABEL_FONT_MAX * 2

    const byWidth = (freeW * unit) / Math.max(1, spanX)
    const byHeight = (freeH * unit) / Math.max(1, spanY)

    const nextScale = clamp(Math.min(byWidth, byHeight), 1, MAX_SCALE)

    setScale(nextScale)
    setPan({
      x: nextScale * (viewCenter.x - centerX),
      y: nextScale * (viewCenter.y - centerY),
    })
  }

  // Étiquettes des nœuds en vue cluster ouvert. La police n'est plus une
  // constante : elle est déduite de la hauteur disponible par étiquette, donc
  // aussi grande que le cluster le permet. Retourne aussi ses propres mesures.
  const activeNodeLabels = useMemo(() => {
    const none = { items: [], font: OPEN_LABEL_FONT_MIN, rowHeight: 0 }
    if (activeCluster === null) return none

    const cluster = clusterStats.find(item => item.id === activeCluster)
    if (!cluster) return none

    const clusterNodes = positionedNodes.filter(
      node => node.clusterId === activeCluster
    )
    if (!clusterNodes.length) return none

    const left = clusterNodes
      .filter(node => node.x < cluster.centerX)
      .sort((a, b) => a.y - b.y)

    const right = clusterNodes
      .filter(node => node.x >= cluster.centerX)
      .sort((a, b) => a.y - b.y)

    const perSide = Math.max(left.length, right.length, 1)
    const rowPx = (viewport.h * 0.96) / perSide

    const font = clamp(
      rowPx / (OPEN_LABEL_LINES * 1.28 + 0.7),
      OPEN_LABEL_FONT_MIN,
      OPEN_LABEL_FONT_MAX
    )

    // Tout est exprimé en pixels écran puis ramené en unités monde.
    const toWorld = px => (px * unit) / scale
    const gap = toWorld(Math.max(rowPx, font * (OPEN_LABEL_LINES * 1.28 + 0.7)))

    const distribute = (items, side) => {
      if (!items.length) return []

      const original = items.map(node => node.y)
      const placed = []

      items.forEach((node, index) => {
        const wanted = node.y
        const y =
          index === 0 ? wanted : Math.max(wanted, placed[index - 1].y + gap)
        placed.push({ node, y })
      })

      const avgOriginal =
        original.reduce((sum, value) => sum + value, 0) / original.length
      const avgPlaced =
        placed.reduce((sum, item) => sum + item.y, 0) / placed.length

      const shift = avgOriginal - avgPlaced
      const x =
        side === 'left'
          ? cluster.minX - toWorld(OPEN_LABEL_OFFSET)
          : cluster.maxX + toWorld(OPEN_LABEL_OFFSET)

      return placed.map(item => ({
        node: item.node,
        x,
        y: item.y + shift,
        side,
      }))
    }

    return {
      items: [...distribute(left, 'left'), ...distribute(right, 'right')],
      font,
      rowHeight: rowPx,
    }
  }, [activeCluster, clusterStats, positionedNodes, unit, scale, viewport])

  const onPointerDown = event => {
    if (event.button !== 0) return

    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
      rectWidth: rect.width,
      rectHeight: rect.height,
    }

    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = event => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const dx =
      (event.clientX - drag.startX) *
      (view.w / Math.max(1, drag.rectWidth)) /
      scale

    const dy =
      (event.clientY - drag.startY) *
      (view.h / Math.max(1, drag.rectHeight)) /
      scale

    setPan({
      x: drag.panX + dx,
      y: drag.panY + dy,
    })
  }

  const endDrag = event => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const zoomTransform = [
    `translate(${viewCenter.x + pan.x} ${viewCenter.y + pan.y})`,
    `scale(${scale})`,
    `translate(${-viewCenter.x} ${-viewCenter.y})`,
  ].join(' ')

  useEffect(() => {
    // L’interface validée ne montre pas le bloc « Afficher ».
    // On conserve les filtres Entité(s), Type d’expertise et les réglages d’affichage.
    const hideTextBlock = text => {
      const allEls = Array.from(document.querySelectorAll('aside h1, aside h2, aside h3, aside p, aside a, aside label, aside div, aside span'))
      const el = allEls.find(node => (node.textContent || '').trim() === text)
      if (!el) return
      el.style.display = 'none'
      const parent = el.parentElement
      if (parent && parent !== document.body) {
        const txt = (parent.textContent || '').trim()
        if (txt && txt.length < 180) {
          parent.style.display = 'none'
        }
      }
    }

    hideTextBlock('Afficher')
    hideTextBlock('Toutes les expertises')
    hideTextBlock('Mes expertises uniquement')
  }, [])

  const hoveredNode = hoveredId ? byId.get(hoveredId) : null
  const labelNode = selected && byId.get(selected.id)
    ? byId.get(selected.id)
    : hoveredNode

  return (
    <section className="constellation-shell gephi-entry-shell">
      <div className="gephi-view-switch map-reading-switch" aria-label="Lecture de la carte">
        <button
          type="button"
          className={readingOpen ? 'active' : ''}
          onClick={() => onToggleReading?.()}
          aria-expanded={readingOpen}
          aria-controls="map-reading-inline"
        >
          ⓘ&nbsp;&nbsp;Lecture de la carte
        </button>
      </div>

      {readingOpen && (
        <section
          id="map-reading-inline"
          className="map-reading-inline"
          aria-label="Lecture de la carte"
        >
          <button
            type="button"
            className="map-reading-inline-close"
            onClick={() => onCloseReading?.()}
            aria-label="Fermer la lecture de la carte"
          >
            ×
          </button>

          <h2>Lecture de la carte</h2>

          <p>
            Cette carte est un <strong>graphe en réseau réalisé avec Gephi</strong>.
            Chaque point représente une <strong>micro-expertise</strong> identifiée
            dans les publications du ministère. Les liens relient des expertises
            qui sont <strong>associées dans une même publication</strong>. Le graphe
            permet ainsi de visualiser non seulement des expertises prises
            séparément, mais aussi la manière dont elles se combinent.
          </p>

          <p>
            La disposition du réseau fait apparaître des ensembles plus densément
            reliés. Un algorithme de <strong>clusterisation</strong> repère ces
            communautés : un cluster rassemble des micro-expertises qui
            entretiennent davantage de relations entre elles qu’avec le reste du
            réseau. Les intitulés des clusters ont ensuite été construits à partir
            de leur contenu afin d’en faciliter la lecture.
            <strong> Ils ne correspondent donc ni à des catégories administratives
            ni à un classement prédéfini.</strong>
          </p>

          <p>
            Des expertises plus spécialisées ou isolées sont volontairement
            conservées. <strong>L’absence de lien ne signifie pas qu’elles sont
            moins importantes</strong>, mais seulement qu’aucune association
            suffisante avec d’autres expertises n’apparaît dans le corpus étudié.
          </p>

          <p>
            Certains clusters sont qualifiés de <strong>transdirectionnels</strong>
            lorsqu’ils réunissent des expertises mobilisées dans les publications
            de plusieurs entités du ministère. Ils font apparaître des domaines où
            des savoir-faire, méthodes ou problèmes publics se croisent au-delà
            des frontières organisationnelles.
          </p>

          <p className="map-reading-last">
            Le graphe sera alimenté par les productions futures repérées par le
            bulletin de veille.
          </p>
        </section>
      )}

      <div className="gephi-zoom-tools" aria-label="Zoom du graphe">
        <button type="button" onClick={() => zoom(1.18)} aria-label="Zoom avant">+</button>
        <button type="button" onClick={() => zoom(0.86)} aria-label="Zoom arrière">−</button>
        <button type="button" onClick={resetView} aria-label="Recentrer">⌾</button>
      </div>

      {activeCluster !== null && mode === 'cluster' && (
        <button
          type="button"
          className="gephi-back-cluster"
          onClick={closeCluster}
        >
          Retour à la carte complète
        </button>
      )}

      <svg
        ref={svgRef}
        className="gephi-entry-svg"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Carte des expertises ministérielles"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={event => {
          if (event.deltaY < 0) zoom(1.08)
          if (event.deltaY > 0) zoom(0.92)
        }}
      >
        <defs>
          <filter id="cluster-blur-entry">
            <feGaussianBlur stdDeviation="34" />
          </filter>
        </defs>

        <g transform={zoomTransform}>
          {(mode === 'cluster' || mode === 'category') && (
            <g className="entry-cluster-halos" aria-hidden="true">
              {clusterStats.map(cluster => {
                const dim =
                  activeCluster !== null &&
                  activeCluster !== cluster.id

                return (
                  <circle
                    key={`halo-${cluster.id}`}
                    cx={cluster.centerX}
                    cy={cluster.centerY}
                    r={cluster.radius}
                    fill={cluster.color || DEFAULT_CLUSTER_COLOR}
                    opacity={dim ? 0.015 : 0.21}
                    filter="url(#cluster-blur-entry)"
                  />
                )
              })}
            </g>
          )}

          <g className="entry-edges">
            {visibleEdges.map((edge, index) => {
              const source = byId.get(edge.source)
              const target = byId.get(edge.target)
              if (!source || !target) return null

              const selectedActive =
                !selectedId ||
                (
                  neighbourIds.has(edge.source) &&
                  neighbourIds.has(edge.target)
                )

              const clusterActive =
                activeCluster === null ||
                (
                  source.clusterId === activeCluster &&
                  target.clusterId === activeCluster
                )

              const sameCluster = source.clusterId === target.clusterId

              return (
                <line
                  key={`${edge.source}-${edge.target}-${index}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  className={
                    `${
                      selectedId &&
                      (edge.source === selectedId || edge.target === selectedId)
                        ? 'entry-edge active'
                        : 'entry-edge'
                    } ${sameCluster ? 'intra-cluster' : 'inter-cluster'}`
                  }
                  opacity={
                    selectedActive && clusterActive
                      ? (sameCluster ? 0.31 : 0.045) * linkDensity
                      : activeCluster !== null ? 0.012 : 0.028
                  }
                />
              )
            })}
          </g>

          <g className="entry-nodes">
            {positionedNodes.map(node => {
              const isSelected = selectedId === node.id
              const selectedActive =
                !selectedId || neighbourIds.has(node.id)

              const clusterActive =
                activeCluster === null ||
                node.clusterId === activeCluster

              const cluster = expertiseClusters.find(
                item => item.id === node.clusterId
              )

              const fill =
                mode === 'category'
                  ? familyColor(node.family)
                  : cluster?.color || DEFAULT_CLUSTER_COLOR

              const radius =
                Math.max(11, 7.5 + node.gephiSize * 0.70) *
                nodeSize *
                // Cluster ouvert : les nœuds cèdent la place au texte.
                (activeCluster !== null ? 0.55 : 1)

              return (
                <g
                  key={node.id}
                  className="constellation-node"
                  onPointerDown={event => event.stopPropagation()}
                >
                  <circle
                    className="node-hit-target"
                    cx={node.x}
                    cy={node.y}
                    r={radius + 7}
                    fill="transparent"
                    onMouseEnter={() => setHoveredId(node.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onFocus={() => setHoveredId(node.id)}
                    onBlur={() => setHoveredId(null)}
                    onClick={() => onSelect?.(node)}
                    tabIndex="0"
                    role="button"
                    aria-label={node.label}
                  />

                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius}
                    fill={fill}
                    stroke={isSelected ? '#0b2545' : '#ffffff'}
                    strokeWidth={isSelected ? 4.2 : 1.65}
                    opacity={
                      selectedActive && clusterActive
                        ? 0.98
                        : activeCluster !== null
                          ? 0.08
                          : 0.15
                    }
                    pointerEvents="none"
                  />
                </g>
              )
            })}
          </g>

          {(mode === 'cluster' || mode === 'category') && (
            <g className="entry-cluster-labels">
              {clusterStats.map(cluster => {
                // Titre permanent pour les grands clusters ; les autres
                // n'apparaissent qu'au survol, au zoom ou à l'ouverture.
                // Cluster ouvert : seul son titre reste. Les autres titres
                // sont retirés, sans quoi ils écrasent la constellation.
                if (activeCluster !== null) {
                  if (activeCluster !== cluster.id) return null
                } else {
                  const revealed =
                    cluster.showLabel ||
                    hoveredClusterId === cluster.id ||
                    scale > 1.35
                  if (!revealed) return null
                }

                const isOpen = activeCluster === cluster.id

                // En vue ouverte le groupe entier est agrandi par le zoom :
                // on divise donc la taille du titre par le facteur de zoom
                // pour qu'il conserve la même taille apparente à l'écran,
                // et on le repose juste au-dessus de la constellation.
                const titleSize = isOpen
                  ? cluster.titleSize / scale
                  : cluster.titleSize
                const lineHeight = isOpen
                  ? cluster.lineHeight / scale
                  : cluster.lineHeight

                const lines = cluster.lines
                const totalHeight = (lines.length - 1) * lineHeight

                const anchorX = isOpen ? cluster.centerX : cluster.labelX
                const anchorY = isOpen
                  ? cluster.minY - (lines.length + 1) * lineHeight
                  : cluster.labelY

                const halfW = isOpen
                  ? cluster.halfW / scale
                  : cluster.halfW

                const dim = false

                return (
                  <g
                    key={`label-${cluster.id}`}
                    className="entry-cluster-label"
                    opacity={dim ? 0.12 : 1}
                    role="button"
                    tabIndex="0"
                    aria-label={
                      cluster.transdirectional
                        ? `${cluster.label}, Cluster transdirectionnel`
                        : cluster.label
                    }
                    onPointerDown={event => event.stopPropagation()}
                    onClick={() => focusCluster(cluster)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        focusCluster(cluster)
                      }
                    }}
                  >
                    <rect
                      x={anchorX - halfW}
                      y={anchorY - totalHeight / 2 - lineHeight}
                      width={halfW * 2}
                      height={
                        (lines.length + (cluster.transdirectional ? 2 : 1)) *
                        lineHeight
                      }
                      fill="transparent"
                    />

                    <text
                      x={anchorX}
                      y={anchorY - totalHeight / 2}
                      textAnchor="middle"
                      className="entry-cluster-title-svg"
                      style={{ fontSize: `${titleSize}px` }}
                    >
                      {lines.map((line, index) => (
                        <tspan
                          key={`${cluster.id}-${index}`}
                          x={anchorX}
                          dy={index === 0 ? 0 : lineHeight}
                        >
                          {line}
                        </tspan>
                      ))}
                    </text>

                    {cluster.transdirectional && (
                      <text
                        x={anchorX}
                        y={anchorY + totalHeight / 2 + lineHeight}
                        textAnchor="middle"
                        className="entry-cluster-transdirectional-svg"
                        style={{ fontSize: `${titleSize * 0.62}px` }}
                      >
                        Cluster transdirectionnel
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          )}

          {activeCluster !== null && (
            <g className="entry-node-labels-open-cluster" pointerEvents="none">
              {activeNodeLabels.items.map(item => {
                // Plus d'encadré : le texte seul, aussi grand que possible.
                const openFont = (activeNodeLabels.font * unit) / scale
                const openLine = openFont * 1.28
                const lines = wrapLabel(
                  item.node.label,
                  26,
                  OPEN_LABEL_LINES
                )

                const textX =
                  item.side === 'left'
                    ? item.x - openFont * 0.5
                    : item.x + openFont * 0.5

                return (
                  <g key={`open-label-${item.node.id}`}>
                    <line
                      x1={item.node.x}
                      y1={item.node.y}
                      x2={item.x}
                      y2={item.y}
                      className="entry-open-label-link"
                    />

                    <text
                      x={textX}
                      y={item.y - ((lines.length - 1) * openLine) / 2}
                      textAnchor={item.side === 'left' ? 'end' : 'start'}
                      className="entry-open-node-label"
                      style={{ fontSize: `${openFont}px` }}
                    >
                      {lines.map((line, index) => (
                        <tspan
                          key={`${item.node.id}-${index}`}
                          x={textX}
                          dy={index === 0 ? 0 : openLine}
                        >
                          {line}
                        </tspan>
                      ))}
                    </text>
                  </g>
                )
              })}
            </g>
          )}

          {labelNode && (
            <g className="entry-node-label" pointerEvents="none">
              <text
                x={labelNode.x + 18}
                y={labelNode.y - 16}
                textAnchor="start"
              >
                {labelNode.label}
              </text>
            </g>
          )}
        </g>
      </svg>

      {mode === 'category' && (
        <div className="entry-family-legend" aria-label="Catégories d’expertise">
          {Object.entries(FAMILY_COLORS).map(([label, color]) => (
            <span key={label}>
              <i style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      )}

      <style>{`
        .gephi-entry-shell{
          position:relative;
          min-height:700px;
          overflow:hidden;
          border-radius:18px;
          background:
            radial-gradient(circle at 50% 40%,rgba(241,245,251,.92),rgba(255,255,255,0) 44%),
            linear-gradient(180deg,#ffffff 0%,#fbfcfe 100%);
        }

        .gephi-entry-svg{
          display:block;
          width:100%;
          height:clamp(690px,76vh,820px);
          touch-action:none;
          user-select:none;
          cursor:grab;
        }

        .gephi-entry-svg:active{
          cursor:grabbing;
        }

        .entry-edge{
          stroke:#a9b6c7;
          stroke-width:1.45;
          stroke-linecap:round;
          vector-effect:non-scaling-stroke;
        }

        .entry-edge.active{
          stroke:#f39a00;
          stroke-width:3;
        }

        .gephi-view-switch{
          position:absolute;
          z-index:6;
          left:14px;
          top:14px;
          display:flex;
          gap:5px;
          padding:4px;
          border:1px solid #dbe4f0;
          border-radius:10px;
          background:rgba(255,255,255,.95);
          box-shadow:0 4px 14px rgba(15,46,85,.07);
        }

        .gephi-view-switch button{
          border:0;
          border-radius:7px;
          padding:7px 10px;
          background:transparent;
          color:#536686;
          font:750 10px/1.2 inherit;
          cursor:pointer;
        }

        .gephi-view-switch button.active{
          background:#eef3fb;
          color:#123567;
        }

        .map-reading-inline{
          position:absolute;
          z-index:7;
          left:14px;
          top:62px;
          width:min(760px,calc(100% - 190px));
          max-height:min(58vh,560px);
          overflow:auto;
          padding:20px 22px 18px;
          border:1px solid #d9e3ef;
          border-radius:12px;
          background:rgba(255,255,255,.985);
          box-shadow:0 12px 30px rgba(18,46,83,.14);
          color:#425a78;
        }

        .map-reading-inline h2{
          margin:0 34px 14px 0;
          color:#0b2751;
          font-size:20px;
          line-height:1.2;
          letter-spacing:-.2px;
        }

        .map-reading-inline p{
          margin:0 0 12px;
          font-size:14px;
          line-height:1.62;
        }

        .map-reading-inline strong{
          color:#173b70;
          font-weight:800;
        }

        .map-reading-inline .map-reading-last{
          margin-bottom:0;
          color:#254e85;
          font-weight:700;
        }

        .map-reading-inline-close{
          position:absolute;
          top:10px;
          right:12px;
          width:30px;
          height:30px;
          border:0;
          border-radius:7px;
          background:transparent;
          color:#17345f;
          font:700 23px/1 inherit;
          cursor:pointer;
        }

        .map-reading-inline-close:hover{
          background:#eef3fb;
        }

        .gephi-zoom-tools{
          position:absolute;
          z-index:8;
          right:14px;
          top:14px;
          bottom:auto;
          display:flex;
          flex-direction:row;
          overflow:hidden;
          border:1.5px solid #8fb3ea;
          border-radius:11px;
          background:#fff;
          box-shadow:0 6px 18px rgba(15,46,85,.13);
        }

        .gephi-zoom-tools button{
          width:46px;
          height:42px;
          border:0;
          border-right:1px solid #dce6f3;
          background:#fff;
          color:#124f9d;
          font:850 20px/1 inherit;
          cursor:pointer;
        }

        .gephi-zoom-tools button:hover{
          background:#f2f7ff;
        }

        .gephi-zoom-tools button:last-child{
          border-right:0;
        }

        .gephi-back-cluster{
          position:absolute;
          z-index:6;
          left:14px;
          top:60px;
          border:1px solid #ccd9ea;
          border-radius:8px;
          padding:7px 10px;
          background:rgba(255,255,255,.96);
          color:#315b91;
          font:750 10px/1.2 inherit;
          cursor:pointer;
        }

        .entry-cluster-label{
          cursor:pointer;
          outline:none;
        }

        .entry-cluster-name{
          fill:#203653;
          font-size:22px;
          font-weight:860;
          letter-spacing:-.2px;
          paint-order:stroke;
          stroke:#ffffff;
          stroke-width:5px;
          stroke-linejoin:round;
          pointer-events:none;
        }

        .entry-cluster-transdirectional{
          fill:#6b7b91;
          font-size:13px;
          font-style:italic;
          font-weight:680;
          paint-order:stroke;
          stroke:#ffffff;
          stroke-width:4px;
          pointer-events:none;
        }

        .entry-cluster-label{
          cursor:pointer;
          outline:none;
        }

        /* La taille est désormais imposée en style inline, en pixels ecran. */
        .entry-cluster-title-svg{
          fill:#142f55;
          font-size:28px;
          font-weight:880;
          letter-spacing:-.15px;
          paint-order:stroke;
          stroke:#ffffff;
          stroke-width:5px;
          stroke-linejoin:round;
          pointer-events:none;
        }

        .entry-cluster-transdirectional-svg{
          fill:#61738c;
          font-size:12px;
          font-style:italic;
          font-weight:750;
          paint-order:stroke;
          stroke:#ffffff;
          stroke-width:4px;
          pointer-events:none;
        }

        .entry-open-label-link{
          stroke:#8295ad;
          stroke-width:1.1;
          opacity:.65;
          vector-effect:non-scaling-stroke;
        }

        .entry-open-label-bg{
          fill:rgba(255,255,255,.94);
          stroke:rgba(203,213,225,.9);
          stroke-width:1;
          vector-effect:non-scaling-stroke;
        }

        .entry-node-label text{
          fill:#0f2748;
          font-size:13px;
          font-weight:850;
          paint-order:stroke;
          stroke:#ffffff;
          stroke-width:5px;
          stroke-linejoin:round;
        }

        .entry-open-node-label{
          fill:#0b2447;
          font-weight:800;
          /* Halo blanc en lieu et place de l'ancien encadré : le texte reste
             lisible au-dessus des nœuds sans boîte opaque. non-scaling-stroke
             maintient l'épaisseur en pixels écran malgré le zoom. */
          paint-order:stroke;
          stroke:#ffffff;
          stroke-width:4px;
          stroke-linejoin:round;
          vector-effect:non-scaling-stroke;
        }

        .entry-family-legend{
          position:absolute;
          z-index:6;
          top:72px;
          right:68px;
          left:auto;
          bottom:auto;
          display:flex;
          flex-wrap:wrap;
          justify-content:flex-end;
          gap:10px 15px;
          max-width:min(62%, 760px);
          padding:10px 13px;
          border:1px solid #dbe4f0;
          border-radius:11px;
          background:rgba(255,255,255,.96);
          color:#46607f;
          font-size:11px;
          font-weight:740;
          box-shadow:0 4px 14px rgba(15,46,85,.07);
        }

        .entry-family-legend span{
          display:flex;
          align-items:center;
          gap:6px;
        }

        .entry-family-legend i{
          width:11px;
          height:11px;
          border-radius:50%;
        }


        .entry-cluster-card{
          width:100%;
          height:100%;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:4px;
          padding:7px 10px;
          border:0;
          border-radius:0;
          background:transparent;
          box-shadow:none;
          color:#203653;
          font-family:inherit;
          text-align:center;
          cursor:pointer;
        }

        .entry-cluster-card strong{
          font-size:28px;
          line-height:1.06;
          font-weight:860;
          letter-spacing:-.15px;
        }

        .entry-cluster-card span{
          color:#6b7b91;
          font-size:15px;
          line-height:1.12;
          font-style:italic;
          font-weight:680;
        }


        /* Bloc d'introduction latéral — proportions validées */
        .sidebar-intro-visual{
          display:block!important;
          width:118px!important;
          max-width:62%!important;
          height:auto!important;
          object-fit:contain!important;
          margin:2px auto 16px!important;
        }

        .sidebar-intro-title{
          display:block!important;
          max-width:210px!important;
          margin-left:auto!important;
          margin-right:auto!important;
          text-align:left!important;
        }

        /* ONGLET 1 — finalisation lisibilité */
        .expertise-screen .expertise-transition-banner{
          display:none!important;
        }

        .expertise-screen>.graph-workspace{
          padding-top:10px!important;
        }

        .expertise-screen aside,
        .expertise-screen .sidebar,
        .expertise-screen .left-sidebar,
        .expertise-screen .workspace-sidebar{
          padding-top:12px!important;
        }

        .expertise-screen aside h1,
        .expertise-screen aside h2,
        .expertise-screen aside h3{
          word-break:normal!important;
        }

        .expertise-screen aside{
          overflow-wrap:anywhere;
        }

        .expertise-screen aside .sidebar-section,
        .expertise-screen .workspace-sidebar .sidebar-section{
          margin-bottom:10px!important;
        }



                /* ONGLET 1 — entrée immersive : priorité visuelle au graphe */
        .expertise-screen>.graph-workspace{
          padding:14px 18px 10px!important;
        }

        .expertise-screen .expertise-transition-banner{
          grid-template-columns:minmax(0,1fr) 190px!important;
          gap:14px!important;
          margin:0 0 10px!important;
          padding:11px 16px!important;
          min-height:0!important;
          border-radius:12px!important;
        }

        .expertise-screen .expertise-transition-kicker{
          margin:0 0 4px!important;
          font-size:9px!important;
        }

        .expertise-screen .expertise-transition-copy h2{
          margin:0 0 4px!important;
          font-size:21px!important;
          line-height:1.08!important;
        }

        .expertise-screen .expertise-transition-copy p{
          max-width:900px!important;
          font-size:12.5px!important;
          line-height:1.35!important;
        }

        .expertise-screen .expertise-transition-art{
          height:72px!important;
        }

        .expertise-screen .expertise-transition-art img{
          max-width:240px!important;
        }

        .expertise-screen .workspace-toolbar{
          margin-bottom:2px!important;
        }

        .expertise-screen .workspace-toolbar h1{
          font-size:26px!important;
          margin-bottom:4px!important;
        }

        .expertise-screen .workspace-subtitle{
          margin-bottom:5px!important;
        }

        @media(max-width:1180px){
          .expertise-screen .expertise-transition-banner{
            grid-template-columns:minmax(0,1fr) 150px!important;
          }
          .expertise-screen .expertise-transition-art{
            height:62px!important;
            justify-content:flex-end!important;
          }
        }

        @media(max-width:1380px){

          .gephi-entry-svg{
            height:700px;
          }

          .entry-cluster-card strong{
            font-size:22px;
          }
        }

        @media(max-width:820px){
          .gephi-entry-svg{
            height:570px;
          }

          .entry-family-legend{
            top:auto;
            right:14px;
            left:14px;
            bottom:14px;
            max-width:none;
            justify-content:flex-start;
          }

          .gephi-view-switch{
            max-width:calc(100% - 28px);
          }

          .gephi-view-switch button{
            padding:6px 8px;
            font-size:9px;
          }

          .entry-cluster-card strong{
            font-size:18px;
          }

          .entry-cluster-card span{
            font-size:10px;
          }
        }
      `}</style>
    </section>
  )
}
