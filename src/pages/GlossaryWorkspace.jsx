import React, { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { generateTreatment } from '../services/treatmentApi.js'
import { exportGlossaryWord, exportGlossaryExcel } from '../utils/glossaryExport.js'
import './glossary-workspace.css'

const MAX_SOURCES = 4

function sourceHref(source){
  const raw=String(source?.url||'').trim()
  if(!raw)return ''
  const repere=String(source?.repere||'').trim()
  if(/\.pdf(?:$|[?#])/i.test(raw)&&/^\d+$/.test(repere)){
    const base=raw.split('#')[0]
    return `${base}#page=${repere}`
  }
  return raw
}

function statusLabel(status){
  if(status==='definition_source')return 'Défini dans la source'
  if(status==='insuffisamment_defini')return 'Définition insuffisante dans le corpus'
  return 'Sens précisé à partir du contexte'
}

function statusClass(status){
  if(status==='definition_source')return 'source'
  if(status==='insuffisamment_defini')return 'limited'
  return 'context'
}

export default function GlossaryWorkspace({treatment,data,onBack}){
  const publications=useMemo(()=>(data?.publications||[]).filter(p=>(p.chunk_count||0)>0),[data])
  const [selected,setSelected]=useState([])
  const [pubSearch,setPubSearch]=useState('')
  const [angle,setAngle]=useState('')
  const [result,setResult]=useState(null)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [termSearch,setTermSearch]=useState('')

  const visiblePubs=useMemo(()=>{
    const q=pubSearch.trim().toLowerCase()
    if(!q)return publications
    return publications.filter(p=>`${p.publication_id} ${p.titre||''} ${p.organisme_producteur||''}`.toLowerCase().includes(q))
  },[publications,pubSearch])

  const selectedPubs=useMemo(()=>publications.filter(p=>selected.includes(p.publication_id)),[publications,selected])
  const entries=useMemo(()=>{
    const list=result?.output?.entries||[]
    const q=termSearch.trim().toLowerCase()
    if(!q)return list
    return list.filter(e=>`${e.terme||''} ${e.explicitation||''}`.toLowerCase().includes(q))
  },[result,termSearch])

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
    setLoading(true);setError('');setResult(null);setTermSearch('')
    try{
      const generated=await generateTreatment({
        treatment,
        need:angle.trim()||'Identifier et expliciter le vocabulaire spécialisé présent dans les publications sélectionnées.',
        publications:selectedPubs,
        contents:data.contents,
        nodes:data.nodes,
        relations:data.relations
      })
      setResult(generated)
    }catch(e){setError(e?.message||String(e))}finally{setLoading(false)}
  }

  return <main className="page qvl-glossary">
    <button className="back-link" onClick={onBack}><Icon name="back"/>Retour à l’atelier</button>

    <header className="qvl-glossary-head">
      <div>
        <div className="qvl-glossary-title-row"><span className="qvl-glossary-icon"><Icon name="book" size={28}/></span><h1>Glossaire</h1></div>
        <p>Identifiez et explicitez le vocabulaire spécialisé réellement présent dans une ou plusieurs publications.</p>
      </div>
      <span className="qvl-glossary-regime">Extraction stricte</span>
    </header>

    <section className="qvl-glossary-controls">
      <div className="qvl-glossary-source-picker">
        <div className="qvl-section-title"><div><strong>1. Choisir les publications</strong><span>{selected.length} / {MAX_SOURCES} sélectionnée{selected.length>1?'s':''}</span></div><small>Une à quatre sources</small></div>
        <div className="qvl-glossary-search"><Icon name="search" size={18}/><input value={pubSearch} onChange={e=>setPubSearch(e.target.value)} placeholder="Rechercher une publication…"/></div>
        <div className="qvl-glossary-pub-list">
          {visiblePubs.map(pub=><label key={pub.publication_id} className={`qvl-glossary-pub ${selected.includes(pub.publication_id)?'selected':''} ${!selected.includes(pub.publication_id)&&selected.length>=MAX_SOURCES?'disabled':''}`}>
            <input type="checkbox" checked={selected.includes(pub.publication_id)} disabled={!selected.includes(pub.publication_id)&&selected.length>=MAX_SOURCES} onChange={()=>toggle(pub.publication_id)}/>
            <div><b>{pub.publication_id}</b><strong>{pub.titre}</strong><span>{pub.organisme_producteur} · {pub.année_publication}</span></div>
          </label>)}
        </div>
      </div>

      <div className="qvl-glossary-runbox">
        <div className="qvl-section-title"><div><strong>2. Générer le glossaire</strong><span>Le corpus seul est utilisé</span></div></div>
        <label className="qvl-glossary-angle">Angle facultatif
          <input value={angle} onChange={e=>{setAngle(e.target.value);setError('')}} placeholder="Ex. cybercriminalité, sécurité civile, politique de la ville…"/>
        </label>
        <p className="qvl-glossary-helper">Sans angle, le moteur repère le vocabulaire spécialisé dans l’ensemble des publications sélectionnées. Il n’ajoute aucune définition extérieure au corpus.</p>
        <button className="qvl-glossary-generate" disabled={!selectedPubs.length||loading} onClick={run}>
          <Icon name="spark" size={19}/>{loading?'Analyse en cours…':'Générer le glossaire'}
        </button>
        {error&&<div className="qvl-glossary-error"><Icon name="warning" size={18}/><span>{error}</span></div>}
      </div>
    </section>

    <section className="qvl-glossary-results">
      <div className="qvl-glossary-results-head">
        <div><h2>Vocabulaire identifié</h2><p>{result?`${result?.selection?.termes_retenus||0} terme${(result?.selection?.termes_retenus||0)>1?'s':''} retenu${(result?.selection?.termes_retenus||0)>1?'s':''} · ${result?.selection?.publications||result?.corpus?.length||0} publication${(result?.selection?.publications||result?.corpus?.length||0)>1?'s':''} mobilisée${(result?.selection?.publications||result?.corpus?.length||0)>1?'s':''}.`:'Le glossaire apparaîtra ici.'}</p></div>
        {result&&<div className="qvl-glossary-head-actions">
          <div className="qvl-glossary-export-actions" aria-label="Exporter le glossaire">
            <button type="button" className="qvl-export-btn word" onClick={()=>exportGlossaryWord(result)}><Icon name="file" size={17}/>Exporter Word</button>
            <button type="button" className="qvl-export-btn data" onClick={()=>exportGlossaryExcel(result)}><Icon name="layers" size={17}/>Exporter les données</button>
          </div>
          <div className="qvl-term-filter"><Icon name="search" size={17}/><input value={termSearch} onChange={e=>setTermSearch(e.target.value)} placeholder="Filtrer les termes…"/></div>
        </div>}
      </div>

      {!result&&!loading&&<div className="qvl-glossary-empty"><span><Icon name="book" size={34}/></span><strong>Un glossaire sourcé, pas un dictionnaire générique</strong><p>Chaque terme est relié aux passages qui permettent de le définir ou de l’expliciter dans le contexte des publications choisies.</p></div>}
      {loading&&<div className="qvl-glossary-loading"><span className="qvl-spinner"/><strong>Le vocabulaire spécialisé est en cours d’extraction et de vérification…</strong><p>Les termes sont contrôlés par rapport aux passages sources avant affichage.</p></div>}
      {result&&!entries.length&&<div className="qvl-glossary-empty"><strong>Aucun terme ne correspond au filtre.</strong></div>}

      <div className="qvl-term-list">
        {entries.map((entry,index)=><article className="qvl-term-card" key={`${entry.terme}-${index}`}>
          <div className="qvl-term-top"><div><h3>{entry.terme}</h3><span className={`qvl-term-status ${statusClass(entry.statut)}`}>{statusLabel(entry.statut)}</span></div><span className="qvl-term-index">{String(index+1).padStart(2,'0')}</span></div>
          <p className="qvl-term-definition">{entry.explicitation}</p>
          <div className="qvl-term-sources">
            <strong>Provenance</strong>
            {(entry.sources||[]).map((source,i)=>{
              const href=sourceHref(source)
              return <div className="qvl-term-source" key={`${source.chunk_id}-${i}`}>
                <div className="qvl-source-main"><span className="qvl-source-id">{source.chunk_id}</span><div><b>{source.titre||source.publication_id}</b><span>{source.organisme_producteur}{source.annee_publication?` · ${source.annee_publication}`:''}{source.repere?` · repère ${source.repere}`:' · repère indisponible'}</span></div></div>
                <div className="qvl-source-actions">{href&&<a href={href} target="_blank" rel="noreferrer"><Icon name="external" size={15}/>Ouvrir la source</a>}<details><summary>Voir l’extrait</summary><p>{source.extrait}</p></details></div>
              </div>
            })}
          </div>
        </article>)}
      </div>
    </section>
  </main>
}
