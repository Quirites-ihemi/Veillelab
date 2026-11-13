// Généré à partir des utilitaires de scenarioExport.js (non modifié).
const encoder = new TextEncoder()
const utf8 = value => encoder.encode(String(value ?? ''))
const xmlEscape = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')
const sanitizeFilename = value => String(value || 'scenario-veille').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,72) || 'scenario-veille'
const today = () => new Date().toISOString().slice(0,10)

function crc32(bytes){let crc=0^-1;for(let i=0;i<bytes.length;i++){crc^=bytes[i];for(let j=0;j<8;j++)crc=(crc>>>1)^(0xEDB88320&-(crc&1))}return(crc^-1)>>>0}
function u16(n){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,n,true);return b}
function u32(n){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n>>>0,true);return b}
function concat(parts){const total=parts.reduce((n,p)=>n+p.length,0);const out=new Uint8Array(total);let offset=0;parts.forEach(p=>{out.set(p,offset);offset+=p.length});return out}
function buildZip(files){const locals=[],central=[];let offset=0;Object.entries(files).forEach(([name,content])=>{const nameBytes=utf8(name),data=content instanceof Uint8Array?content:utf8(content),crc=crc32(data);const local=concat([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nameBytes.length),u16(0),nameBytes,data]);locals.push(local);const cen=concat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nameBytes.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),nameBytes]);central.push(cen);offset+=local.length});const centralStart=offset,centralBytes=concat(central),end=concat([u32(0x06054b50),u16(0),u16(0),u16(central.length),u16(central.length),u32(centralBytes.length),u32(centralStart),u16(0)]);return concat([...locals,centralBytes,end])}
function downloadBytes(bytes,filename,mime){const blob=new Blob([bytes],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function wText(text,bold=false,italic=false,color=''){const r=[];if(bold)r.push('<w:b/>');if(italic)r.push('<w:i/>');if(color)r.push(`<w:color w:val="${color}"/>`);return `<w:r>${r.length?`<w:rPr>${r.join('')}</w:rPr>`:''}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`}
function wPara(inner,style='',after=100){return `<w:p><w:pPr>${style?`<w:pStyle w:val="${style}"/>`:''}<w:spacing w:after="${after}"/></w:pPr>${inner}</w:p>`}
function wHyperlink(text,rId){return `<w:hyperlink r:id="${rId}" w:history="1"><w:r><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr><w:t>${xmlEscape(text)}</w:t></w:r></w:hyperlink>`}

// Export Word de la version 3 : chaque axe, ses éléments par type (repris tels
// quels de la base, avec publication et repère) et ses acteurs à suivre.
function repere(value=''){const raw=String(value||'').trim();if(!raw)return'';if(/^[\d;\s–-]+$/.test(raw))return `p. ${raw.split(';').map(s=>s.trim()).filter(Boolean).join(', ')}`;return raw}
function pdfLink(url,rep){const raw=String(url||'').trim();if(!raw)return'';const first=(String(rep||'').match(/^\d+/)||[])[0];return /\.pdf(?:$|[?#])/i.test(raw)&&first?`${raw.split('#')[0]}#page=${first}`:raw}

export function buildScenarioV3Docx(result,keptAxisIds=null){
  const links=[],paras=[]
  const link=(text,url)=>{const rId=`rId${links.length+1}`;links.push({rId,url});return wHyperlink(text,rId)}
  const axes=(result?.axes||[]).filter(a=>!keptAxisIds||keptAxisIds.includes(a.axis_id))
  paras.push(wPara(wText('Scénario de veille',true),'Title',90))
  paras.push(wPara(wText(`Date d’export : ${new Intl.DateTimeFormat('fr-FR').format(new Date())}`),'',45))
  paras.push(wPara(wText('Besoin de veille',true),'Heading1',45))
  paras.push(wPara(wText(result?.need||''),'',65))
  paras.push(wPara(wText('Les titres et questions des axes sont proposés par l’IA. Les éléments sont repris tels quels des publications du bulletin, avec leur repère.',false,true,'687B94'),'',85))
  if(!axes.length)paras.push(wPara(wText('Aucun axe retenu.')))
  axes.forEach((axis,i)=>{
    paras.push(wPara(wText(`Axe ${i+1}. ${axis.titre||''}`,true),'Heading1',35))
    if(axis.question_veille)paras.push(wPara(wText(`Question de veille : ${axis.question_veille}`,false,true),'',35))
    paras.push(wPara(wText(`${axis.publication_count} publication${axis.publication_count>1?'s':''}${axis.statut_documentaire==='publication_unique'?' — axe appuyé sur une seule publication':''}`,false,false,'687B94'),'',45))
    ;(axis.groupes||[]).forEach(group=>{
      paras.push(wPara(wText(`${group.label} (${group.elements.length})`,true),'Heading2',25))
      group.elements.forEach(el=>{
        paras.push(wPara(wText(`• ${el.libelle}`),'',10))
        const ref=[el.publication_id,el.titre,el.organisme_producteur,repere(el.repere)].filter(Boolean).join(' — ')
        const href=pdfLink(el.url,el.repere)
        paras.push(wPara(wText(`   ${ref}`,false,false,'506B86')+(href?wText('  ')+link('Ouvrir',href):''),'',35))
      })
    })
    if(axis.acteurs_a_suivre?.length){
      paras.push(wPara(wText(`Acteurs à suivre (${axis.acteurs_a_suivre.length})`,true),'Heading2',25))
      axis.acteurs_a_suivre.forEach(actor=>{
        const pubs=[...new Set((actor.appuis||[]).map(a=>a.publication_id))].join(', ')
        paras.push(wPara(wText(`• ${actor.libelle}`)+wText(pubs?`  (${pubs})`:'',false,false,'506B86'),'',20))
      })
    }
  })
  const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${paras.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`
  const documentRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${links.map(l=>`<Relationship Id="${l.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(l.url)}" TargetMode="External"/>`).join('')}</Relationships>`
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:color w:val="102A56"/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:color w:val="16345D"/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:color w:val="234F7D"/><w:sz w:val="24"/></w:rPr></w:style></w:styles>`
  const core=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Scénario de veille Quiritès Veille Lab</dc:title><dc:creator>Quiritès Veille Lab</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`
  const app=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Quiritès Veille Lab</Application></Properties>`
  const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`
  const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`
  return buildZip({'[Content_Types].xml':contentTypes,'_rels/.rels':rootRels,'docProps/core.xml':core,'docProps/app.xml':app,'word/document.xml':documentXml,'word/styles.xml':styles,'word/_rels/document.xml.rels':documentRels})
}

export function exportScenarioV3Word(result,keptAxisIds=null){downloadBytes(buildScenarioV3Docx(result,keptAxisIds),`Scenario_de_veille_${sanitizeFilename(result?.need)}_${today()}.docx`,'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
