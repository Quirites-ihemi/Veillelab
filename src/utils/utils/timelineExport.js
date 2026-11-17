// PNG documentaire : frise verticale recomposée depuis les repères chronologiques retenus.
// Le libellé et l'expression temporelle sont repris tels qu'ils figurent dans les données.
import { namePart } from './knowledgeExport.js'

const COLORS = {
  evenement: '#2573c9', jalon: '#288c70', emergence: '#8a62bf',
  tendance: '#c08c27', rupture_inflexion: '#b95461', sequence_historique: '#466783',
}

function lines(ctx, raw, width, max = 4) {
  const words = String(raw || '').replace(/\s+/g, ' ').split(' ').filter(Boolean)
  const result = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width <= width) line = test
    else { if (line) result.push(line); line = word }
  }
  if (line) result.push(line)
  return result.slice(0, max).map((s, i) => i === max - 1 && result.length > max ? `${s.replace(/.{0,2}$/, '')}…` : s)
}

export function exportTimelinePng(publication, elements, provenances) {
  const items = elements.filter(e => e.decision_post_traitement === 'retenu' || e.decision_post_traitement === 'non_positionnable')
  const width = 1280, rowHeight = 116, head = 184, footer = 70
  const height = head + items.length * rowHeight + footer
  if (height > 13000) throw new Error('Frise trop longue pour un seul PNG : utilisez l’export Excel ou PDF.')
  const scale = height > 5500 ? 1 : 1.5
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Impossible de produire le PNG de la frise.')
  ctx.scale(scale, scale)
  ctx.fillStyle = '#f7fafe'; ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#103a6c'; ctx.font = 'bold 26px Arial'; ctx.fillText('Du texte à la frise', 55, 59)
  ctx.font = '18px Arial'; ctx.fillStyle = '#355676'
  const title = String(publication?.titre || publication?.publication_id || '')
  for (const [i, line] of lines(ctx, title, width - 110, 2).entries()) ctx.fillText(line, 55, 94 + i * 22)
  ctx.fillStyle = '#68819b'; ctx.font = '14px Arial'
  ctx.fillText(`${publication?.organisme_producteur || ''} · ${publication?.['année_publication'] || ''} · ${items.length} repères issus du corpus`, 55, 151)
  const x = 270
  ctx.strokeStyle = '#acc6e7'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, head-20); ctx.lineTo(x, height-footer+8); ctx.stroke()
  items.forEach((e, i) => {
    const y = head + i * rowHeight
    const accent = COLORS[e.nature_chronologique] || '#5c7b9d'
    if (i % 2 === 0) { ctx.fillStyle = '#eaf1fa';ctx.fillRect(30, y-9, width-60, rowHeight-2) }
    ctx.fillStyle = accent;ctx.beginPath();ctx.arc(x, y+29, 8, 0, Math.PI*2);ctx.fill()
    ctx.fillStyle = '#24517b';ctx.font = 'bold 17px Arial'
    const when = e.expression_temporelle_source || 'Sans date positionnable'
    for (const [n, line] of lines(ctx, when, 195, 2).entries())ctx.fillText(line, 50, y + 27 + n*18)
    ctx.fillStyle = '#153a63';ctx.font = 'bold 16px Arial'
    for (const [n, line] of lines(ctx, e.libelle, 900, 3).entries()) ctx.fillText(line, x+25, y + 26 + n*20)
    const provenance = (provenances[e.chrono_id] || [])[0]
    const repere = provenance?.page_source ? ` · p./timecode ${provenance.page_source}` : ''
    ctx.fillStyle = '#5e7895';ctx.font = '13px Arial'
    ctx.fillText(`${e.nature_chronologique || 'Élément'}${repere}`, x+25, y+96)
  })
  ctx.fillStyle = '#68819b';ctx.font = '13px Arial'
  ctx.fillText('Quiritès Veille Lab · libellés et repères issus de la publication, sans ajout de dates', 55, height-32)
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png');a.download = `Frise_${namePart(publication?.publication_id || 'chronologie')}.png`
  document.body.appendChild(a);a.click();a.remove()
}
