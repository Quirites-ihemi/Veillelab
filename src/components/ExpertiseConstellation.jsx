import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  expertiseGephiLayout,
  expertiseClusters,
} from './expertiseGephiLayout.js'
import { atlasClusterColor, ATLAS_ISOLATED_COLOR } from './atlasPalette.js'

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


// ---------------------------------------------------------------------------
// ATLAS — mesure du texte et découpage SANS TRONCATURE.
// Les intitulés sont mesurés avec la police réellement utilisée (canvas),
// puis découpés en lignes. Aucun mot n'est jamais supprimé.
// ---------------------------------------------------------------------------

const ATLAS_FONT_STACK = 'Manrope, "Segoe UI", Roboto, system-ui, -apple-system, sans-serif'
const ATLAS_SERIF_STACK = '"Source Serif 4", Georgia, "Times New Roman", serif'

let measureContext = null

function measureText(text, font) {
  if (typeof document === 'undefined') return String(text).length * 9
  if (!measureContext) {
    measureContext = document.createElement('canvas').getContext('2d')
  }
  measureContext.font = font
  return measureContext.measureText(String(text)).width
}

function wrapByWidth(label, maxWidth, font) {
  const words = String(label || '').split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''

  words.forEach(word => {
    const next = current ? `${current} ${word}` : word
    if (current && measureText(next, font) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  })

  if (current) lines.push(current)
  return lines
}

// Conservé pour compatibilité : découpage par nombre de caractères, sans
// suppression de lignes (l'ancienne version tronquait silencieusement).
function wrapLabel(label, maxChars = 32) {
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
  return lines
}

function familyColor(family) {
  return FAMILY_COLORS[family] || '#64748b'
}

// Taille du cœur lumineux d'un nœud, en pixels écran, déduite de la taille
// Gephi (6 → 30). Les nœuds sont volontairement perceptibles d'emblée.
function corePx(gephiSize) {
  return 5 + Number(gephiSize || 6) * 0.4
}

// Géométrie des intitulés de clusters, en pixels écran. Sur un écran
// portable, le gabarit compact (15 px) reste confortablement lisible.
const TITLE_METRICS = {
  regular: { font: 15.5, line: 19, maxWidth: 236, narrow: 180, trans: 13 },
  compact: { font: 14.5, line: 18, maxWidth: 212, narrow: 168, trans: 12.5 },
}
const titleFont = m => `600 ${m.font}px ${ATLAS_SERIF_STACK}`
const transFont = m => `italic 400 ${m.trans}px ${ATLAS_SERIF_STACK}`
// Distance maximale entre un intitulé et sa constellation, et tolérance
// de proximité avec une autre constellation (pixels écran).
const TITLE_MAX_DISTANCE_PX = 150
const TITLE_AMBIGUITY_PX = 60
const TITLE_GAP_PX = 12       // écart minimal entre deux intitulés
const NODE_CLEARANCE_PX = 7   // écart minimal entre un intitulé et un nœud
// Bande libre réservée en bas du graphe quand une communauté est ouverte :
// c'est l'emplacement de L'Éclaireur (bandeau ou pastille) dans cette vue.
const OPEN_GUIDE_DOCK_PX = 100
const GLOBAL_GUIDE_DOCK_PX = 96

function titleBoxPx(cluster, m, maxWidth = m.maxWidth) {
  const lines = wrapByWidth(cluster.label, maxWidth, titleFont(m))
  const width = Math.max(
    ...lines.map(line => measureText(line, titleFont(m))),
    cluster.transdirectional ? measureText('Cluster transdirectionnel', transFont(m)) : 0
  )
  const height =
    lines.length * m.line +
    10 +
    (cluster.transdirectional ? m.trans + 7 : 0)

  // +6 px de marge : la police finale peut différer légèrement de la mesure.
  return { lines, w: Math.ceil(width) + 6, h: height, m }
}

function boxesOverlap(a, b, margin = 0) {
  return !(
    a.x1 + margin <= b.x0 ||
    b.x1 + margin <= a.x0 ||
    a.y1 + margin <= b.y0 ||
    b.y1 + margin <= a.y0
  )
}

function boxHitsCircle(box, cx, cy, r) {
  const nx = clamp(cx, box.x0, box.x1)
  const ny = clamp(cy, box.y0, box.y1)
  return Math.hypot(cx - nx, cy - ny) < r
}

const ALIGNMENTS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]

function angleGap(a, b) {
  const d = Math.abs(a - b) % (Math.PI * 2)
  return d > Math.PI ? Math.PI * 2 - d : d
}

// Positions candidates d'un intitulé, à l'EXTÉRIEUR de sa constellation :
// à distance croissante du cluster, dans toutes les directions, le rectangle
// touchant le point de départ par un bord ou un coin. Sont écartées d'emblée
// les positions qui touchent un nœud ou sortent du cadre. Au-delà de
// `maxExtra` pixels, l'intitulé serait trop loin de sa constellation pour
// être lu comme le sien : on ne le propose pas.
function titleCandidates({ cluster, box, unit, nodes, bounds, maxExtra }) {
  const halfW = (box.w / 2) * unit
  const halfH = (box.h / 2) * unit
  const own = nodes.filter(n => n.clusterId === cluster.id)
  // Les micro-expertises isolées n'ont pas d'intitulé : elles ne peuvent pas
  // créer d'ambiguïté et ne sont prises en compte que comme obstacles.
  const others = nodes.filter(n => n.clusterId !== cluster.id && !n.isolated)
  const step = 8 * unit
  const out = []

  const distToRect = (rect, n) =>
    Math.hypot(n.x - clamp(n.x, rect.x0, rect.x1), n.y - clamp(n.y, rect.y0, rect.y1))

  // Fenêtre de recherche : emprise du cluster élargie de la taille de
  // l'intitulé et de la distance maximale autorisée.
  const reach = maxExtra * unit
  const x0 = Math.max(bounds.x0 + halfW, cluster.minX - reach - halfW)
  const x1 = Math.min(bounds.x1 - halfW, cluster.maxX + reach + halfW)
  const y0 = Math.max(bounds.y0 + halfH, cluster.minY - reach - halfH)
  const y1 = Math.min(bounds.y1 - halfH, cluster.maxY + reach + halfH)

  for (let cx = x0; cx <= x1; cx += step) {
    for (let cy = y0; cy <= y1; cy += step) {
      const rect = { x0: cx - halfW, x1: cx + halfW, y0: cy - halfH, y1: cy + halfH }

      if (nodes.some(n => boxHitsCircle(rect, n.x, n.y, (corePx(n.gephiSize) + NODE_CLEARANCE_PX) * unit))) continue

      const dOwn = Math.min(...own.map(n => distToRect(rect, n))) / unit
      if (dOwn > maxExtra) continue

      // L'intitulé doit se lire comme celui de SA constellation : il est
      // plus proche d'elle que de toute autre.
      const dOther = others.length
        ? Math.min(...others.map(n => distToRect(rect, n))) / unit
        : Infinity
      if (dOther < dOwn - TITLE_AMBIGUITY_PX) continue

      out.push({ cx, cy, rect, box, extra: dOwn, cost: dOwn })
    }
  }

  return out.sort((x, y) => x.cost - y.cost)
}

