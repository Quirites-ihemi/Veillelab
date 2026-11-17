// Exports locaux, sans appel serveur. Les sources sont celles du corpus affiché.
import { buildZip, downloadBytes } from './expertExport.js'

const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
export const namePart = value => String(value || 'export').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60)
export const sourceLink = pub => {
  const url = String(pub?.url_contenu || pub?.url_source || '').trim().split(/\s+/)[0]
  return /^https?:\/\//i.test(url) ? url : ''
}
export const pubLabel = pub => [pub?.titre || pub?.title || pub?.publication_id || '', pub?.organisme_producteur || pub?.organisme || '', pub?.['année_publication'] || pub?.annee || ''].filter(Boolean).join(' — ')

const para = (value, style = '') => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/><w:spacing w:after="120"/></w:pPr>` : '<w:pPr><w:spacing w:after="100"/></w:pPr>'}<w:r><w:t xml:space="preserve">${xml(value)}</w:t></w:r></w:p>`
const coreProps = (title) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(title)}</dc:title><dc:creator>Quiritès Veille Lab</dc:creator></cp:coreProperties>`
const appProps = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Quiritès Veille Lab</Application></Properties>`
const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`
const docTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`
const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="133E74"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="2553A0"/></w:rPr></w:style></w:styles>`

// paragraphs : [{text,heading?}]. Ce format ne transforme pas les formulations du corpus.
export function exportDocx(filename, title, paragraphs = []) {
  const body = [para(title, 'Title'), ...paragraphs.map(p => para(p.text ?? '', p.heading ? 'Heading1' : ''))].join('')
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:bottom="1000" w:left="1100" w:right="1100"/></w:sectPr></w:body></w:document>`
  const zip = buildZip({
    '[Content_Types].xml': docTypes, '_rels/.rels': rootRels, 'docProps/core.xml': coreProps(title), 'docProps/app.xml': appProps,
    'word/document.xml': doc, 'word/styles.xml': styles,
    'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  })
  downloadBytes(zip, `${namePart(filename)}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
}

const column = n => { let result = ''; for (let k = n + 1; k > 0; k = Math.floor((k - 1) / 26)) result = String.fromCharCode(65 + (k - 1) % 26) + result; return result }
export function exportXlsx(filename, headers, rows) {
  const all = [headers, ...rows]
  const sheetRows = all.map((cells, index) => `<row r="${index + 1}">${headers.map((_, i) => `<c r="${column(i)}${index + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(cells[i] ?? '')}</t></is></c>`).join('')}</row>`).join('')
  const last = `${column(headers.length - 1)}${all.length}`
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Données" sheetId="1" r:id="rId1"/></sheets></workbook>`
  const relations = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`
  const rr = rootRels.replace('word/document.xml', 'xl/workbook.xml')
  downloadBytes(buildZip({'[Content_Types].xml': types,'_rels/.rels': rr,'docProps/core.xml': coreProps(filename),'docProps/app.xml': appProps,'xl/workbook.xml': workbook,'xl/_rels/workbook.xml.rels': relations,'xl/worksheets/sheet1.xml': worksheet}), `${namePart(filename)}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

// Export PNG du SVG réellement affiché : conserve les filtres, le zoom et le cadrage.
const SVG_STYLE = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor', 'paint-order', 'color', 'visibility']
export async function svgPngData(svg, { maxWidth = 2000, background = '#ffffff' } = {}) {
  if (!svg) throw new Error('Aucun graphe affiché à exporter.')
  const original = svg.getBoundingClientRect()
  const vb = svg.viewBox?.baseVal
  const ratio = vb?.width && vb?.height ? vb.width / vb.height : (original.width || 4) / (original.height || 3)
  const width = Math.round(Math.min(maxWidth, Math.max(1000, (original.width || 900) * 2)))
  const height = Math.round(width / ratio)
  if (width * height > 15000000) throw new Error('Graphe trop grand pour cet export.')
  const copy = svg.cloneNode(true)
  const from = [svg, ...svg.querySelectorAll('*')]
  const to = [copy, ...copy.querySelectorAll('*')]
  from.forEach((el, idx) => {
    const computed = getComputedStyle(el)
    const out = to[idx]
    if (!out) return
    const style = SVG_STYLE.map(k => `${k}:${computed.getPropertyValue(k)}`).join(';')
    out.setAttribute('style', `${out.getAttribute('style') || ''};${style}`)
  })
  copy.setAttribute('width', String(width))
  copy.setAttribute('height', String(height))
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const blob = new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('Le graphe ne peut pas être converti en PNG.')); image.src = url })
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Impossible d’accéder au moteur graphique.')
    ctx.fillStyle = background; ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)
    return canvas.toDataURL('image/png')
  } finally { URL.revokeObjectURL(url) }
}
export async function exportSvgPng(svg, filename) {
  const data = await svgPngData(svg)
  const a = document.createElement('a'); a.href = data; a.download = `${namePart(filename)}.png`; document.body.appendChild(a); a.click(); a.remove()
}
export function printHtml(title, body) {
  const win = window.open('', '_blank')
  if (!win) throw new Error('Fenêtre d’impression bloquée par le navigateur.')
  win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${xml(title)}</title><style>@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#183355;font-size:11pt;line-height:1.48}h1{font-size:21pt;color:#143b70}h2{font-size:14pt;margin-top:22px}.source{font-size:9pt;color:#52677e}img{max-width:100%;height:auto}p,li{break-inside:avoid}a{color:#1c57a8}</style></head><body><h1>${xml(title)}</h1>${body}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));<\/script></body></html>`)
  win.document.close()
}
export async function printSvgPdf(svg, title) {
  // Ouvrir la fenêtre AVANT l'opération asynchrone pour ne pas déclencher le bloqueur de pop-up.
  const win = window.open('', '_blank')
  if (!win) throw new Error('Fenêtre d’impression bloquée par le navigateur.')
  try {
    const png = await svgPngData(svg)
    win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${xml(title)}</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#183355}h1{font-size:19px}img{max-width:100%;max-height:85vh;object-fit:contain}small{color:#586b84}</style></head><body><h1>${xml(title)}</h1><img src="${png}" alt="Graphe exporté"/><p><small>Quiritès Veille Lab · vue affichée lors de l’export</small></p><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));<\/script></body></html>`)
    win.document.close()
  } catch (error) { win.close(); throw error }
}
export { xml as escapeXml }
