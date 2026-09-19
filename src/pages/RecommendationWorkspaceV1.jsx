import React, { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { generateTreatment } from '../services/treatmentApi.js'
import { exportRecommendationsWord, exportRecommendationsExcel } from '../utils/recommendationExport.js'
import './recommendation-workspace.css'

const MAX_SOURCES = 4

function sourceHref(source){
  const raw=String(source?.url||'').trim()
  if(!raw)return ''
  const repere=String(source?.repere||'').trim()
  if(/\.pdf(?:$|[?#])/i.test(raw)&&/^\d+$/.test(repere)){
    return `${raw.split('#')[0]}#page=${repere}`
  }
  return raw
}

function typeLabel(type){
  if(type==='preconisation')return 'Préconisation'
  if(type==='proposition')return 'Proposition'
  if(type==='orientation')return 'Orientation'
  return 'Recommandation'
}

function typeClass(type){
  if(type==='preconisation')return 'preconisation'
  if(type==='proposition')return 'proposition'
  if(type==='orientation')return 'orientation'
  return 'recommandation'
}

export default function RecommendationWorkspaceV1({treatment,data,onBack}){
  const publications=useMemo(()=>(data?.publications||[]).filter(p=>(p.chunk_count||0)>0),[data])
  const [selected,setSelected]=useState([])
  const [pubSearch,setPubSearch]=useState('')
  const [angle,setAngle]=useState('')
  const [result,setResult]=useState(null)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [resultSearch,setResultSearch]=useState('')
  const [typeFilter,setTypeFilter]=useState('all')

  const visiblePubs=useMemo(()=>{
    const q=pubSearch.trim().toLowerCase()
    if(!q)return publications
    return publications.filter(p=>`${p.publication_id} ${p.titre||''} ${p.organisme_producteur||''}`.toLowerCase().includes(q))
  },[publications,pubSearch])

  const selectedPubs=useMemo(()=>publications.filter(p=>selected.includes(p.publication_id)),[publications,selected])
  const allRecommendations=result?.output?.recommendations||[]
  const recommendations=useMemo(()=>{
    let list=allRecommendations
    if(typeFilter!=='all')list=list.filter(r=>r.type_prescription===typeFilter)
    const q=resultSearch.trim().toLowerCase()
    if(q)list=list.filter(r=>`${r.formulation||''} ${r.objet||''} ${r.formulateur||''} ${r.destinataire||''} ${r.conditions_modalites||''}`.toLowerCase().includes(q))
    return list
  },[allRecommendations,typeFilter,resultSearch])

  const toggle=id=>{
    setError('');setResult(null)
    setSelected(prev=>{
      if(prev.includes(id))return prev.filter(x=>x!==id)
      if(prev.length>=MAX_SOURCES)return prev
      return [...prev,id]
    })
  }

  const run=async()=>{
    if(!selectedPubs.length||loading)return
    setLoading(true);setError('');setResult(null);setResultSearch('');setTypeFilter('all')
    try{
      const generated=await generateTreatment({
        treatment,
        need:angle.trim()||'Extraire les recommandations, préconisations, propositions et orientations explicitement formulées dans les publications sélectionnées.',
        publications:selectedPubs,
        contents:data.contents,
        nodes:data.nodes,
        relations:data.relations
      })
      setResult(generated)
    }catch(e){setError(e?.message||String(e))}finally{setLoading(false)}
  }

  const counts=useMemo(()=>{
    const out={all:allRecommendations.length,recommandation:0,preconisation:0,proposition:0,orientation:0}
    allRecommendations.forEach(r=>{if(out[r.type_prescription]!==undefined)out[r.type_prescription]+=1})
    return out
  },[allRecommendations])

  return <main className="page qvl-recommendations-v1">
    <button className="back-link" onClick={onBack}><Icon name="back"/>Retour à l’atelier</button>

    <header className="qvl-rec-head">
      <div>
        <div className="qvl-rec-title-row"><span className="qvl-rec-icon"><Icon name="spark" size={28}/></span><h1>Extraction de recommandations</h1></div>
        <p>Repérez uniquement les recommandations, préconisations, propositions et orientations explicitement formulées dans une ou plusieurs publications.</p>
      </div>
      <span className="qvl-rec-regime">Extraction stricte</span>
    </header>

    <section className="qvl-rec-controls">
      <div className="qvl-rec-source-picker">
        <div className="qvl-rec-section-title"><div><strong>1. Choisir les publications</strong><span>{selected.length} / {MAX_SOURCES} sélectionnée{selected.length>1?'s':''}</span></div><small>Une à quatre sources</small></div>
        <div className="qvl-rec-search"><Icon name="search" size={18}/><input value={pubSearch} onChange={e=>setPubSearch(e.target.value)} placeholder="Rechercher une publication…"/></div>
        <div className="qvl-rec-pub-list">
          {visiblePubs.map(pub=><label key={pub.publication_id} className={`qvl-rec-pub ${selected.includes(pub.publication_id)?'selected':''} ${!selected.includes(pub.publication_id)&&selected.length>=MAX_SOURCES?'disabled':''}`}>
            <input type="checkbox" checked={selected.includes(pub.publication_id)} disabled={!selected.includes(pub.publication_id)&&selected.length>=MAX_SOURCES} onChange={()=>toggle(pub.publication_id)}/>
            <div><b>{pub.publication_id}</b><strong>{pub.titre}</strong><span>{pub.organisme_producteur} · {pub.année_publication}</span></div>
          </label>)}
        </div>
      </div>

      <div className="qvl-rec-runbox">
        <div className="qvl-rec-section-title"><div><strong>2. Extraire les recommandations</strong><span>Le corpus seul est utilisé</span></div></div>
        <label className="qvl-rec-angle">Angle facultatif
          <input value={angle} onChange={e=>{setAngle(e.target.value);setError('')}} placeholder="Ex. recommandations relatives aux ports, à la prévention, à la coordination…"/>
        </label>
        <p className="qvl-rec-helper">Sans angle, le moteur recherche toutes les prescriptions explicites des publications sélectionnées. Un constat, une analyse ou un besoin observé n’est jamais transformé en recommandation.</p>
        <button className="qvl-rec-generate" disabled={!selectedPubs.length||loading} onClick={run}>
          <Icon name="spark" size={19}/>{loading?'Extraction en cours…':'Extraire les recommandations'}
        </button>
        {error&&<div className="qvl-rec-error"><Icon name="warning" size={18}/><span>{error}</span></div>}
      </div>
    </section>

    <section className="qvl-rec-results">
      <div className="qvl-rec-results-head">
        <div><h2>Recommandations identifiées</h2><p>{result?`${result?.selection?.recommandations_retenues||0} élément${(result?.selection?.recommandations_retenues||0)>1?'s':''} retenu${(result?.selection?.recommandations_retenues||0)>1?'s':''} · ${result?.selection?.publications||result?.corpus?.length||0} publication${(result?.selection?.publications||result?.corpus?.length||0)>1?'s':''} mobilisée${(result?.selection?.publications||result?.corpus?.length||0)>1?'s':''}.`:'L’extraction apparaîtra ici.'}</p></div>
        {result&&<div className="qvl-rec-head-actions">
          <div className="qvl-rec-export-actions" aria-label="Exporter les recommandations">
            <button type="button" className="qvl-rec-export-btn word" onClick={()=>exportRecommendationsWord(result)}><Icon name="file" size={17}/>Exporter Word</button>
            <button type="button" className="qvl-rec-export-btn data" onClick={()=>exportRecommendationsExcel(result)}><Icon name="layers" size={17}/>Exporter les données</button>
          </div>
          <div className="qvl-rec-filter-search"><Icon name="search" size={17}/><input value={resultSearch} onChange={e=>setResultSearch(e.target.value)} placeholder="Filtrer les résultats…"/></div>
        </div>}
      </div>

      {result&&<div className="qvl-rec-type-filters">
        {[
          ['all','Tous'],['recommandation','Recommandations'],['preconisation','Préconisations'],['proposition','Propositions'],['orientation','Orientations']
        ].map(([key,label])=><button key={key} className={typeFilter===key?'active':''} onClick={()=>setTypeFilter(key)}>{label}<span>{counts[key]||0}</span></button>)}
      </div>}

      {!result&&!loading&&<div className="qvl-rec-empty"><span><Icon name="spark" size={34}/></span><strong>Une extraction stricte, pas une production de recommandations</strong><p>Le traitement restitue seulement les prescriptions explicitement formulées dans les publications sélectionnées et conserve leur provenance.</p></div>}
      {loading&&<div className="qvl-rec-loading"><span className="qvl-rec-spinner"/><strong>Les recommandations sont en cours d’extraction et de vérification…</strong><p>Chaque élément est contrôlé afin d’éviter qu’un constat ou une analyse ne soit transformé en prescription.</p></div>}
      {result&&!allRecommendations.length&&<div className="qvl-rec-empty"><strong>Aucune recommandation explicite identifiée.</strong><p>Le moteur n’en produit pas lorsque les publications sélectionnées n’en formulent pas explicitement.</p></div>}
      {result&&allRecommendations.length>0&&!recommendations.length&&<div className="qvl-rec-empty"><strong>Aucun résultat ne correspond au filtre.</strong></div>}

      <div className="qvl-rec-list">
        {recommendations.map((rec,index)=><article className="qvl-rec-card" key={rec.recommendation_id||`${rec.formulation}-${index}`}>
          <div className="qvl-rec-card-top"><div><span className={`qvl-rec-type ${typeClass(rec.type_prescription)}`}>{typeLabel(rec.type_prescription)}</span><h3>{rec.formulation}</h3></div><span className="qvl-rec-index">{rec.recommendation_id||String(index+1).padStart(2,'0')}</span></div>
          {(rec.objet||rec.formulateur||rec.destinataire||rec.conditions_modalites)&&<dl className="qvl-rec-details">
            {rec.objet&&<><dt>Objet</dt><dd>{rec.objet}</dd></>}
            {rec.formulateur&&<><dt>Formulée par</dt><dd>{rec.formulateur}</dd></>}
            {rec.destinataire&&<><dt>S’adresse à</dt><dd>{rec.destinataire}</dd></>}
            {rec.conditions_modalites&&<><dt>Conditions / modalités</dt><dd>{rec.conditions_modalites}</dd></>}
          </dl>}
          <div className="qvl-rec-sources">
            <strong>Provenance</strong>
            {(rec.sources||[]).map((source,i)=>{
              const href=sourceHref(source)
              return <div className="qvl-rec-source" key={`${source.chunk_id}-${i}`}>
                <div className="qvl-rec-source-main"><span className="qvl-rec-source-id">{source.chunk_id}</span><div><b>{source.titre||source.publication_id}</b><span>{source.organisme_producteur}{source.annee_publication?` · ${source.annee_publication}`:''}{source.repere?` · repère ${source.repere}`:' · repère indisponible'}</span></div></div>
                <div className="qvl-rec-source-actions">{href&&<a href={href} target="_blank" rel="noreferrer"><Icon name="external" size={15}/>Ouvrir la source</a>}<details><summary>Voir l’extrait</summary><p>{source.extrait}</p></details></div>
              </div>
            })}
          </div>
        </article>)}
      </div>
    </section>
  </main>
}
