// QUIRITÈS VEILLE LAB — Atlas des expertises ministérielles
// Palette lumineuse appliquée aux 15 clusters RÉELS de expertiseGephiLayout.js.
// Les identifiants et les libellés des clusters ne sont pas modifiés : seule
// la couleur d'affichage est ravivée pour un fond sombre. Chaque teinte
// reprend celle d'origine, sauf deux couleurs illisibles sur fond noir :
// le brun du cluster 40 et le gris du cluster 27.

import { expertiseClusters } from './expertiseGephiLayout.js'

export const ATLAS_CLUSTER_COLORS = {
  1: '#2EF0C3',   // origine #16B79C — turquoise
  5: '#5CD8FF',   // origine #78CFFF — cyan
  6: '#C68CFF',   // origine #B58AC8 — violet
  8: '#FF9DB8',   // origine #D8B6B6 — rose poudré
  11: '#E874FF',  // origine #C975E6 — magenta
  14: '#3FAEFF',  // origine #4DA8C7 — bleu électrique
  16: '#FF5C95',  // origine #F26E8C — rose
  19: '#7C8CFF',  // origine #6E95D5 — bleu pervenche
  27: '#86F3FF',  // origine #BFC6D2 (gris) — cyan glacier
  33: '#FFB547',  // origine #F1A43A — ambre
  38: '#9B7BFF',  // origine #5B6FCF — indigo
  39: '#FFD46E',  // origine #E2A760 — or
  40: '#FF8A5C',  // origine #5A5249 (brun) — corail
  42: '#A9C0FF',  // origine #8898D9 — bleu lavande
  43: '#A6F25E',  // origine #97C53D — vert lumineux
}

// Micro-expertises isolées : seules dans leur classe de modularité, sans nom
// de cluster. Elles restent visibles, en blanc bleuté discret.
export const ATLAS_ISOLATED_COLOR = '#B9C8EA'

export function atlasClusterColor(clusterId) {
  if (ATLAS_CLUSTER_COLORS[clusterId]) return ATLAS_CLUSTER_COLORS[clusterId]
  const original = expertiseClusters.find(cluster => cluster.id === clusterId)
  return original?.color || ATLAS_ISOLATED_COLOR
}
