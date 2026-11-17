// Recomposition statique du canevas personnel : aucune donnée envoyée au serveur.
import { exportDocx, printHtml, escapeXml, pubLabel, sourceLink, namePart } from './knowledgeExport.js'

const palettes = {
  blue: ['#e4f0ff', '#2169b9'], yellow: ['#fff2c9', '#a2751d'], lilac: ['#f0e4ff', '#7254a4'], green: ['#e3f7e9', '#388458'], sand: ['#fff3da', '#896a37'],
}
const dims = card => ({ width: 265, height: card.collapsed ? 74 : card.materialId ? 204 : 180 })
function wrap(ctx, text, maxWidth, maxRows = 8) {
  const words = String(text || '').split(/\s+/).filter(Boolean), result = []
  let row = ''
  for (const word of words) {
    const next = row ? `${row} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth) row = next
    else { if (row) result.push(row); row = word }
  }
  if (row) result.push(row)
  return result.slice(0, maxRows).map((line, i) => i === maxRows - 1 && result.length > maxRows ? `${line.slice(0, -2)}…` : line)
}
function rounded(ctx, x, y, w, h, radius = 10) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius)
}
export function canvasImage(cards = [], links = [], subject = '') {
  const maxX = Math.max(900, ...cards.map(c => Number(c.x || 0) + dims(c).width + 40))
  const maxY = Math.max(550, ...cards.map(c => Number(c.y || 0) + dims(c).height + 50))
  const width = Math.min(Math.round(maxX + 65), 2800), height = Math.min(Math.round(maxY + 95), 3800)
  if (width * height > 9500000) throw new Error('Canevas trop grand pour l’image : privilégiez l’export Word.')
  const canvas = document.createElement('canvas'); canvas.width = width * 2; canvas.height = height * 2
  const ctx = canvas.getContext('2d'); ctx.scale(2, 2)
  ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#143a6d'; ctx.font = 'bold 21px Arial'; ctx.fillText('Quiritès Veille Lab · Mon canevas', 24, 34)
  if (subject) { ctx.fillStyle = '#506882'; ctx.font = '13px Arial'; ctx.fillText(subject.slice(0, 110), 24, 55) }
  const coords = c => ({ x: Number(c.x || 0) + 25, y: Number(c.y || 0) + 65 })
  links.forEach(link => {
    const a = cards.find(c => c.id === link.source), b = cards.find(c => c.id === link.target)
    if (!a || !b) return
    const ac = coords(a), bc = coords(b), ad = dims(a), bd = dims(b)
    const ax = ac.x + ad.width / 2, ay = ac.y + ad.height / 2, bx = bc.x + bd.width / 2, by = bc.y + bd.height / 2
    ctx.strokeStyle = '#6686ad'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
    if (link.label) { const mx = (ax + bx)/2, my = (ay + by)/2;ctx.font = '11px Arial';ctx.fillStyle = '#274c7e';ctx.fillText(String(link.label).slice(0,32), mx - 22, my - 8) }
  })
  cards.forEach(c => {
    const { x, y } = coords(c), { width: w, height: h } = dims(c), [background, accent] = palettes[c.tone] || palettes.sand
    ctx.fillStyle = background;ctx.strokeStyle = accent;ctx.lineWidth = 1.5;rounded(ctx,x,y,w,h);ctx.fill();ctx.stroke()
    ctx.fillStyle = accent; ctx.font = 'bold 11px Arial';ctx.fillText(String(c.kind || 'Note').slice(0,30),x+12,y+21)
    let pos = y + 46
    ctx.fillStyle = '#14314e'
    if (c.title) { ctx.font = 'bold 13px Arial'; for (const line of wrap(ctx, c.title, w-25, 2)) { ctx.fillText(line,x+12,pos);pos+=17 } }
    ctx.font = '12px Arial'
    for (const line of wrap(ctx,c.text,w-25, c.collapsed ? 2 : c.materialId ? 5 : 7)) { ctx.fillText(line,x+12,pos);pos+=16 }
    if (c.materialId) {
      const m = c.material || {}, pub = m.publication || m.source_publication || {}
      const pubTitle = m.publication_title || pub.titre || pub.title || m.publication_id || ''
      const locator = m.page_source || m.locator || m.provenance?.source_locator || ''
      ctx.fillStyle = '#536782';ctx.font = '10px Arial'
      const lines = wrap(ctx, [pubTitle, locator && `p. ${locator}`].filter(Boolean).join(' · '), w-24, 2)
      lines.forEach((line,i)=>ctx.fillText(line,x+12,y+h-22+(i*12)-(lines.length-1)*12))
    }
  })
  return canvas.toDataURL('image/png')
}
export function exportCanvasPng(cards, links, subject) {
  const data = canvasImage(cards, links, subject)
  const a = document.createElement('a'); a.href = data; a.download = `Canevas_${namePart(subject || 'Quirites')}.png`; document.body.appendChild(a); a.click(); a.remove()
}
export function exportCanvasPdf(cards, links, subject) {
  const image = canvasImage(cards, links, subject)
  printHtml('Mon canevas · Quiritès Veille Lab', `<p>${escapeXml(subject || '')}</p><img src="${image}" alt="Canevas et relations"/>`)
}
export function exportCanvasWord(cards, links, subject) {
  const byId = Object.fromEntries(cards.map(c => [c.id,c]))
  const entries = [{ text: `Sujet : ${subject || 'Non défini'}` }, { heading: true, text: `Post-it conservés (${cards.length})` }]
  cards.forEach((c,i) => {
    const m = c.material || {}, pub = m.publication || m.source_publication || {}
    entries.push({ heading: true, text: `${i+1}. ${c.title || c.kind || 'Note'}` }, { text: c.text || '' })
    const label = m.publication_title || pubLabel(pub) || m.publication_id || ''
    if (label) entries.push({ text: `Publication : ${label}` })
    const page = m.page_source || m.provenance?.source_locator || m.locator
    if (page) entries.push({ text: `Page / timecode : ${page}` })
    const url = sourceLink(m) || sourceLink(pub)
    if (url) entries.push({ text: `Document source : ${url}` })
    if (c.userEdited) entries.push({ text: 'Post-it édité par l’utilisateur : formulation d’origine distincte de la preuve documentaire.' })
  })
  entries.push({ heading: true, text: `Liaisons personnelles (${links.length})` })
  links.forEach(l => entries.push({ text: `${byId[l.source]?.title || byId[l.source]?.text || l.source} — ${l.label || 'lien non qualifié'} — ${byId[l.target]?.title || byId[l.target]?.text || l.target}` }))
  entries.push({ text: 'Les liaisons entre post-it sont des constructions personnelles de l’utilisateur, non des relations validées du corpus.' })
  exportDocx(`Canevas_${subject || 'Quirites'}`, 'Mon canevas — Quiritès Veille Lab', entries)
}
