import React, { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { analyzeScenarioV2Axes, analyzeScenarioV2AxisObjects } from '../services/reflectionApi.js'
import { exportScenarioWord } from '../utils/scenarioExport.js'
import './scenario-workspace.css'

const STEPS=[
  {id:1,label:'Formuler le besoin'},
  {id:2,label:'Axes issus du corpus'},
  {id:3,label:'Objets de la veille'},
  {id:4,label:'Finaliser'},
]

const clip=(v,max=900)=>{const s=String(v||'').replace(/\s+/g,' ').trim();return s.length<=max?s:`${s.slice(0,max).replace(/\s+\S*$/,'')}…`}
const cleanVisibleText=(v='')=>String(v||'')
  .replace(/\bM\d+\b(?:\s*(?:,|et|ou)\s*M\d+\b)*/gi,'les matériaux retenus')
  .replace(/les matériaux\s+les matériaux retenus/gi,'les matériaux retenus')
  .replace(/\s+/g,' ').trim()

function formatRepere(value=''){
  const raw=String(value||'').trim(); if(!raw)return''
  if(/^\d+\s*[;,]\s*\d+$/.test(raw)){const[a,b]=raw.split(/[;,]/).map(x=>x.trim());return a===b?`p. ${a}`:`p. ${a}–${b}`}
  if(/^\d+\s*[-–]\s*\d+$/.test(raw)){const[a,b]=raw.split(/[-–]/).map(x=>x.trim());return a===b?`p. ${a}`:`p. ${a}–${b}`}
  if(/^\d+$/.test(raw))return `p. ${raw}`
  return `repère ${raw}`
}
function sourceUrl(s={}){
  const raw=String(s.url||'').trim(); if(!raw)return''
  const rep=String(s.repere||'').trim(); const first=(rep.match(/\d+/)||[])[0]
  if(/\.pdf(?:$|[?#])/i.test(raw)&&first)return `${raw.split('#')[0]}#page=${first}`
  return raw
}
function isTableMaterial(s={}){
  const t=String(s.extrait||'').trim(); if(!t)return false
  const pipes=(t.match(/\|/g)||[]).length, compact=t.replace(/\s+/g,'')
  return pipes>=8 && pipes/Math.max(compact.length,1)>0.025
}
function SourceProof({source,compact=false}){
  const href=sourceUrl(source), rep=formatRepere(source.repere), table=isTableMaterial(source)
  const ref=[source.publication_id,rep].filter(Boolean).join(' · ')||'Source du corpus'
  return <div className={`qvl-t06-source ${compact?'compact':''}`}>
    <div className="qvl-t06-source-main">
      <strong>{ref}</strong>
      {source.titre&&<small>{source.titre}</small>}
      {!compact&&!table&&source.extrait&&<details className="qvl-t06-proof"><summary>Voir la preuve et la provenance</summary><div className="qvl-t06-proof-box"><b>Synthèse du passage indexé</b><p>« {clip(source.extrait)} »</p>{source.raison_pertinence&&<p className="qvl-t06-why"><b>Pourquoi ce matériau a été retenu :</b> {cleanVisibleText(source.raison_pertinence)}</p>}</div></details>}
    </div>
    {table?(
      href?<a className="qvl-t06-source-link" href={href} target="_blank" rel="noreferrer">Voir le tableau — {rep||'page indiquée'} ↗</a>:<span className="qvl-t06-source-link disabled">Tableau — {rep||'page indiquée'}</span>
    ):(href?<a className="qvl-t06-source-link" href={href} target="_blank" rel="noreferrer">Ouvrir la source ↗</a>:null)}
  </div>
}

function ObjectCard({item,type}){
  const description= type==='trend'?item.synthese : type==='watch'?item.pourquoi_guetter : item.raison
  return <article className="qvl-t06-object-card">
    <strong>{item.label}</strong>
    {description&&<p>{cleanVisibleText(description)}</p>}
    {type==='trend'&&item.limite&&<p className="qvl-t06-limit"><b>Limite :</b> {cleanVisibleText(item.limite)}</p>}
    {(item.sources||[]).map((s,i)=><SourceProof key={`${s.material_id||s.publication_id||i}-${i}`} source={s} compact/>)}
  </article>
}

export default function ScenarioWorkspace({initialNeed='',onBack}){
  const[step,setStep]=useState(1),[need,setNeed]=useState(initialNeed||''),[anchor,setAnchor]=useState(null),[axes,setAxes]=useState([]),[objects,setObjects]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState('')
  const selectedAxes=useMemo(()=>axes.filter(a=>a.selected),[axes])

  async function buildAxes(){
    const value=need.trim(); if(!value){setError('Saisissez d’abord votre besoin de veille.');return}
    setError('');setLoading(true);setObjects([])
    try{const r=await analyzeScenarioV2Axes(value);setAnchor(r);setAxes((r.axes||[]).map(a=>({...a,selected:true})));setStep(2)}
    catch(e){setError(e.message||String(e))}finally{setLoading(false)}
  }
  async function buildObjects(){
    if(!selectedAxes.length){setError('Sélectionnez au moins un axe.');return}
    setError('');setLoading(true)
    try{const rows=[];for(const axis of selectedAxes){rows.push(await analyzeScenarioV2AxisObjects(need,anchor?.subject_query||'',axis))}setObjects(rows);setStep(3)}
    catch(e){setError(e.message||String(e))}finally{setLoading(false)}
  }
  function exportWord(){exportScenarioWord({need,subject_query:anchor?.subject_query||'',axes:selectedAxes,objects})}

  return <main className="page qvl-t06-page">
    <div className="qvl-t06-topline"><button className="qvl-t06-back" onClick={onBack}>← Atelier de veille</button><span>Scénario de veille</span></div>
    <section className="qvl-t06-hero"><div><span className="qvl-t06-kicker">ATELIER DE VEILLE</span><h1>Construire un scénario de veille avec le corpus</h1><p>Le corpus est filtré avant la proposition des axes. Chaque résultat conserve une provenance vérifiable.</p></div><div className="qvl-t06-hero-mark">Corpus → axes → objets sourcés</div></section>

    <nav className="qvl-t06-steps">{STEPS.map(s=><button key={s.id} className={`${step===s.id?'active':''} ${step>s.id?'done':''}`} onClick={()=>s.id<step&&setStep(s.id)}><b>{s.id}</b><span>{s.label}</span></button>)}</nav>
    {error&&<div className="qvl-t06-alert">{error}</div>}
    {loading&&<div className="qvl-t06-loading"><span/><div><b>Traitement en cours…</b><small>Le corpus est interrogé et filtré. Une absence de résultat reste une réponse possible.</small></div></div>}

    {step===1&&<section className="qvl-t06-panel">
      <div className="qvl-t06-section-head"><div><h2>1. Formuler le besoin</h2><p>Une phrase suffit. Les axes seront proposés uniquement à partir des matériaux validés du corpus.</p></div><span className="qvl-t06-pill">Votre besoin</span></div>
      <label>Votre besoin de veille</label><textarea value={need} onChange={e=>setNeed(e.target.value)} maxLength={1800} placeholder="Ex. Je veux faire une veille sur l’évolution des menaces en matière de cybercriminalité"/>
      <div className="qvl-t06-actions"><button className="primary" onClick={buildAxes} disabled={loading}>Chercher dans le corpus et faire émerger les axes →</button></div>
      <p className="qvl-t06-principle"><Icon name="info" size={15}/> Aucun axe n’est affiché sans appui documentaire. Une case vide n’est jamais remplie artificiellement.</p>
    </section>}

    {step===2&&<section className="qvl-t06-panel">
      <div className="qvl-t06-section-head"><div><h2>2. Choisir des axes de veille</h2><p>Les axes ci-dessous émergent des seuls matériaux jugés pertinents pour votre besoin.</p></div><span className="qvl-t06-pill corpus">Corpus d’abord</span></div>
      <div className="qvl-t06-need"><b>Besoin</b><span>{need}</span></div>
      <div className="qvl-t06-metrics"><div><strong>{anchor?.diagnostic?.candidats_evalues??0}</strong><small>matériaux évalués</small></div><div><strong>{anchor?.diagnostic?.materiaux_valides??0}</strong><small>matériaux pertinents</small></div><div><strong>{anchor?.diagnostic?.publications_validees??0}</strong><small>publications pertinentes</small></div></div>
      {!axes.length&&<div className="qvl-t06-empty-wide"><b>Aucun axe suffisamment fondé n’a été produit.</b><p>{anchor?.message||'Le corpus a retrouvé des matériaux pertinents, mais ils ne suffisent pas encore à fonder un axe de veille conforme aux règles du prototype.'}</p></div>}
      {/* CARTES D’ABORD : les matériaux détaillés viennent ensuite. */}
      <div className="qvl-t06-axis-grid">{axes.map((a,i)=><article key={a.axis_id||i} className={`qvl-t06-axis ${a.selected?'selected':''}`}>
        <div className="qvl-t06-axis-head"><button className="qvl-t06-check" onClick={()=>setAxes(v=>v.map((x,j)=>j===i?{...x,selected:!x.selected}:x))}>{a.selected?'✓':'○'}</button><h3>{a.titre}</h3><span>{a.publication_count||0} publication{a.publication_count>1?'s':''}</span></div>
        {a.objectif_surveillance&&<p>{a.objectif_surveillance}</p>}{a.question_veille&&<p><b>Question :</b> {a.question_veille}</p>}{a.justification&&<p className="qvl-t06-foundation"><b>Fondement :</b> {cleanVisibleText(a.justification)}</p>}
        {a.statut_documentaire==='appui_publication_unique'&&<p className="qvl-t06-limit"><b>Limite :</b> axe appuyé sur une seule publication.</p>}
        {!!a.sources?.length&&<details><summary>Matériaux qui fondent cet axe ({a.sources.length})</summary>{a.sources.map((s,k)=><SourceProof key={k} source={s}/>)}</details>}
      </article>)}</div>
      {!!anchor?.materiaux_valides?.length&&<details className="qvl-t06-relevant"><summary>Voir les matériaux jugés pertinents ({anchor.materiaux_valides.length})</summary><div className="qvl-t06-relevant-list">{anchor.materiaux_valides.map((s,k)=><SourceProof key={`${s.material_id||s.publication_id||k}-${k}`} source={s}/>)}</div></details>}
      {!!anchor?.materiaux_ecartes?.length&&<details className="qvl-t06-audit"><summary>Matériaux écartés par le filtre ({anchor.materiaux_ecartes.length})</summary>{anchor.materiaux_ecartes.map((s,i)=><div className="qvl-t06-audit-row" key={i}><b>{[s.publication_id,formatRepere(s.repere)].filter(Boolean).join(' · ')}</b><span>{s.titre}</span><small>{s.raison||s.motif}</small></div>)}</details>}
      <div className="qvl-t06-actions split"><button onClick={()=>setStep(1)}>← Modifier le besoin</button><button className="primary" onClick={buildObjects} disabled={loading||!selectedAxes.length}>Construire les objets des axes retenus →</button></div>
    </section>}

    {step===3&&<><section className="qvl-t06-panel compact"><div className="qvl-t06-section-head"><div><h2>3. Objets de la veille</h2><p>Les preuves restent accessibles à la demande. Le résultat de veille est affiché en premier.</p></div><span className="qvl-t06-pill ai">Synthèse sourcée</span></div><div className="qvl-t06-need"><b>Besoin</b><span>{need}</span></div></section>
      {objects.map((o,i)=><section className="qvl-t06-axis-result" key={o.axis_id||i}>
        <div className="qvl-t06-result-head"><span>Axe {i+1}</span><h3>{o.titre}</h3>{o.objectif_surveillance&&<p>{o.objectif_surveillance}</p>}</div>
        {o.statut!=='ok'?<div className="qvl-t06-empty-wide">{o.message||'Aucun objet suffisamment sourcé.'}</div>:<div className="qvl-t06-object-grid">
          <div className="qvl-t06-object-col trend"><h4>▤ Tendances documentées</h4>{o.tendances?.length?o.tendances.map((x,k)=><ObjectCard key={k} item={x} type="trend"/>):<div className="qvl-t06-empty"><b>Aucune tendance</b><p>Une tendance exige au moins deux publications convergentes.</p></div>}</div>
          <div className="qvl-t06-object-col watch"><h4>◎ Éléments à surveiller</h4>{o.signes_a_guetter?.length?o.signes_a_guetter.map((x,k)=><ObjectCard key={k} item={x} type="watch"/>):<div className="qvl-t06-empty"><b>Aucun élément suffisamment sourcé</b></div>}</div>
          <div className="qvl-t06-object-col source"><h4>↗ Sources à surveiller</h4>{o.sources_a_surveiller?.length?o.sources_a_surveiller.map((x,k)=><ObjectCard key={k} item={x} type="source"/>):<div className="qvl-t06-empty"><b>Aucune source récurrente identifiée</b><p>Le corpus ne permet pas d’établir une source suivable dans le temps.</p></div>}</div>
        </div>}
        {!!o.angles_morts?.length&&<div className="qvl-t06-points"><b>Points à documenter</b><ul>{o.angles_morts.map((x,k)=><li key={k}>{cleanVisibleText(x)}</li>)}</ul></div>}
      </section>)}
      <div className="qvl-t06-panel qvl-t06-actions split"><button onClick={()=>setStep(2)}>← Revenir aux axes</button><button className="primary" onClick={()=>setStep(4)}>Prévisualiser le scénario →</button></div>
    </>}

    {step===4&&<section className="qvl-t06-panel">
      <div className="qvl-t06-section-head"><div><h2>4. Finaliser</h2><p>Le scénario reprend uniquement les axes retenus et les objets validés. Aucun nouvel appel IA.</p></div><span className="qvl-t06-pill">Prêt à exporter</span></div>
      <div className="qvl-t06-final-cover"><span>SCÉNARIO DE VEILLE</span><h3>{need}</h3><small>{new Intl.DateTimeFormat('fr-FR',{dateStyle:'long'}).format(new Date())}</small></div>
      {objects.map((o,i)=><article className="qvl-t06-final-axis" key={o.axis_id||i}><div><span>Axe {i+1}</span><h3>{o.titre}</h3><p>{o.objectif_surveillance}</p></div><div className="qvl-t06-final-groups">
        <div><h4>Tendances documentées</h4>{o.tendances?.length?o.tendances.map((x,k)=><div className="qvl-t06-final-item" key={k}><b>{x.label}</b><p>{x.synthese}</p>{(x.sources||[]).map((s,j)=><SourceProof key={j} source={s} compact/>)}</div>):<em>Aucune tendance suffisamment documentée.</em>}</div>
        <div><h4>Éléments à surveiller</h4>{o.signes_a_guetter?.length?o.signes_a_guetter.map((x,k)=><div className="qvl-t06-final-item" key={k}><b>{x.label}</b><p>{x.pourquoi_guetter}</p>{(x.sources||[]).map((s,j)=><SourceProof key={j} source={s} compact/>)}</div>):<em>Aucun élément suffisamment sourcé.</em>}</div>
        <div><h4>Sources à surveiller</h4>{o.sources_a_surveiller?.length?o.sources_a_surveiller.map((x,k)=><div className="qvl-t06-final-item" key={k}><b>{x.label}</b><p>{x.raison}</p>{(x.sources||[]).map((s,j)=><SourceProof key={j} source={s} compact/>)}</div>):<em>Aucune source récurrente identifiée.</em>}</div>
      </div>{!!o.angles_morts?.length&&<div className="qvl-t06-points"><b>Points à documenter</b><ul>{o.angles_morts.map((x,k)=><li key={k}>{cleanVisibleText(x)}</li>)}</ul></div>}</article>)}
      <div className="qvl-t06-actions split"><button onClick={()=>setStep(3)}>← Revenir aux objets</button><button className="primary word" onClick={exportWord}>Télécharger le scénario (.docx)</button></div>
    </section>}
  </main>
}
