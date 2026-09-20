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

function normSource(source={}){return {material_id:source.material_id||'',publication_id:source.publication_id||'',title:source.title||source.titre||'',organisation:source.organisation||source.organisme_producteur||'',year:source.year||source.annee_publication||'',locator:source.locator||source.repere||'',provenance:source.provenance||source.provenance_level||'',url:source.url||'',excerpt:source.excerpt||source.extrait||'',origin:source.origin||'corpus'}}
function sourceUrl(source){const s=normSource(source),raw=String(s.url||'').trim();if(!raw)return'';const rep=String(s.locator||'').trim();if(/\.pdf(?:$|[?#])/i.test(raw)&&/^\d+$/.test(rep))return `${raw.split('#')[0]}#page=${rep}`;return raw}
function sourceRef(source){const s=normSource(source);return [s.title,s.organisation,s.year,s.locator?`repère ${s.locator}`:'',s.provenance?`provenance ${s.provenance}`:''].filter(Boolean).join(' — ')}
function wText(text,bold=false,italic=false,color=''){const r=[];if(bold)r.push('<w:b/>');if(italic)r.push('<w:i/>');if(color)r.push(`<w:color w:val="${color}"/>`);return `<w:r>${r.length?`<w:rPr>${r.join('')}</w:rPr>`:''}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`}
function wPara(inner,style='',after=100){return `<w:p><w:pPr>${style?`<w:pStyle w:val="${style}"/>`:''}<w:spacing w:after="${after}"/></w:pPr>${inner}</w:p>`}
function wHyperlink(text,rId){return `<w:hyperlink r:id="${rId}" w:history="1"><w:r><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr><w:t>${xmlEscape(text)}</w:t></w:r></w:hyperlink>`}
function addSourceParas(paras,sources,links){(sources||[]).forEach(source=>{const ref=sourceRef(source);if(ref)paras.push(wPara(wText(`Source : ${ref}`,false,false,'506B86'),'',25));const href=sourceUrl(source);if(href){const rId=`rId${links.length+1}`;links.push({rId,url:href});paras.push(wPara(wHyperlink('Ouvrir la source',rId),'',45))}})}
function addItem(paras,item,links,prefix='• '){paras.push(wPara(wText(`${prefix}${item.title||item.label||''}`,true),'',35));if(item.objective)paras.push(wPara(wText(item.objective),'',35));if(item.interpretation)paras.push(wPara(wText(item.interpretation),'',35));if(item.why)paras.push(wPara(wText(`Pourquoi : ${item.why}`),'',30));if(item.limit)paras.push(wPara(wText(`Limite : ${item.limit}`,false,true,'8B4A4A'),'',35));addSourceParas(paras,item.sources,links)}

export function buildScenarioDocx(result){
  const links=[],paras=[]
  paras.push(wPara(wText('Scénario de veille',true),'Title',90))
  paras.push(wPara(wText(`Date d’export : ${new Intl.DateTimeFormat('fr-FR').format(new Date())}`),'',45))
  paras.push(wPara(wText('Traçabilité',true),'Heading2',35))
  const trace=result?.traceability||{}
  paras.push(wPara(wText(`Moteurs : ${[trace.framing_engine,trace.axes_engine,trace.watch_engine].filter(Boolean).join(' · ')||'non renseigné'}`,false,false,'687B94'),'',65))

  paras.push(wPara(wText('1. Besoin de veille',true),'Heading1',45))
  paras.push(wPara(wText(result?.need_original||''),'',65))
  ;(result?.clarifications||[]).forEach(a=>{paras.push(wPara(wText(a.question,true),'',20));paras.push(wPara(wText(a.answer),'',45))})

  if(result?.structure){
    paras.push(wPara(wText('2. Structuration retenue',true),'Heading1',45))
    paras.push(wPara(wText(result.structure.title||'',true),'',25))
    if(result.structure.logic)paras.push(wPara(wText(result.structure.logic),'',65))
  }

  paras.push(wPara(wText('3. Axes de veille',true),'Heading1',45))
  if(result?.axes?.length){
    result.axes.forEach(axis=>{
      paras.push(wPara(wText(axis.title||'',true),'Heading2',25))
      paras.push(wPara(wText(`Statut : ${axis.corpus_status||'à instruire'}`,true,false,'365D7D'),'',25))
      if(axis.objective)paras.push(wPara(wText(axis.objective),'',35))
      if(axis.why)paras.push(wPara(wText(`Pourquoi cet axe : ${axis.why}`),'',35))
      ;(axis.questions||[]).forEach(q=>paras.push(wPara(wText(`• ${q}`),'',20)))
      if(axis.corpus_contribution)paras.push(wPara(wText(`Ce que le corpus apporte : ${axis.corpus_contribution}`),'',25))
      if(axis.corpus_limit)paras.push(wPara(wText(`Limite documentaire : ${axis.corpus_limit}`,false,true,'8B4A4A'),'',30))
      addSourceParas(paras,axis.sources||[],links)
    })
  }else paras.push(wPara(wText('Aucun axe retenu.')))

  paras.push(wPara(wText('4. Objets de la veille',true),'Heading1',45))
  if(result?.watch?.length){
    result.watch.forEach(axis=>{
      paras.push(wPara(wText(axis.axis_title||'Axe',true),'Heading2',30))
      if(axis.trends?.length){
        paras.push(wPara(wText('Tendances documentées',true),'',25))
        axis.trends.forEach(item=>{paras.push(wPara(wText(`• ${item.label}`,true),'',20));if(item.synthese)paras.push(wPara(wText(item.synthese),'',20));if(item.limite)paras.push(wPara(wText(`Limite : ${item.limite}`,false,true,'8B4A4A'),'',25));addSourceParas(paras,item.sources||[],links)})
      }
      if(axis.watch_signs?.length){
        paras.push(wPara(wText('Signes de changement à guetter',true),'',25))
        axis.watch_signs.forEach(item=>{paras.push(wPara(wText(`• ${item.label}`,true),'',15));addSourceParas(paras,item.sources||[],links)})
      }
      if(axis.sources_to_watch?.length){
        paras.push(wPara(wText('Sources à surveiller',true),'',25))
        axis.sources_to_watch.forEach(item=>{paras.push(wPara(wText(`• ${item.label}`,true),'',15));if(item.raison)paras.push(wPara(wText(item.raison),'',15));addSourceParas(paras,item.sources||[],links)})
      }
    })
  }else paras.push(wPara(wText('Aucun objet de veille retenu.')))

  if(result?.methodology){
    paras.push(wPara(wText('Repère méthodologique — enrichissement contrôlé',true),'Heading1',45))
    paras.push(wPara(wText(result.methodology.label||''),'',25))
    if(result.methodology.usage)paras.push(wPara(wText(result.methodology.usage),'',25))
    if(result.methodology.url){const rId=`rId${links.length+1}`;links.push({rId,url:result.methodology.url});paras.push(wPara(wHyperlink('Ouvrir la ressource',rId),'',35))}
  }

  const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${paras.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`
  const documentRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${links.map(l=>`<Relationship Id="${l.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(l.url)}" TargetMode="External"/>`).join('')}</Relationships>`
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:color w:val="102A56"/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:color w:val="16345D"/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:color w:val="234F7D"/><w:sz w:val="24"/></w:rPr></w:style></w:styles>`
  const core=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Scénario de veille Quiritès Veille Lab</dc:title><dc:creator>Quiritès Veille Lab</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`
  const app=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Quiritès Veille Lab</Application></Properties>`
  const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`
  const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`
  return buildZip({'[Content_Types].xml':contentTypes,'_rels/.rels':rootRels,'docProps/core.xml':core,'docProps/app.xml':app,'word/document.xml':documentXml,'word/styles.xml':styles,'word/_rels/document.xml.rels':documentRels})
}

function colName(n){let s='',x=n;while(x>0){x--;s=String.fromCharCode(65+(x%26))+s;x=Math.floor(x/26)}return s}
function xCell(ref,value,style=''){return `<c r="${ref}" t="inlineStr"${style?` s="${style}"`:''}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`}
export function buildScenarioXlsx(result){
  const headers=['besoin','categorie','axe','origine','statut','element','description','pourquoi','limite_ou_invalidation','publication_id','titre_publication','organisme','annee','repere','provenance','url_source']
  const rows=[]
  const add=(category,axis,origin,status,item,source={})=>{const s=normSource(source);rows.push([result?.need_original||'',category,axis||'',origin||'',status||'',item.title||item.label||'',item.description||item.objective||item.synthese||item.interpretation||item.pourquoi_guetter||'',item.why||item.raison||'',item.limit||item.limite||item.ce_qui_invaliderait||item.ce_qui_affaiblirait||'',s.publication_id,s.title,s.organisation,s.year,s.locator,s.provenance,sourceUrl(s)])}
  ;(result?.clarifications||[]).forEach(a=>rows.push([result?.need_original||'','Précision utilisateur','','utilisateur','','',a.answer,a.question,'','','','','','','','']))
  ;(result?.axes||[]).forEach(axis=>{const sources=axis.sources?.length?axis.sources:[{}];sources.forEach(s=>add('Axe de veille',axis.title,axis.origin||'proposition_ia',axis.corpus_status,axis,s));(axis.questions||[]).forEach(q=>add('Question de veille',axis.title,'proposition_ia',axis.corpus_status,{title:q},{}))})
  ;(result?.watch||[]).forEach(axis=>{
    ;(axis.trends||[]).forEach(i=>(i.sources?.length?i.sources:[{}]).forEach(s=>add('Tendance documentée',axis.axis_title,'corpus','documente',i,s)))
    ;(axis.watch_signs||[]).forEach(i=>(i.sources?.length?i.sources:[{}]).forEach(s=>add('Signe de changement à guetter',axis.axis_title,'proposition_ia','à valider',i,s)))
    ;(axis.sources_to_watch||[]).forEach(i=>(i.sources?.length?i.sources:[{}]).forEach(s=>add('Source à surveiller',axis.axis_title,i.origin||'proposition_ia','retenue',i,s)))
  })
  if(result?.methodology)add('Repère méthodologique','','enrichissement_controle','', {title:result.methodology.label,description:result.methodology.usage}, {url:result.methodology.url})
  const xmlRows=[`<row r="1">${headers.map((h,i)=>xCell(`${colName(i+1)}1`,h,'1')).join('')}</row>`]
  rows.forEach((row,ri)=>{const n=ri+2;xmlRows.push(`<row r="${n}">${row.map((v,i)=>xCell(`${colName(i+1)}${n}`,v,'2')).join('')}</row>`)})
  const widths=[46,26,38,24,22,50,68,62,62,16,48,30,12,18,14,48],cols=widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${xmlRows.join('')}</sheetData><autoFilter ref="A1:P${Math.max(rows.length+1,1)}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews></worksheet>`
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D63C7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
  const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Scenario" sheetId="1" r:id="rId1"/></sheets></workbook>`
  const workbookRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
  const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`
  const core=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Données du scénario de veille Quiritès</dc:title><dc:creator>Quiritès Veille Lab</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`
  const app=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Quiritès Veille Lab</Application></Properties>`
  const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`
  return buildZip({'[Content_Types].xml':contentTypes,'_rels/.rels':rootRels,'docProps/core.xml':core,'docProps/app.xml':app,'xl/workbook.xml':workbook,'xl/_rels/workbook.xml.rels':workbookRels,'xl/styles.xml':styles,'xl/worksheets/sheet1.xml':sheet})
}

export function exportScenarioWord(result){downloadBytes(buildScenarioDocx(result),`Scenario_de_veille_${sanitizeFilename(result?.need_original)}_${today()}.docx`,'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
export function exportScenarioExcel(result){downloadBytes(buildScenarioXlsx(result),`Scenario_de_veille_donnees_${sanitizeFilename(result?.need_original)}_${today()}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
