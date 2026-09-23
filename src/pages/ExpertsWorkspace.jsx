import React, { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { searchCorpus } from '../services/reflectionApi.js'
import { exportExpertsWord, exportExpertsExcel } from '../utils/expertExport.js'
import './experts-workspace.css'

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
  return ''
}
function normalizeText(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,' ').replace(/[^a-z0-9\s-]/g,' ').replace(/\s+/g,' ').trim()
}

const QUERY_NOISE = new Set([
  'je','j','veux','voudrais','souhaite','cherche','recherche','besoin','avoir','trouver','identifier','repérer','reperer',
  'un','une','des','de','du','d','en','dans','sur','pour','au','aux','le','la','les','l','qui','soit','est','suis',
  'expert','experte','experts','expertes','specialiste','specialistes','spécialiste','spécialistes','matiere','matière','domaine','sujet','theme','thème'
].map(normalizeText))

const GENERIC_POLICY_TERMS = new Set([
  'politique','politiques','publique','publiques','public','publics','lutte','contre','action','actions','enjeu','enjeux','evolution','evolutions'
].map(normalizeText))

const SUBJECT_ALIASES = {
  immigration:['immigration','migration','migrations','migratoire','migratoires'],
  migration:['migration','migrations','immigration','migratoire','migratoires'],
  migrations:['migration','migrations','immigration','migratoire','migratoires'],
  delinquance:['delinquance','delinquant','delinquants','delinquante','delinquantes'],
  cybercriminalite:['cybercriminalite','cybercrime','cybercriminel','cybercriminels','cybercriminelle','cybercriminelles'],
  pedocriminalite:['pedocriminalite','pedocriminel','pedocriminels','pedocriminelle','pedocriminelles'],
  terrorisme:['terrorisme','terroriste','terroristes'],
  radicalite:['radicalite','radicalites','radicalisation'],
  drogue:['drogue','drogues','stupefiant','stupefiants','narcotrafic','cocaine'],
  stupefiants:['stupefiant','stupefiants','drogue','drogues','narcotrafic','cocaine']
}

function queryTokens(value){
  return normalizeText(value).split(/\s+/).filter(Boolean)
}
function cleanExpertQuery(value){
  const tokens=queryTokens(value).filter(t=>!QUERY_NOISE.has(t))
  return tokens.join(' ').trim()
}
function subjectTerms(value){
  const cleanTokens=queryTokens(cleanExpertQuery(value))
  let core=cleanTokens.filter(t=>!GENERIC_POLICY_TERMS.has(t))
  if(!core.length) core=cleanTokens
  const expanded=[]
  for(const token of core){
    expanded.push(token)
    const aliases=SUBJECT_ALIASES[token]
    if(aliases) expanded.push(...aliases.map(normalizeText))
  }
  return [...new Set(expanded.filter(t=>t.length>=3))]
}
function expandedSearchQuery(value){
  const cleaned=cleanExpertQuery(value)
  const terms=subjectTerms(value)
  const additions=[]
  for(const term of terms){
    const aliases=SUBJECT_ALIASES[term]
    if(aliases) additions.push(...aliases)
  }
  return [...new Set([...queryTokens(cleaned),...additions.map(normalizeText)])].join(' ').trim() || cleaned
}
function matchesSubject(result,pub,terms){
  if(!terms.length)return true
  const haystack=normalizeText([
    resultExcerpt(result),result?.section,result?.label,result?.publication_title,
    pub?.titre,pub?.domaine
  ].filter(Boolean).join(' '))
  return terms.some(term=>haystack.includes(term))
}
function chunkIds(node){
  return String(node?.chunk_id_source||'').split(';').map(x=>x.trim()).filter(Boolean)
}
function isCreditLikeChunk(chunk){
  const section=normalizeText(chunk?.section)
  const text=normalizeText(chunk?.texte)
  if(/(^|\s)(credits?|auteurs?|provenance)(\s|$)/.test(section)) return true
  if(section==='ssmsi') return true
  const metadataMarkers=['directrice de la publication','redacteur en chef','auteure','auteurs','conception graphique','mise en page','reproduction partielle autorisee']
  return metadataMarkers.filter(marker=>text.includes(marker)).length>=2
}
function hasSubstantiveExpertEvidence(node,contentsById){
  const ids=chunkIds(node)
  if(!ids.length)return false
  const chunks=ids.map(id=>contentsById.get(id)).filter(Boolean)
  if(!chunks.length)return false
  return chunks.some(chunk=>!isCreditLikeChunk(chunk))
}

