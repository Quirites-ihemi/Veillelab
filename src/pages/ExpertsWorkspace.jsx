import React, { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { searchExperts } from '../services/reflectionApi.js'
import { exportExpertsWord, exportExpertsExcel } from '../utils/expertExport.js'
import './experts-workspace.css'

function cleanAuthors(value){
  return String(value||'').split(/[;,]/).map(x=>x.trim()).filter(x=>x&&!/^PUB\d+\.png$/i.test(x))
}
function splitDomains(value){
  return String(value||'').split(/[;|,]/).map(x=>x.trim()).filter(Boolean)
}
function sourceUrl(pub, locator=''){
  const raw=String(pub?.url_contenu||pub?.url_source||'').trim()
  if(!raw)return''
  if(/\.pdf(?:$|[?#])/i.test(raw)&&/^\d+$/.test(String(locator||'').trim())) return `${raw.split('#')[0]}#page=${String(locator).trim()}`
  return raw
}
function resultExcerpt(result){
  if(result?.kind==='chunk') return String(result.text||'').trim()
  if(result?.kind==='node') return String(result.label||'').trim()
  if(result?.kind==='relation') return [result.source_label,result.relation_type,result.target_label].filter(Boolean).join(' — ')
  if(result?.kind==='expertise') return [result.label,result.definition].filter(Boolean).join(' — ')
  return ''
}
function normalizeText(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
}
function buildExperts(publications, searchResults=[]){
  const matchesByPub=new Map()
  for(const r of searchResults){
    if(!r?.publication_id)continue
    if(!matchesByPub.has(r.publication_id))matchesByPub.set(r.publication_id,[])
    matchesByPub.get(r.publication_id).push(r)
  }
  const map=new Map()
  for(const pub of publications){
    const names=cleanAuthors(pub.auteurs_MI)
    if(!names.length)continue
    for(const name of names){
      if(!map.has(name))map.set(name,{name,organisations:new Set(),domains:new Set(),publications:[],matches:[],score:0})
      const e=map.get(name)
      if(pub.organisme_producteur)e.organisations.add(pub.organisme_producteur)
      splitDomains(pub.domaine).forEach(d=>e.domains.add(d))
      e.publications.push(pub)
      const pubMatches=matchesByPub.get(pub.publication_id)||[]
      e.matches.push(...pubMatches)
      if(pubMatches.length){
        e.score+=Math.max(...pubMatches.map(r=>Number(r.score)||0))+Math.min(pubMatches.length,3)
      }
    }
  }
  return [...map.values()].map(e=>({
    ...e,
    organisations:[...e.organisations].sort((a,b)=>a.localeCompare(b,'fr')),
    domains:[...e.domains].sort((a,b)=>a.localeCompare(b,'fr')),
    publications:e.publications.sort((a,b)=>String(b.année_publication||'').localeCompare(String(a.année_publication||''))),
    matches:e.matches.sort((a,b)=>(Number(b.score)||0)-(Number(a.score)||0))
  }))
}

export default function ExpertsWorkspace({data,onBack}){
  const publications=useMemo(()=>data?.publications||[],[data])
  const allExperts=useMemo(()=>buildExperts(publications),[publications])
  const publicationCount=useMemo(()=>new Set(publications.filter(p=>cleanAuthors(p.auteurs_MI).length).map(p=>p.publication_id)).size,[publications])
  const organisations=useMemo(()=>[...new Set(allExperts.flatMap(e=>e.organisations))].sort((a,b)=>a.localeCompare(b,'fr')),[allExperts])
  const domains=useMemo(()=>[...new Set(allExperts.flatMap(e=>e.domains))].sort((a,b)=>a.localeCompare(b,'fr')),[allExperts])
  const [query,setQuery]=useState('')
  const [organisation,setOrganisation]=useState('')
  const [domain,setDomain]=useState('')
  const [results,setResults]=useState(null)
  const [selected,setSelected]=useState(null)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [searchMeta,setSearchMeta]=useState(null)

  const baseList=results??allExperts
  const filtered=useMemo(()=>{
    const list=baseList.filter(e=>(!organisation||e.organisations.includes(organisation))&&(!domain||e.domains.includes(domain)))
    return [...list].sort((a,b)=>results?(b.score-a.score||a.name.localeCompare(b.name,'fr')):a.name.localeCompare(b.name,'fr'))
  },[baseList,organisation,domain,results])

  const runSearch=async()=>{
    const q=query.trim()
    if(!q){setResults(null);setSelected(null);setSearchMeta(null);setError('');return}
    setLoading(true);setError('');setSearchMeta(null)
    try{
      const response=await searchExperts(q,{organisme:organisation,domaine:domain})
      const experts=(response.experts||[]).map(e=>({
        ...e,
        organisations:Array.isArray(e.organisations)?e.organisations:[],
        domains:Array.isArray(e.domains)?e.domains:[],
        publications:Array.isArray(e.publications)?e.publications:[],
        matches:Array.isArray(e.matches)?e.matches:[],
        score:(e.matches||[]).reduce((sum,m)=>sum+(Number(m.score)||0),0)
      }))
      setSearchMeta({status:response.status||'ok',message:response.message||'',selected_expertises:response.selected_expertises||[],stats:response.stats||{}})
      setResults(experts)
      setSelected(experts[0]||null)
    }catch(e){setError(e?.message||String(e));setSearchMeta(null);setResults([]);setSelected(null)}finally{setLoading(false)}
  }
  const reset=()=>{setQuery('');setOrganisation('');setDomain('');setResults(null);setSelected(null);setSearchMeta(null);setError('')}
  const activeExpert=selected&&filtered.some(e=>e.name===selected.name)?filtered.find(e=>e.name===selected.name):filtered[0]||null
  const exportPayload={query:query.trim(),experts:filtered,generated_at:new Date().toISOString(),method_note:'La recherche thématique est effectuée par le moteur dédié Experts ministériels à partir du référentiel fermé de micro-expertises validées. Une signature ou une simple proximité lexicale ne suffit pas à qualifier un expert sur le sujet.'}

  return <main className="page qvl-experts-v01">
    <button className="back-link" onClick={onBack}><Icon name="back"/>Retour à l’atelier</button>
    <header className="qvl-experts-head">
      <div><div className="qvl-experts-title-row"><h1>Experts ministériels</h1><span className="regime extract">Extraction stricte</span></div><p>Repérez les auteurs ministériels recensés dans le corpus et les publications qui documentent leur contribution sur un sujet.</p></div>
      <div className="qvl-experts-kpis"><span><b>{allExperts.length}</b> experts</span><span><b>{publicationCount}</b> publications</span></div>
    </header>

    <section className="qvl-experts-search-card">
      <div className="qvl-experts-search-grid">
        <div className="qvl-experts-field topic"><label>Sujet ou thème <span>facultatif</span></label><div className="qvl-experts-query"><Icon name="search" size={18}/><input value={query} onChange={e=>{setQuery(e.target.value);if(results!==null){setResults(null);setSelected(null);setSearchMeta(null)}}} onKeyDown={e=>{if(e.key==='Enter')runSearch()}} placeholder="Ex. cybercriminalité, violences contre les élus, intelligence artificielle…"/></div></div>
        <div className="qvl-experts-field"><label>Organisme</label><select value={organisation} onChange={e=>setOrganisation(e.target.value)}><option value="">Tous les organismes</option>{organisations.map(o=><option key={o}>{o}</option>)}</select></div>
        <div className="qvl-experts-field"><label>Domaine</label><select value={domain} onChange={e=>setDomain(e.target.value)}><option value="">Tous les domaines</option>{domains.map(d=><option key={d}>{d}</option>)}</select></div>
      </div>
      <div className="qvl-experts-actions"><button className="qvl-experts-primary" onClick={runSearch} disabled={loading}>{loading?'Recherche…':'Rechercher dans le corpus'}</button><button className="qvl-experts-secondary" onClick={reset}>Réinitialiser</button><div className="qvl-experts-method"><Icon name="info" size={16}/><span>La recherche thématique s’appuie sur le référentiel validé des micro-expertises. Une signature, un domaine général ou une simple proximité de vocabulaire ne suffisent pas à qualifier un expert sur le sujet demandé.</span></div></div>
    </section>

    {error&&<div className="qvl-experts-error">{error}</div>}
    {!error&&searchMeta&&searchMeta.status!=='ok'&&<div className="qvl-experts-error"><strong>{searchMeta.status==='insufficient_query'?'Recherche à préciser':'Aucun rattachement suffisamment établi'}</strong><br/>{searchMeta.message}</div>}

    <div className="qvl-experts-result-bar">
      <div><strong>{filtered.length} expert{filtered.length>1?'s':''}</strong><span>{results===null?'dans le répertoire ministériel du corpus':query.trim()?`repéré${filtered.length>1?'s':''} sur « ${query.trim()} »`:'dans le corpus'}</span></div>
      <div className="qvl-experts-export"><button disabled={!filtered.length} onClick={()=>exportExpertsWord(exportPayload)}><Icon name="file" size={16}/>Exporter Word</button><button disabled={!filtered.length} onClick={()=>exportExpertsExcel(exportPayload)}><Icon name="layers" size={16}/>Exporter les données</button></div>
    </div>

    {!filtered.length?<section className="qvl-experts-empty"><div><Icon name="search" size={32}/><h2>{searchMeta?.status==='insufficient_query'?'Précisez votre recherche':'Aucun expert ministériel suffisamment documenté'}</h2><p>{searchMeta?.message||'Le corpus ne permet pas de rattacher de façon suffisamment solide un expert ministériel à ce sujet. Cela ne signifie pas qu’aucun expert n’existe en dehors du corpus.'}</p></div></section>:<div className="qvl-experts-layout">
      <section className="qvl-experts-list">{filtered.map(expert=><button key={expert.name} type="button" className={`qvl-expert-card ${activeExpert?.name===expert.name?'selected':''}`} onClick={()=>setSelected(expert)}><div className="qvl-expert-avatar">{expert.name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}</div><div className="qvl-expert-card-main"><h3>{expert.name}</h3><p>{expert.organisations.join(' · ')}</p><div className="qvl-expert-chips">{expert.domains.map(d=><span key={d}>{d}</span>)}</div></div><div className="qvl-expert-card-meta"><b>{expert.publications.length}</b><span>publication{expert.publications.length>1?'s':''}</span>{results!==null&&<small>{expert.matches.length} élément{expert.matches.length>1?'s':''} pertinent{expert.matches.length>1?'s':''}</small>}</div><Icon name="chevron" size={18}/></button>)}</section>

      <aside className="qvl-expert-detail">{activeExpert&&<><div className="qvl-expert-detail-head"><div className="qvl-expert-avatar large">{activeExpert.name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}</div><div><span>Expert ministériel recensé</span><h2>{activeExpert.name}</h2></div></div><div className="qvl-expert-detail-body">
        <section><h3>Rattachement observé dans le corpus</h3>{activeExpert.organisations.map(o=><div key={o} className="qvl-expert-org"><Icon name="building" size={16}/>{o}</div>)}</section>
        <section><h3>Domaines documentés par ses publications</h3><div className="qvl-expert-domain-list">{activeExpert.domains.map(d=><span key={d}>{d}</span>)}</div></section>
        {results!==null&&activeExpert.matches.length>0&&<section><h3>Pourquoi cet expert ressort sur ce sujet</h3><div className="qvl-expert-evidence-list">{activeExpert.matches.slice(0,4).map((r,i)=>{const pub=activeExpert.publications.find(p=>p.publication_id===r.publication_id)||{};return <article key={`${r.result_id}-${i}`}><div className="qvl-expert-evidence-top"><strong>{r.publication_id} · {r.publication_title}</strong><span>{r.locator?`repère ${r.locator}`:'source'}</span></div><p>{resultExcerpt(r).slice(0,420)}{resultExcerpt(r).length>420?'…':''}</p><a href={sourceUrl(pub,r.locator)} target="_blank" rel="noreferrer"><Icon name="external" size={14}/>Ouvrir la source</a></article>})}</div></section>}
        <section><h3>Publications associées</h3><div className="qvl-expert-publications">{activeExpert.publications.map(pub=><article key={pub.publication_id}><div><b>{pub.publication_id}</b><strong>{pub.titre}</strong><span>{pub.organisme_producteur}{pub.année_publication?` · ${pub.année_publication}`:''}</span></div><a href={sourceUrl(pub)} target="_blank" rel="noreferrer"><Icon name="external" size={15}/>Source</a></article>)}</div></section>
        <div className="qvl-expert-note"><Icon name="info" size={16}/><span>Le résultat repose sur une micro-expertise validée et documentée par une publication associée à cette personne dans le corpus. Une signature seule n’est pas utilisée comme preuve de pertinence thématique.</span></div>
      </div></> }</aside>
    </div>}
  </main>
}