// Générateur pseudo-aléatoire déterministe : la carte est identique à
// chaque ouverture.
function seededRandom(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

// Choix global : on essaie plusieurs ordres de placement et on retient la
// configuration qui affiche le plus d'intitulés (pondérés par la taille du
// cluster) avec les traits de rappel les plus courts. Aucun recouvrement
// n'est jamais accepté.
function solveTitles(clusters, candidates, unit, fixed = []) {
  const gap = TITLE_GAP_PX * unit
  const run = order => {
    const placed = [...fixed]
    const chosen = new Map()
    let score = 0
    order.forEach(cluster => {
      const list = candidates.get(cluster.id) || []
      const spot = list.find(c => !placed.some(r => boxesOverlap(c.rect, r, gap)))
      if (spot) {
        placed.push(spot.rect)
        chosen.set(cluster.id, spot)
        score += cluster.nodeCount * 1000 - spot.cost
      }
    })
    return { chosen, score }
  }

  let best = run(clusters)
  const rand = seededRandom(1789)
  for (let i = 0; i < 160; i += 1) {
    const order = [...clusters]
    for (let j = order.length - 1; j > 0; j -= 1) {
      const k = Math.floor(rand() * (j + 1))
      ;[order[j], order[k]] = [order[k], order[j]]
    }
    const result = run(order)
    if (result.score > best.score) best = result
  }
  return best.chosen
}

// Point du rectangle le plus proche d'un point donné (pour le trait de rappel).
function nearestOnRect(rect, x, y) {
  return { x: clamp(x, rect.x0, rect.x1), y: clamp(y, rect.y0, rect.y1) }
}

export default function ExpertiseConstellation({
  nodes,
  edges,
  selected,
  onSelect,
  onClusterChange,
  onHoverCluster,
  highlightClusterId = null,
  focusClusterRequest = null,
  guideOverviewStep = null,
  guidePulseNode = false,
  nodeSize = 1,
  linkDensity = 1,
  resetToken = 0,
  fitToken = 0,
}) {
  const svgRef = useRef(null)
  const dragRef = useRef(null)
  const groupRef = useRef(null)
  const lastDragMovedRef = useRef(0)

  const [mode, setMode] = useState('cluster')
  const [activeCluster, setActiveCluster] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  const [hoveredTitleId, setHoveredTitleId] = useState(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [fontsReady, setFontsReady] = useState(0)
  // Cadrage calculé à l'ouverture d'une communauté : sert à maintenir les
  // colonnes d'étiquettes dans la partie visible du graphe.
  const [openFrame, setOpenFrame] = useState(null)

  // Dimensions réelles du cadre, en pixels.
  const [viewport, setViewport] = useState({ w: 1120, h: 740 })

  useEffect(() => {
    const el = svgRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined

    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setViewport(current =>
          Math.abs(current.w - rect.width) < 1 && Math.abs(current.h - rect.height) < 1
            ? current
            : { w: rect.width, h: rect.height }
        )
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Les intitulés sont mesurés avec la police réelle : on recalcule une fois
  // les polices web chargées.
  useEffect(() => {
    let alive = true
    const fonts = document.fonts
    if (fonts?.load) {
      Promise.all([
        fonts.load(`600 15px ${ATLAS_SERIF_STACK}`),
        fonts.load(`italic 400 13px ${ATLAS_SERIF_STACK}`),
        fonts.load(`600 14px ${ATLAS_FONT_STACK}`),
      ]).then(() => alive && setFontsReady(x => x + 1)).catch(() => {})
    }
    fonts?.ready?.then(() => alive && setFontsReady(x => x + 1))
    return () => { alive = false }
  }, [])

  const overviewNodes = useMemo(
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
            isolated: Boolean(layout.isolated),
            color: layout.isolated
              ? ATLAS_ISOLATED_COLOR
              : atlasClusterColor(layout.cluster),
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

  // Seuil d'affichage permanent des titres de clusters. En deçà, le titre
  // n'apparaît qu'au survol, depuis le panneau, ou quand le cluster est ouvert.
  const TITLE_MIN_NODES = 6

  // Géométrie des étiquettes de nœuds en vue cluster ouvert (pixels écran).
  const OPEN_LABEL_WIDTH = 240
  const OPEN_LABEL_OFFSET = 34
  const OPEN_LABEL_FONT_MAX = 15
  const OPEN_LABEL_FONT_MIN = 13

  // -------------------------------------------------------------------------
  // MODÈLE DE MISE EN PAGE
  // 1. cadre de référence sur les nœuds seuls ;
  // 2. placement des grands intitulés à l'extérieur, sans collision ;
  // 3. cadre final englobant nœuds + intitulés, puis on recommence avec
  //    l'échelle finale (3 passes) pour que les tailles soient exactes ;
  // 4. intitulés des petits clusters, posés DANS le cadre final, sans
  //    collision avec les précédents (affichés au survol uniquement).
  // -------------------------------------------------------------------------
  const model = useMemo(() => {
    // Écran bas (portable) : une bande libre est aussi réservée en bas de la
    // vue globale, pour que L'Éclaireur ait toujours où se poser.
    const dockPx = viewport.h < 700 ? GLOBAL_GUIDE_DOCK_PX : 0
    const effH = Math.max(1, viewport.h - dockPx)
    const frameRatio = viewport.w / effH
    const metrics = viewport.w < 860 || viewport.h < 660 ? TITLE_METRICS.compact : TITLE_METRICS.regular

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

    const center = {
      x: positionedNodes.reduce((a, n) => a + n.x, 0) / positionedNodes.length,
      y: positionedNodes.reduce((a, n) => a + n.y, 0) / positionedNodes.length,
    }

    const grouped = new Map()
    positionedNodes.forEach(node => {
      if (!grouped.has(node.clusterId)) grouped.set(node.clusterId, [])
      grouped.get(node.clusterId).push(node)
    })

    const baseClusters = expertiseClusters
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

        return {
          ...cluster,
          color: atlasClusterColor(cluster.id),
          showLabel: clusterNodes.length >= TITLE_MIN_NODES,
          nodeIds: new Set(clusterNodes.map(n => n.id)),
          nodeCount: clusterNodes.length,
          minX,
          maxX,
          minY,
          maxY,
          centerX,
          centerY,
          spread,
          box: titleBoxPx(cluster, metrics),
          boxes: [titleBoxPx(cluster, metrics), titleBoxPx(cluster, metrics, metrics.narrow)],
        }
      })

    const major = baseClusters
      .filter(c => c.showLabel)
      .sort((a, b) => b.nodeCount - a.nodeCount)
    const minor = baseClusters
      .filter(c => !c.showLabel)
      .sort((a, b) => b.nodeCount - a.nodeCount)

    // Le cadre est calé sur les NŒUDS (le graphe reste le protagoniste) ;
    // les intitulés sont ensuite posés dans l'espace libre de ce cadre.
    const viewTop = frame(nodeBox, 1.24, 1.24)
    const unit = viewTop.h / effH
    const view = { ...viewTop, h: viewTop.h + dockPx * unit }
    const bounds = {
      x0: viewTop.x + 8 * unit,
      x1: viewTop.x + viewTop.w - 8 * unit,
      y0: viewTop.y + 8 * unit,
      y1: viewTop.y + viewTop.h - 8 * unit,
    }

    const candidatesFor = (list, maxExtra) => {
      const map = new Map()
      list.forEach(cluster => {
        const all = cluster.boxes.flatMap((box, variant) =>
          titleCandidates({
            cluster,
            box,
            unit,
            nodes: positionedNodes,
            bounds,
            maxExtra,
          }).map(c => ({ ...c, cost: c.cost + variant * 6 }))
        )
        map.set(cluster.id, all.sort((x, y) => x.cost - y.cost))
      })
      return map
    }

    // Grands clusters : intitulés permanents, proches de leur constellation.
    const majorSpots = solveTitles(major, candidatesFor(major, TITLE_MAX_DISTANCE_PX), unit)
    // Petits clusters : intitulés révélés au survol, sans recouvrir les autres.
    const minorSpots = solveTitles(
      minor,
      candidatesFor(minor, TITLE_MAX_DISTANCE_PX),
      unit,
      [...majorSpots.values()].map(spot => spot.rect)
    )

    const placements = new Map()
    ;[...majorSpots, ...minorSpots].forEach(([id, spot]) => {
      placements.set(id, { ...spot, unit })
    })

    const clusters = baseClusters.map(cluster => {
      const spot = placements.get(cluster.id) || null
      return {
        ...cluster,
        placement: spot,
        // Un grand cluster dont l'intitulé n'a pas trouvé de place libre
        // n'est pas affiché en permanence (règle : aucun chevauchement).
        showLabel: cluster.showLabel && Boolean(spot),
        radius: Math.max(70, cluster.spread + 46),
      }
    })

    return { view, clusters, unit }
  }, [positionedNodes, viewport, fontsReady])

  const view = model.view
  const unit = model.unit
  const clusterStats = model.clusters

  const primaryGuideClusterId = useMemo(() => {
    if (!clusterStats.length) return null

    // Cluster « Articulation entre recherche scientifique et pratiques
    // de sécurité intérieure » : repère stable pendant la visite guidée.
    const greenReferenceCluster = clusterStats.find(cluster => cluster.id === 43)
    if (greenReferenceCluster) return greenReferenceCluster.id

    const candidates = [...clusterStats].sort((a, b) => {
      const bySize = b.nodeIds.size - a.nodeIds.size
      if (bySize !== 0) return bySize
      return String(a.label || '').localeCompare(String(b.label || ''), 'fr')
    })

    return candidates[0]?.id ?? null
  }, [clusterStats])

  const guideClusterId =
    activeCluster === null && (guideOverviewStep === 2 || guideOverviewStep === 6)
      ? primaryGuideClusterId
      : null

  const guideTitleClusterId =
    activeCluster === null && guideOverviewStep === 3
      ? primaryGuideClusterId
      : null

  const guideTransClusterId = useMemo(() => {
    if (activeCluster !== null || guideOverviewStep !== 4) return null

    const reference = clusterStats.find(
      cluster => cluster.id === primaryGuideClusterId && cluster.transdirectional
    )
    if (reference) return reference.id

    const candidates = clusterStats
      .filter(cluster => cluster.transdirectional)
      .sort((a, b) => b.nodeIds.size - a.nodeIds.size)

    return candidates[0]?.id ?? null
  }, [activeCluster, guideOverviewStep, clusterStats, primaryGuideClusterId])

  const guideOverviewNodeIds = useMemo(() => {
    if (activeCluster !== null || guideOverviewStep !== 0) return new Set()

    const candidates = positionedNodes
      .filter(node => node.clusterId === primaryGuideClusterId)
      .sort((a, b) => b.gephiSize - a.gephiSize)

    return new Set(candidates.slice(0, 3).map(node => node.id))
  }, [activeCluster, guideOverviewStep, positionedNodes, primaryGuideClusterId])

  const guideIsolatedNodeId = useMemo(() => {
    if (activeCluster !== null || guideOverviewStep !== 5) return null

    const candidates = positionedNodes
      .filter(node => node.isolated)
      .sort((a, b) => b.gephiSize - a.gephiSize)

    return candidates[0]?.id ?? null
  }, [activeCluster, guideOverviewStep, positionedNodes])

  const guideLinkKeys = useMemo(() => {
    if (activeCluster !== null || guideOverviewStep !== 1) return new Set()

    const candidates = visibleEdges
      .map(edge => {
        const source = byId.get(edge.source)
        const target = byId.get(edge.target)
        if (!source || !target) return null

        const sourceInReference = source.clusterId === primaryGuideClusterId
        const targetInReference = target.clusterId === primaryGuideClusterId
        const bothInReference = sourceInReference && targetInReference
        const touchesReference = sourceInReference || targetInReference

        if (!touchesReference) return null

        return {
          key: `${edge.source}|${edge.target}`,
          priority: bothInReference ? 0 : 1,
          score: source.gephiSize + target.gephiSize,
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority
        return b.score - a.score
      })

    return new Set(candidates.slice(0, 12).map(item => item.key))
  }, [activeCluster, guideOverviewStep, visibleEdges, byId, primaryGuideClusterId])

  const guideNodeId = useMemo(() => {
    if (!guidePulseNode || activeCluster === null) return null

    const candidates = positionedNodes
      .filter(node => node.clusterId === activeCluster)
      .sort((a, b) => b.gephiSize - a.gephiSize)

    return candidates[0]?.id ?? null
  }, [guidePulseNode, activeCluster, positionedNodes])

  const viewCenter = useMemo(
    () => ({
      x: view.x + view.w / 2,
      y: view.y + view.h / 2,
    }),
    [view]
  )

  // Cluster survolé : déduit du nœud sous le curseur, d'un intitulé survolé,
  // ou du panneau « Communautés d'expertise ».
  const hoveredNodeClusterId = useMemo(() => {
    if (!hoveredId) return null
    const node = byId.get(hoveredId)
    return node && !node.isolated ? node.clusterId : null
  }, [hoveredId, byId])

  const emphasisClusterId =
    activeCluster === null
      ? (highlightClusterId ?? hoveredTitleId ?? hoveredNodeClusterId ?? null)
      : null

  useEffect(() => {
    onHoverCluster?.(hoveredTitleId ?? hoveredNodeClusterId ?? null)
  }, [hoveredTitleId, hoveredNodeClusterId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setHoveredTitleId(null)
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
    onClusterChange?.(null)
    setScale(1)
    setPan({ x: 0, y: 0 })
  }

  const openCluster = cluster => {
    if (!cluster) return

    // A cluster focus must not inherit a previous node selection.
    onSelect?.(null)
    setActiveCluster(cluster.id)
    setHoveredTitleId(null)
    onClusterChange?.({
      id: cluster.id,
      label: cluster.label,
      transdirectional: Boolean(cluster.transdirectional),
    })

    frameCluster(cluster)
  }

  // Cadrage d'une communauté ouverte. Rappelé quand le cadre change de taille
  // (ouverture de la fiche, repli d'un panneau) pour rester centré.
  const frameCluster = cluster => {
    const clusterNodes = positionedNodes.filter(
      node => node.clusterId === cluster.id
    )

    if (!clusterNodes.length) return

    const xs = clusterNodes.map(node => node.x)
    const ys = clusterNodes.map(node => node.y)
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2

    const spanX = Math.max(...xs) - Math.min(...xs)
    const spanY = Math.max(...ys) - Math.min(...ys)

    // Place réservée : étiquettes de part et d'autre, intitulé au-dessus.
    const titleReserve = cluster.box.h + 26
    const freeW =
      viewport.w * 0.94 - 2 * (OPEN_LABEL_OFFSET + OPEN_LABEL_WIDTH)
    const freeH = viewport.h * 0.9 - OPEN_GUIDE_DOCK_PX - titleReserve - 2 * OPEN_LABEL_FONT_MAX * 2

    const byWidth = (Math.max(80, freeW) * unit) / Math.max(1, spanX)
    const byHeight = (Math.max(80, freeH) * unit) / Math.max(1, spanY)

    const nextScale = clamp(Math.min(byWidth, byHeight), 1, MAX_SCALE)

    // On centre l'ensemble « intitulé + constellation ».
    const topWorld = Math.min(...ys) - (titleReserve * unit) / nextScale
    const centerY = (topWorld + Math.max(...ys)) / 2

    const nextPan = {
      x: nextScale * (viewCenter.x - centerX),
      // Remonté d'une demi-bande : la bande basse reste libre.
      y: nextScale * (viewCenter.y - centerY) - (OPEN_GUIDE_DOCK_PX / 2) * unit,
    }
    setScale(nextScale)
    setPan(nextPan)
    setOpenFrame({ scale: nextScale, pan: nextPan })
  }

  useEffect(() => {
    if (activeCluster === null) return
    const cluster = clusterStats.find(item => item.id === activeCluster)
    if (cluster) frameCluster(cluster)
  }, [viewport.w, viewport.h]) // eslint-disable-line react-hooks/exhaustive-deps

  const focusCluster = cluster => {
    if (!cluster) return

    if (activeCluster === cluster.id) {
      closeCluster()
      return
    }

    openCluster(cluster)
  }

  // Ouverture demandée depuis le panneau « Communautés d'expertise ».
  useEffect(() => {
    if (!focusClusterRequest) return
    if (focusClusterRequest.id === null) {
      if (activeCluster !== null) closeCluster()
      return
    }
    const cluster = clusterStats.find(item => item.id === focusClusterRequest.id)
    if (cluster && activeCluster !== cluster.id) openCluster(cluster)
  }, [focusClusterRequest?.token]) // eslint-disable-line react-hooks/exhaustive-deps

  // Étiquettes des nœuds en vue cluster ouvert, en colonnes de part et d'autre.
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
    const available = viewport.h - 70 - OPEN_GUIDE_DOCK_PX
    const fontFor = lines =>
      clamp(
        available / perSide / (lines * 1.25 + 0.55),
        OPEN_LABEL_FONT_MIN,
        OPEN_LABEL_FONT_MAX
      )

    // Lignes réelles à la police retenue : on part de la plus grande police
    // possible et on descend tant que le nombre de lignes l'exige.
    let font = OPEN_LABEL_FONT_MAX
    let maxLines = 1
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const f = `600 ${font}px ${ATLAS_FONT_STACK}`
      maxLines = Math.max(
        ...clusterNodes.map(n => wrapByWidth(n.label, OPEN_LABEL_WIDTH, f).length)
      )
      const next = fontFor(maxLines)
      if (Math.abs(next - font) < 0.25) break
      font = next
    }

    const fontString = `600 ${font}px ${ATLAS_FONT_STACK}`
    const rowPx = font * (maxLines * 1.25 + 0.55)

    const toWorld = px => (px * unit) / scale
    const gap = toWorld(rowPx)

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

      let shift = avgOriginal - avgPlaced

      // Colonne maintenue dans la zone visible (sous les boutons du haut).
      if (openFrame) {
        const k = openFrame.scale
        const visTop = viewCenter.y - openFrame.pan.y / k - view.h / (2 * k)
        const visBottom = viewCenter.y - openFrame.pan.y / k + view.h / (2 * k)
        const half = gap / 2
        const top = visTop + (60 * unit) / k
        const bottom = visBottom - ((10 + OPEN_GUIDE_DOCK_PX) * unit) / k
        const last = placed[placed.length - 1].y + shift + half
        if (last > bottom) shift -= last - bottom
        if (placed[0].y + shift - half < top) shift += top - (placed[0].y + shift - half)
      }

      const x =
        side === 'left'
          ? cluster.minX - toWorld(OPEN_LABEL_OFFSET)
          : cluster.maxX + toWorld(OPEN_LABEL_OFFSET)

      return placed.map(item => ({
        node: item.node,
        x,
        y: item.y + shift,
        side,
        lines: wrapByWidth(item.node.label, OPEN_LABEL_WIDTH, fontString),
      }))
    }

    return {
      items: [...distribute(left, 'left'), ...distribute(right, 'right')],
      font,
      rowHeight: rowPx,
    }
  }, [activeCluster, clusterStats, positionedNodes, unit, scale, viewport, openFrame, view, viewCenter])

  const onPointerDown = event => {
    if (event.button !== 0) return

    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return

    dragRef.current = {
      pointerId: event.pointerId,
      moved: 0,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
      rectWidth: rect.width,
      rectHeight: rect.height,
    }

    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  // -------------------------------------------------------------------------
  // SÉLECTION AU POINTEUR : le nœud retenu est TOUJOURS celui dont le centre
  // est le plus proche du pointeur (dans la limite de son rayon + 9 px).
  // Les anciennes zones cliquables, plus larges que les nœuds, se
  // chevauchaient : le dernier nœud dessiné « volait » le clic de son voisin.
  // -------------------------------------------------------------------------
  const nodeAtPointer = event => {
    const svg = svgRef.current
    const group = groupRef.current
    const ctm = group?.getScreenCTM?.()
    if (!svg || !ctm) return null

    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const world = point.matrixTransform(ctm.inverse())
    const pxPerWorld = Math.hypot(ctm.a, ctm.b) || 1

    let best = null
    let bestDistance = Infinity
    positionedNodes.forEach(node => {
      if (nodeOpacity(node) < 0.1) return
      const distance = Math.hypot(node.x - world.x, node.y - world.y) * pxPerWorld
      const reach = radiusFor(node) * pxPerWorld + 9
      if (distance <= reach && distance < bestDistance) {
        best = node
        bestDistance = distance
      }
    })
    return best
  }

  const onPointerMove = event => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      if (event.target.closest?.('.atlas-title')) return
      const node = nodeAtPointer(event)
      const id = node ? node.id : null
      if (id !== hoveredId) setHoveredId(id)
      return
    }

    drag.moved = Math.max(
      drag.moved,
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
    )

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
    lastDragMovedRef.current = drag.moved
    dragRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const onSvgClick = event => {
    if (event.target.closest?.('.atlas-title')) return
    // Un glisser-déplacer n'est pas un clic.
    if (lastDragMovedRef.current > 5) return
    const node = nodeAtPointer(event)
    if (node) onSelect?.(node)
  }

  const zoomTransform = [
    `translate(${viewCenter.x + pan.x} ${viewCenter.y + pan.y})`,
    `scale(${scale})`,
    `translate(${-viewCenter.x} ${-viewCenter.y})`,
  ].join(' ')

  const hoveredNode = hoveredId ? byId.get(hoveredId) : null
  const labelNode = selected && byId.get(selected.id)
    ? byId.get(selected.id)
    : hoveredNode

  // Échelle inverse appliquée aux intitulés : au zoom avant, ils gardent leur
  // taille à l'écran (et ne peuvent donc pas se chevaucher davantage).
  const titleScale = 1 / Math.max(1, scale)

  // Taille des cœurs : constante à l'écran en cluster ouvert.
  const radiusFor = node => {
    const px = corePx(node.gephiSize) * nodeSize
    return activeCluster !== null
      ? (px * 1.25 * unit) / scale
      : px * unit
  }

  const activeClusterStat =
    activeCluster !== null
      ? clusterStats.find(cluster => cluster.id === activeCluster)
      : null

  // Carte d'information (coin inférieur gauche) : nom complet du cluster
  // survolé, y compris pour les petits clusters sans intitulé permanent.
  const infoCluster =
    activeCluster === null && emphasisClusterId !== null
      ? clusterStats.find(cluster => cluster.id === emphasisClusterId)
      : null

  const nodeOpacity = node => {
    // Communauté ouverte : les nœuds extérieurs restent en retrait, même
    // voisins de l'expertise sélectionnée (ils passeraient sous les étiquettes).
    if (activeCluster !== null && node.clusterId !== activeCluster) {
      return selectedId && neighbourIds.has(node.id) ? 0.3 : 0.07
    }
    if (selectedId) return neighbourIds.has(node.id) ? 1 : 0.16
    if (activeCluster !== null) return 1
    if (emphasisClusterId !== null) return node.clusterId === emphasisClusterId ? 1 : 0.2
    return 1
  }

  const renderTitle = (cluster, opts) => {
    const { cx, cy, k, open } = opts
    const box = opts.box || cluster.box
    const u = open ? unit / scale : unit
    const w = box.w * u
    const h = box.h * u
    const x0 = cx - w / 2
    const y0 = cy - h / 2
    const m = box.m
    const font = m.font * u
    const line = m.line * u
    const underlineY = y0 + box.lines.length * line + 5 * u
    const isGuide =
      guideClusterId === cluster.id || guideTitleClusterId === cluster.id

    return (
      <g
        key={`label-${cluster.id}`}
        className={`entry-cluster-label atlas-title ${isGuide ? 'eclaireur-cluster-label-pulse' : ''} ${open ? 'is-open' : ''}`}
        transform={k === 1 ? undefined : `translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`}
        role="button"
        tabIndex="0"
        aria-label={
          cluster.transdirectional
            ? `${cluster.label}, Cluster transdirectionnel`
            : cluster.label
        }
        onPointerDown={event => event.stopPropagation()}
        onMouseEnter={() => setHoveredTitleId(cluster.id)}
        onMouseLeave={() => setHoveredTitleId(null)}
        onClick={() => focusCluster(cluster)}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            focusCluster(cluster)
          }
        }}
        data-cluster-id={cluster.id}
      >
        <rect
          className="atlas-title-hit"
          x={x0 - 6 * u}
          y={y0 - 4 * u}
          width={w + 12 * u}
          height={h + 8 * u}
          rx={8 * u}
        />

        <text
          x={cx}
          y={y0 + (m.font - 0.5) * u}
          textAnchor="middle"
          className="entry-cluster-title-svg atlas-title-text"
          style={{ fontSize: `${font}px` }}
        >
          {box.lines.map((text, index) => (
            <tspan key={`${cluster.id}-${index}`} x={cx} dy={index === 0 ? 0 : line}>
              {text}
            </tspan>
          ))}
        </text>

        <rect
          className="atlas-title-underline"
          x={cx - Math.min(w / 2, 80 * u)}
          y={underlineY - 1.25 * u}
          width={Math.min(w, 160 * u)}
          height={2.5 * u}
          rx={1.25 * u}
          fill={`url(#atlas-underline-${cluster.id})`}
        />

        {cluster.transdirectional && (
          <text
            x={cx}
            y={underlineY + (m.trans + 4) * u}
            textAnchor="middle"
            className={`entry-cluster-transdirectional-svg atlas-title-trans ${
              guideTransClusterId === cluster.id ? 'eclaireur-transdirectional-pulse' : ''
            }`}
            style={{ fontSize: `${m.trans * u}px` }}
          >
            Cluster transdirectionnel
          </text>
        )}
      </g>
    )
  }

  return (
    <section className="constellation-shell atlas-constellation">
      <div className="atlas-zoom-tools" aria-label="Zoom du graphe">
        <button type="button" onClick={() => zoom(1.18)} aria-label="Zoom avant" title="Zoom avant">+</button>
        <button type="button" onClick={() => zoom(0.86)} aria-label="Zoom arrière" title="Zoom arrière">−</button>
        <button type="button" onClick={resetView} aria-label="Recentrer" title="Recentrer">⌾</button>
      </div>

      {activeCluster !== null && mode === 'cluster' && (
        <button
          type="button"
          className="atlas-back-cluster"
          onClick={closeCluster}
        >
          <span aria-hidden="true">←</span> Retour au graphe complet
        </button>
      )}

      {infoCluster && (
        <div className="atlas-hover-card" aria-live="polite">
          <i style={{ background: infoCluster.color, boxShadow: `0 0 10px ${infoCluster.color}` }} />
          <div>
            <strong>{infoCluster.label}</strong>
            {infoCluster.transdirectional && <em>Cluster transdirectionnel</em>}
            <small>{infoCluster.nodeCount} micro-expertise{infoCluster.nodeCount > 1 ? 's' : ''} · cliquer pour explorer</small>
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        className="atlas-svg"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Atlas des expertises ministérielles"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => !dragRef.current && setHoveredId(null)}
        onClick={onSvgClick}
        style={hoveredId ? { cursor: 'pointer' } : undefined}
        onWheel={event => {
          if (event.deltaY < 0) zoom(1.08)
          if (event.deltaY > 0) zoom(0.92)
        }}
      >
        <defs>

          {[...clusterStats.map(c => [c.id, c.color]), ['iso', ATLAS_ISOLATED_COLOR]].map(([id, color]) => (
            <React.Fragment key={`grad-${id}`}>
              <radialGradient id={`atlas-core-${id}`} cx="42%" cy="40%" r="62%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="28%" stopColor="#ffffff" stopOpacity="0.92" />
                <stop offset="52%" stopColor={color} />
                <stop offset="100%" stopColor={color} />
              </radialGradient>
              <radialGradient id={`atlas-halo-${id}`}>
                <stop offset="0%" stopColor={color} stopOpacity="0.62" />
                <stop offset="34%" stopColor={color} stopOpacity="0.2" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </radialGradient>
              <radialGradient id={`atlas-nebula-${id}`}>
                <stop offset="0%" stopColor={color} stopOpacity="1" />
                <stop offset="45%" stopColor={color} stopOpacity="0.45" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`atlas-underline-${id}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                <stop offset="50%" stopColor={color} stopOpacity="1" />
                <stop offset="100%" stopColor={color} stopOpacity="0.15" />
              </linearGradient>
            </React.Fragment>
          ))}

          {visibleEdges.map((edge, index) => {
            const source = byId.get(edge.source)
            const target = byId.get(edge.target)
            if (!source || !target) return null
            return (
              <linearGradient
                key={`eg-${index}`}
                id={`atlas-edge-${index}`}
                gradientUnits="userSpaceOnUse"
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
              >
                <stop offset="0%" stopColor={source.color} />
                <stop offset="100%" stopColor={target.color} />
              </linearGradient>
            )
          })}
        </defs>

        <g ref={groupRef} transform={zoomTransform}>
          {(mode === 'cluster' || mode === 'category') && (
            <g className="atlas-nebulae" aria-hidden="true">
              {clusterStats.map(cluster => {
                const dim =
                  (activeCluster !== null && activeCluster !== cluster.id) ||
                  (emphasisClusterId !== null && emphasisClusterId !== cluster.id)
                const strong = emphasisClusterId === cluster.id

                // Communauté ouverte : les nébuleuses des autres communautés,
                // presque invisibles et très agrandies, ne sont pas dessinées.
                if (activeCluster !== null && activeCluster !== cluster.id) return null

                return (
                  <React.Fragment key={`halo-${cluster.id}`}>
                    <circle
                      className={
                        guideClusterId === cluster.id
                          ? 'eclaireur-cluster-pulse'
                          : 'atlas-nebula'
                      }
                      cx={cluster.centerX}
                      cy={cluster.centerY}
                      r={cluster.radius * 1.25}
                      fill={`url(#atlas-nebula-${cluster.id})`}
                      opacity={dim ? 0.02 : strong ? 0.2 : 0.1}
                    />
                    {cluster.nodeCount >= 4 && (
                      <circle
                        className="atlas-orbit"
                        cx={cluster.centerX}
                        cy={cluster.centerY}
                        r={cluster.spread + 22 * unit}
                        stroke={cluster.color}
                        opacity={dim ? 0.05 : strong ? 0.55 : 0.2}
                      />
                    )}
                  </React.Fragment>
                )
              })}
            </g>
          )}

          {guideClusterId !== null && (() => {
            const guideCluster = clusterStats.find(cluster => cluster.id === guideClusterId)
            if (!guideCluster) return null
            return (
              <g className="eclaireur-cluster-guide-rings" aria-hidden="true">
                <circle
                  className="eclaireur-cluster-guide-ring"
                  cx={guideCluster.centerX}
                  cy={guideCluster.centerY}
                  r={guideCluster.spread + 18 * unit}
                  style={{ stroke: guideCluster.color }}
                />
                <circle
                  className="eclaireur-cluster-guide-ring eclaireur-cluster-guide-ring-2"
                  cx={guideCluster.centerX}
                  cy={guideCluster.centerY}
                  r={guideCluster.spread + 30 * unit}
                  style={{ stroke: guideCluster.color }}
                />
              </g>
            )
          })()}

          <g className="entry-edges atlas-edges">
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

              const emphasisActive =
                emphasisClusterId === null ||
                source.clusterId === emphasisClusterId ||
                target.clusterId === emphasisClusterId

              const sameCluster = source.clusterId === target.clusterId
              const isGuideEdge =
                guideLinkKeys.has(`${edge.source}|${edge.target}`)
              const isActive =
                selectedId &&
                (edge.source === selectedId || edge.target === selectedId)

              const base = sameCluster ? 0.72 : 0.36
              const leavesOpenCluster =
                activeCluster !== null &&
                (source.clusterId !== activeCluster || target.clusterId !== activeCluster)
              const opacity =
                isActive
                  ? (leavesOpenCluster ? 0.3 : 1)
                  : selectedActive && clusterActive && emphasisActive
                    ? base * linkDensity
                    : activeCluster !== null ? 0.05 : 0.09

              return (
                <g key={`${edge.source}-${edge.target}-${index}`} opacity={opacity}>
                  {(sameCluster || isActive) && (
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      className="atlas-edge-glow"
                      stroke={`url(#atlas-edge-${index})`}
                    />
                  )}
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={`url(#atlas-edge-${index})`}
                    className={
                      `${isActive ? 'entry-edge active' : 'entry-edge'} atlas-edge ${sameCluster ? 'intra-cluster' : 'inter-cluster'} ${
                        isGuideEdge ? 'eclaireur-link-pulse' : ''
                      }`
                    }
                  />
                </g>
              )
            })}
          </g>

          <g className="entry-nodes atlas-nodes">
            {positionedNodes.map(node => {
              const isSelected = selectedId === node.id
              const radius = radiusFor(node)
              const gradientKey = node.isolated ? 'iso' : node.clusterId
              const opacity = nodeOpacity(node)
              const isHovered = hoveredId === node.id

              return (
                <g
                  key={node.id}
                  className={`atlas-node ${isSelected ? 'is-selected' : ''}`}
                  opacity={opacity}
                  data-node-id={node.id}
                  data-cluster-id={node.clusterId}
                >
                  {opacity >= 0.15 && (
                    <circle
                      className="atlas-node-halo"
                      cx={node.x}
                      cy={node.y}
                      r={radius * (isSelected || isHovered ? 3.6 : 2.9)}
                      fill={`url(#atlas-halo-${gradientKey})`}
                      pointerEvents="none"
                    />
                  )}

                  {guideOverviewNodeIds.has(node.id) && (
                    <circle
                      className="eclaireur-overview-node-ring atlas-guide-ring"
                      cx={node.x}
                      cy={node.y}
                      r={radius + 12 * unit}
                    />
                  )}

                  {guideIsolatedNodeId === node.id && (
                    <circle
                      className="eclaireur-isolated-node-ring atlas-guide-ring"
                      cx={node.x}
                      cy={node.y}
                      r={radius + 12 * unit}
                    />
                  )}

                  {guideNodeId === node.id && (
                    <circle
                      className="eclaireur-node-pulse-ring"
                      cx={node.x}
                      cy={node.y}
                      r={radius * 1.9}
                    />
                  )}

                  <circle
                    className={`atlas-node-core ${
                      guideOverviewNodeIds.has(node.id)
                        ? 'eclaireur-overview-node-core'
                        : ''
                    }`}
                    cx={node.x}
                    cy={node.y}
                    r={radius}
                    fill={`url(#atlas-core-${gradientKey})`}
                    stroke={isSelected ? '#ffffff' : node.color}
                    strokeWidth={isSelected ? 2.6 : 1}
                    strokeOpacity={isSelected ? 1 : 0.9}
                    pointerEvents="none"
                  />

                  {isSelected && (
                    <circle
                      className="atlas-selected-ring"
                      cx={node.x}
                      cy={node.y}
                      r={radius + 7 * (activeCluster !== null ? unit / scale : unit)}
                      stroke={node.color}
                      pointerEvents="none"
                    />
                  )}

                  <circle
                    className="node-hit-target"
                    cx={node.x}
                    cy={node.y}
                    r={radius}
                    fill="transparent"
                    pointerEvents="none"
                    onFocus={() => setHoveredId(node.id)}
                    onBlur={() => setHoveredId(null)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelect?.(node)
                      }
                    }}
                    tabIndex="0"
                    role="button"
                    aria-label={node.label}
                  />
                </g>
              )
            })}
          </g>

          {(mode === 'cluster' || mode === 'category') && activeCluster === null && (
            <g className="entry-cluster-labels atlas-titles">
              {clusterStats.map(cluster => {
                const spot = cluster.placement
                if (!spot) return null

                const revealed =
                  cluster.showLabel ||
                  emphasisClusterId === cluster.id ||
                  guideClusterId === cluster.id ||
                  guideTitleClusterId === cluster.id ||
                  guideTransClusterId === cluster.id
                if (!revealed) return null

                const dim =
                  emphasisClusterId !== null && emphasisClusterId !== cluster.id

                // Trait de rappel : du bord de l'intitulé au nœud le plus proche.
                const k = titleScale
                const nearestNode = positionedNodes
                  .filter(n => n.clusterId === cluster.id)
                  .reduce((best, n) => {
                    const d = Math.hypot(n.x - spot.cx, n.y - spot.cy)
                    return !best || d < best.d ? { n, d } : best
                  }, null)?.n

                let leader = null
                if (nearestNode) {
                  const scaledRect = {
                    x0: spot.cx + (spot.rect.x0 - spot.cx) * k,
                    x1: spot.cx + (spot.rect.x1 - spot.cx) * k,
                    y0: spot.cy + (spot.rect.y0 - spot.cy) * k,
                    y1: spot.cy + (spot.rect.y1 - spot.cy) * k,
                  }
                  const p = nearestOnRect(scaledRect, nearestNode.x, nearestNode.y)
                  const len = Math.hypot(nearestNode.x - p.x, nearestNode.y - p.y)
                  const nodeR = radiusFor(nearestNode) + 5 * unit
                  if (len > nodeR + 16 * unit) {
                    const t = (len - nodeR) / len
                    leader = {
                      x1: p.x,
                      y1: p.y,
                      x2: p.x + (nearestNode.x - p.x) * t,
                      y2: p.y + (nearestNode.y - p.y) * t,
                    }
                  }
                }

                return (
                  <g key={`title-wrap-${cluster.id}`} opacity={dim ? 0.28 : 1} className="atlas-title-wrap">
                    {leader && (
                      <>
                        <line
                          className="atlas-leader"
                          {...leader}
                          stroke={cluster.color}
                        />
                        <circle
                          className="atlas-leader-dot"
                          cx={leader.x2}
                          cy={leader.y2}
                          r={2.2 * unit}
                          fill={cluster.color}
                        />
                      </>
                    )}
                    {renderTitle(cluster, { cx: spot.cx, cy: spot.cy, k, open: false, box: spot.box })}
                  </g>
                )
              })}
            </g>
          )}

          {activeClusterStat && (() => {
            const u = unit / scale
            const h = activeClusterStat.box.h * u
            const cy = activeClusterStat.minY - (corePx(14) * 1.25 + 18) * u - h / 2
            return (
              <g className="entry-cluster-labels atlas-titles">
                {renderTitle(activeClusterStat, {
                  cx: activeClusterStat.centerX,
                  cy,
                  k: 1,
                  open: true,
                })}
              </g>
            )
          })()}

          {activeCluster !== null && (
            <g className="entry-node-labels-open-cluster atlas-open-labels" pointerEvents="none">
              {activeNodeLabels.items.map(item => {
                const openFont = (activeNodeLabels.font * unit) / scale
                const openLine = openFont * 1.25
                const lines = item.lines
                const isSel = selectedId === item.node.id

                const textX =
                  item.side === 'left'
                    ? item.x - openFont * 0.5
                    : item.x + openFont * 0.5

                return (
                  <g key={`open-label-${item.node.id}`} className={isSel ? 'is-selected' : ''}>
                    <line
                      x1={item.node.x}
                      y1={item.node.y}
                      x2={item.x}
                      y2={item.y}
                      className="entry-open-label-link atlas-open-link"
                      stroke={item.node.color}
                    />

                    <text
                      x={textX}
                      y={item.y - ((lines.length - 1) * openLine) / 2 + openFont * 0.35}
                      textAnchor={item.side === 'left' ? 'end' : 'start'}
                      className="entry-open-node-label atlas-open-label"
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

          {labelNode && !(activeCluster !== null && labelNode.clusterId === activeCluster) && (() => {
            const u = activeCluster !== null ? unit / scale : unit / Math.max(1, scale)
            const r = radiusFor(labelNode)
            return (
              <g className="entry-node-label atlas-node-tip" pointerEvents="none">
                <text
                  x={labelNode.x + r + 8 * u}
                  y={labelNode.y - r - 4 * u}
                  textAnchor="start"
                  style={{ fontSize: `${14 * u}px` }}
                >
                  {labelNode.label}
                </text>
              </g>
            )
          })()}
        </g>
      </svg>
    </section>
  )
}