function buildExperts(publications,nodes=[],contents=[],searchResults=[],subject=[]){
  const pubsById=new Map(publications.map(p=>[p.publication_id,p]))
  const contentsById=new Map(contents.map(c=>[c.chunk_id,c]))
  const matchesByPub=new Map()
  for(const r of searchResults){
    if(!r?.publication_id)continue
    const pub=pubsById.get(r.publication_id)||{}
    if(subject.length&&!matchesSubject(r,pub,subject))continue
    if(!matchesByPub.has(r.publication_id))matchesByPub.set(r.publication_id,[])
    matchesByPub.get(r.publication_id).push(r)
  }

  const expertNodes=nodes.filter(n=>normalizeText(n?.type_noeud)==='expert_public')
  const map=new Map()
  for(const node of expertNodes){
    const name=String(node?.libelle||'').trim()
    const pub=pubsById.get(node?.publication_id)
    if(!name||!pub)continue
    const key=normalizeText(name)
    if(!map.has(key))map.set(key,{name,organisations:new Set(),domains:new Set(),publications:[],matches:[],score:0,expertNodes:[],hasSubstantiveEvidence:false})
    const e=map.get(key)
    e.expertNodes.push(node)
    if(hasSubstantiveExpertEvidence(node,contentsById))e.hasSubstantiveEvidence=true
    if(pub.organisme_producteur)e.organisations.add(pub.organisme_producteur)
    splitDomains(pub.domaine).forEach(d=>e.domains.add(d))
    if(!e.publications.some(p=>p.publication_id===pub.publication_id))e.publications.push(pub)
    const pubMatches=matchesByPub.get(pub.publication_id)||[]
    e.matches.push(...pubMatches)
    if(pubMatches.length)e.score+=Math.max(...pubMatches.map(r=>Number(r.score)||0))+Math.min(pubMatches.length,3)
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
  const nodes=useMemo(()=>data?.nodes||[],[data])
  const contents=useMemo(()=>data?.contents||[],[data])
  const allExperts=useMemo(()=>buildExperts(publications,nodes,contents),[publications,nodes,contents])
  const publicationCount=useMemo(()=>new Set(allExperts.flatMap(e=>e.publications.map(p=>p.publication_id))).size,[allExperts])
  const organisations=useMemo(()=>[...new Set(allExperts.flatMap(e=>e.organisations))].sort((a,b)=>a.localeCompare(b,'fr')),[allExperts])
  const domains=useMemo(()=>[...new Set(allExperts.flatMap(e=>e.domains))].sort((a,b)=>a.localeCompare(b,'fr')),[allExperts])
  const [query,setQuery]=useState('')
  const [organisation,setOrganisation]=useState('')
  const [domain,setDomain]=useState('')
  const [results,setResults]=useState(null)
  const [selected,setSelected]=useState(null)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')

  const baseList=results??allExperts
  const filtered=useMemo(()=>{
    const q=normalizeText(query)
    let list=baseList.filter(e=>(!organisation||e.organisations.includes(organisation))&&(!domain||e.domains.includes(domain)))
    if(results===null&&q){
      list=list.filter(e=>normalizeText(`${e.name} ${e.organisations.join(' ')} ${e.domains.join(' ')} ${e.publications.map(p=>p.titre).join(' ')}`).includes(q))
    }
    return [...list].sort((a,b)=>results?(b.score-a.score||a.name.localeCompare(b.name,'fr')):a.name.localeCompare(b.name,'fr'))
  },[baseList,organisation,domain,query,results])

  const runSearch=async()=>{
    const raw=query.trim()
    if(!raw){setResults(null);setSelected(null);setError('');return}
    const cleaned=cleanExpertQuery(raw)
    const terms=subjectTerms(raw)
    const searchQuery=expandedSearchQuery(raw)
    if(!cleaned){setResults([]);setSelected(null);setError('La requête ne contient pas de sujet exploitable après retrait des formulations génériques.');return}
    setLoading(true);setError('')
    try{
      const response=await searchCorpus(searchQuery,{limit:30,maxPerPublication:3,diversifyByPublication:true})
      const experts=buildExperts(publications,nodes,contents,response.results||[],terms)
        .filter(e=>e.hasSubstantiveEvidence&&e.matches.length)
      setResults(experts)
      setSelected(experts[0]||null)
    }catch(e){setError(e?.message||String(e));setResults([]);setSelected(null)}finally{setLoading(false)}
  }
  const reset=()=>{setQuery('');setOrganisation('');setDomain('');setResults(null);setSelected(null);setError('')}
  const activeExpert=selected&&filtered.some(e=>e.name===selected.name)?filtered.find(e=>e.name===selected.name):filtered[0]||null
  const exportPayload={query:query.trim(),experts:filtered,generated_at:new Date().toISOString(),method_note:'Avec une requête, une personne n’est retenue que si elle dispose d’un nœud expert_public dans le corpus, d’une provenance substantielle qui ne se limite pas aux crédits ou à la liste des auteurs, et d’au moins un matériau correspondant au sujet demandé.'}

  return <main className="page qvl-experts-v01">
    <button className="back-link" onClick={onBack}><Icon name="back"/>Retour à l’atelier</button>
    <header className="qvl-experts-head">
      <div><div className="qvl-experts-title-row"><h1>Experts ministériels</h1><span className="regime extract">Extraction stricte</span></div><p>Repérez les experts ministériels dont la contribution sur un sujet est effectivement documentée dans le corpus.</p></div>
      <div className="qvl-experts-kpis"><span><b>{allExperts.length}</b> experts</span><span><b>{publicationCount}</b> publications</span></div>
    </header>

    <section className="qvl-experts-search-card">
      <div className="qvl-experts-search-grid">
        <div className="qvl-experts-field topic"><label>Sujet ou thème <span>facultatif</span></label><div className="qvl-experts-query"><Icon name="search" size={18}/><input value={query} onChange={e=>{setQuery(e.target.value);if(results!==null)setResults(null)}} onKeyDown={e=>{if(e.key==='Enter')runSearch()}} placeholder="Ex. cybercriminalité, violences contre les élus, intelligence artificielle…"/></div></div>
        <div className="qvl-experts-field"><label>Organisme</label><select value={organisation} onChange={e=>setOrganisation(e.target.value)}><option value="">Tous les organismes</option>{organisations.map(o=><option key={o}>{o}</option>)}</select></div>
        <div className="qvl-experts-field"><label>Domaine</label><select value={domain} onChange={e=>setDomain(e.target.value)}><option value="">Tous les domaines</option>{domains.map(d=><option key={d}>{d}</option>)}</select></div>
      </div>
      <div className="qvl-experts-actions"><button className="qvl-experts-primary" onClick={runSearch} disabled={loading}>{loading?'Recherche…':'Rechercher dans le corpus'}</button><button className="qvl-experts-secondary" onClick={reset}>Réinitialiser</button><div className="qvl-experts-method"><Icon name="info" size={16}/><span>Une signature ne suffit pas à établir une expertise. Avec une requête, le sujet est isolé de la formulation (« je cherche un expert… »), puis seuls les experts disposant d’une contribution substantielle et d’une preuve correspondant réellement au sujet sont retenus.</span></div></div>
    </section>

    {error&&<div className="qvl-experts-error">{error}</div>}

    <div className="qvl-experts-result-bar">
      <div><strong>{filtered.length} expert{filtered.length>1?'s':''}</strong><span>{results===null?'dans le répertoire ministériel du corpus':query.trim()?`repéré${filtered.length>1?'s':''} sur « ${query.trim()} »`:'dans le corpus'}</span></div>
      <div className="qvl-experts-export"><button disabled={!filtered.length} onClick={()=>exportExpertsWord(exportPayload)}><Icon name="file" size={16}/>Exporter Word</button><button disabled={!filtered.length} onClick={()=>exportExpertsExcel(exportPayload)}><Icon name="layers" size={16}/>Exporter les données</button></div>
    </div>

    {!filtered.length?<section className="qvl-experts-empty"><div><Icon name="search" size={32}/><h2>Aucun expert ministériel suffisamment documenté</h2><p>Le corpus ne fournit pas, pour ce sujet, de preuve suffisamment solide pour rattacher un expert ministériel. Cela ne signifie pas qu’aucun expert n’existe en dehors du corpus.</p></div></section>:<div className="qvl-experts-layout">
      <section className="qvl-experts-list">{filtered.map(expert=><button key={expert.name} type="button" className={`qvl-expert-card ${activeExpert?.name===expert.name?'selected':''}`} onClick={()=>setSelected(expert)}><div className="qvl-expert-avatar">{expert.name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}</div><div className="qvl-expert-card-main"><h3>{expert.name}</h3><p>{expert.organisations.join(' · ')}</p><div className="qvl-expert-chips">{expert.domains.map(d=><span key={d}>{d}</span>)}</div></div><div className="qvl-expert-card-meta"><b>{expert.publications.length}</b><span>publication{expert.publications.length>1?'s':''}</span>{results!==null&&<small>{expert.matches.length} élément{expert.matches.length>1?'s':''} pertinent{expert.matches.length>1?'s':''}</small>}</div><Icon name="chevron" size={18}/></button>)}</section>

      <aside className="qvl-expert-detail">{activeExpert&&<><div className="qvl-expert-detail-head"><div className="qvl-expert-avatar large">{activeExpert.name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}</div><div><span>Expert ministériel documenté</span><h2>{activeExpert.name}</h2></div></div><div className="qvl-expert-detail-body">
        <section><h3>Rattachement observé dans le corpus</h3>{activeExpert.organisations.map(o=><div key={o} className="qvl-expert-org"><Icon name="building" size={16}/>{o}</div>)}</section>
        <section><h3>Domaines documentés par ses publications</h3><div className="qvl-expert-domain-list">{activeExpert.domains.map(d=><span key={d}>{d}</span>)}</div></section>
        {results!==null&&activeExpert.matches.length>0&&<section><h3>Pourquoi cet expert ressort sur ce sujet</h3><div className="qvl-expert-evidence-list">{activeExpert.matches.slice(0,4).map((r,i)=>{const pub=activeExpert.publications.find(p=>p.publication_id===r.publication_id)||{};return <article key={`${r.result_id}-${i}`}><div className="qvl-expert-evidence-top"><strong>{r.publication_id} · {r.publication_title}</strong><span>{r.locator?`repère ${r.locator}`:'source'}</span></div><p>{resultExcerpt(r).slice(0,420)}{resultExcerpt(r).length>420?'…':''}</p><a href={sourceUrl(pub,r.locator)} target="_blank" rel="noreferrer"><Icon name="external" size={14}/>Ouvrir la source</a></article>})}</div></section>}
        <section><h3>Publications associées</h3><div className="qvl-expert-publications">{activeExpert.publications.map(pub=><article key={pub.publication_id}><div><b>{pub.publication_id}</b><strong>{pub.titre}</strong><span>{pub.organisme_producteur}{pub.année_publication?` · ${pub.année_publication}`:''}</span></div><a href={sourceUrl(pub)} target="_blank" rel="noreferrer"><Icon name="external" size={15}/>Source</a></article>)}</div></section>
        <div className="qvl-expert-note"><Icon name="info" size={16}/><span>La présence d’un nom dans les crédits ou dans <b>auteurs_MI</b> n’est pas utilisée, à elle seule, comme preuve d’expertise sur le sujet recherché.</span></div>
      </div></> }</aside>
    </div>}
  </main>
}
