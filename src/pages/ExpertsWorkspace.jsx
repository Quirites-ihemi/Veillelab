import React, { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { searchCorpus } from '../services/reflectionApi.js'
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
  immigration:['immigration','migration','migrations','migratoire','migratoires','immigre','immigres','integration'],
  migration:['migration','migrations','immigration','migratoire','migratoires','immigre','immigres','integration'],
  migrations:['migration','migrations','immigration','migratoire','migratoires','immigre','immigres','integration'],
  delinquance:['delinquance','delinquant','delinquants','delinquante','delinquantes'],
  cybercriminalite:['cybercriminalite','cybercrime','cybercriminel','cybercriminels','cybercriminelle','cybercriminelles'],
  pedocriminalite:['pedocriminalite','pedocriminel','pedocriminels','pedocriminelle','pedocriminelles'],
  terrorisme:['terrorisme','terroriste','terroristes'],
  radicalite:['radicalite','radicalites','radicalisation'],
  drogue:['drogue','drogues','stupefiant','stupefiants','narcotrafic','cocaine'],
  stupefiants:['stupefiant','stupefiants','drogue','drogues','narcotrafic','cocaine']
}

const POLICY_MARKERS = [
  'politique publique','politiques publiques','action publique','strategie publique','gouvernance','pilotage',
  'mise en oeuvre','dispositif','dispositifs','programme','programmes','plan','plans','mesure','mesures',
  'prevention','reponse publique','intervention publique','audit interministeriel'
].map(normalizeText)

const FIGHT_MARKERS = [
  'lutte','prevention','repression','combat','strategie','dispositif','programme','plan','action publique',
  'politique publique','reponse','prise en charge','controle','enquete','intervention'
].map(normalizeText)

function queryTokens(value){
  return normalizeText(value).split(/\s+/).filter(Boolean)
}
function cleanExpertQuery(value){
  return queryTokens(value).filter(t=>!QUERY_NOISE.has(t)).join(' ').trim()
}
function queryProfile(value){
  const cleaned=cleanExpertQuery(value)
  const tokens=queryTokens(cleaned)
  const normalized=normalizeText(cleaned)
  const hasPublicPolicy=((tokens.includes('politique')||tokens.includes('politiques'))&&(tokens.includes('publique')||tokens.includes('publiques')||tokens.includes('public')))||normalized.includes('action publique')
  const hasFight=tokens.includes('lutte')||tokens.includes('prevention')||tokens.includes('repression')
  const generic=new Set([...GENERIC_POLICY_TERMS])
  let core=tokens.filter(t=>!generic.has(t))
  if(!core.length) core=tokens
  const groups=[]
  for(const token of core){
    groups.push([...new Set((SUBJECT_ALIASES[token]||[token]).map(normalizeText))])
  }
  return {cleaned,tokens,groups,hasPublicPolicy,hasFight}
}
function expandedSearchQuery(value){
  const profile=queryProfile(value)
  return [...new Set([...queryTokens(profile.cleaned),...profile.groups.flat()])].join(' ').trim() || profile.cleaned
}
function includesAny(haystack,values){
  return values.some(v=>v&&haystack.includes(v))
}
function textMatchesProfile(text,profile,{requireQualifiers=true}={}){
  const haystack=normalizeText(text)
  if(!haystack)return false
  if(profile.groups.length&&!profile.groups.every(group=>includesAny(haystack,group))) return false
  if(requireQualifiers&&profile.hasPublicPolicy&&!includesAny(haystack,POLICY_MARKERS)) return false
  if(requireQualifiers&&profile.hasFight&&!includesAny(haystack,FIGHT_MARKERS)) return false
  return true
}
function resultMatchesProfile(result,pub,profile){
  return textMatchesProfile([
    resultExcerpt(result),result?.section,result?.label,result?.publication_title,pub?.titre,pub?.domaine
  ].filter(Boolean).join(' '),profile)
}
function expertiseText(expertise){
  return [expertise?.label,expertise?.definition,expertise?.family].filter(Boolean).join(' ')
}
function expertiseMatchesProfile(expertise,profile){
  return textMatchesProfile(expertiseText(expertise),profile)
}
function publicationExpertises(expertiseNodes=[]){
  const byPub=new Map()
  for(const expertise of expertiseNodes){
    for(const pub of expertise?.publications||[]){
      const pid=pub?.publication_id
      if(!pid)continue
      if(!byPub.has(pid))byPub.set(pid,[])
      byPub.get(pid).push(expertise)
    }
  }
  return byPub
}
function syntheticExpertiseMatch(expertise,pub){
  return {
    result_id:`expertise:${expertise.id}:${pub.publication_id}`,
    kind:'expertise',
    score:100,
    publication_id:pub.publication_id,
    publication_title:pub.titre,
    organisme_producteur:pub.organisme_producteur,
    locator:'',
    label:expertise.label,
    definition:expertise.definition||'',
    expertise_id:expertise.id
  }
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

function buildExperts(publications,expertiseNodes=[],searchResults=[],profile=null){
  const pubsById=new Map(publications.map(p=>[p.publication_id,p]))
  const expertisesByPub=publicationExpertises(expertiseNodes)
  const corpusMatchesByPub=new Map()
  for(const r of searchResults){
    if(!r?.publication_id)continue
    const pub=pubsById.get(r.publication_id)||{}
    if(profile&&!resultMatchesProfile(r,pub,profile))continue
    if(!corpusMatchesByPub.has(r.publication_id))corpusMatchesByPub.set(r.publication_id,[])
    corpusMatchesByPub.get(r.publication_id).push(r)
  }

  const map=new Map()
  for(const pub of publications){
    const names=cleanAuthors(pub?.auteurs_MI)
    if(!names.length)continue
    const linkedExpertises=expertisesByPub.get(pub.publication_id)||[]
    const matchedExpertises=profile?linkedExpertises.filter(x=>expertiseMatchesProfile(x,profile)):linkedExpertises
    const corpusMatches=corpusMatchesByPub.get(pub.publication_id)||[]

    // Priorité absolue au référentiel de micro-expertises validé.
    // Lorsqu'une publication possède des micro-expertises, une recherche thématique ne peut
    // retenir ses auteurs que si ces micro-expertises correspondent elles-mêmes à la demande.
    // Le moteur de corpus n'est utilisé en repli que pour les publications encore non décrites
    // dans le référentiel de micro-expertises.
    const hasStructuredExpertise=linkedExpertises.length>0
    const usableMatches=profile
      ? (hasStructuredExpertise
          ? matchedExpertises.map(x=>syntheticExpertiseMatch(x,pub))
          : corpusMatches)
      : []

    for(const name of names){
      const key=normalizeText(name)
      if(!map.has(key))map.set(key,{name,organisations:new Set(),domains:new Set(),publications:[],matches:[],score:0,expertises:[]})
      const e=map.get(key)
      if(pub.organisme_producteur)e.organisations.add(pub.organisme_producteur)
      splitDomains(pub.domaine).forEach(d=>e.domains.add(d))
      if(!e.publications.some(p=>p.publication_id===pub.publication_id))e.publications.push(pub)
      for(const ex of linkedExpertises){
        if(!e.expertises.some(x=>x.id===ex.id))e.expertises.push(ex)
      }
      if(usableMatches.length){
        e.matches.push(...usableMatches)
        e.score+=usableMatches.reduce((sum,r)=>sum+(Number(r.score)||1),0)
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
  const expertiseNodes=useMemo(()=>data?.expertise_nodes||[],[data])
  const allExperts=useMemo(()=>buildExperts(publications,expertiseNodes),[publications,expertiseNodes])
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
    const profile=queryProfile(raw)
    const searchQuery=expandedSearchQuery(raw)
    if(!profile.cleaned){setResults([]);setSelected(null);setError('La requête ne contient pas de sujet exploitable après retrait des formulations génériques.');return}
    setLoading(true);setError('')
    try{
      const response=await searchCorpus(searchQuery,{limit:30,maxPerPublication:3,diversifyByPublication:true})
      const experts=buildExperts(publications,expertiseNodes,response.results||[],profile)
        .filter(e=>e.matches.length)
      setResults(experts)
      setSelected(experts[0]||null)
    }catch(e){setError(e?.message||String(e));setResults([]);setSelected(null)}finally{setLoading(false)}
  }
  const reset=()=>{setQuery('');setOrganisation('');setDomain('');setResults(null);setSelected(null);setError('')}
  const activeExpert=selected&&filtered.some(e=>e.name===selected.name)?filtered.find(e=>e.name===selected.name):filtered[0]||null
  const exportPayload={query:query.trim(),experts:filtered,generated_at:new Date().toISOString(),method_note:'Les personnes sont repérées dans auteurs_MI, puis qualifiées par les micro-expertises validées de leurs publications. Lorsqu’une publication n’a pas encore de micro-expertise structurée, la recherche corpus sert uniquement de repli. Une publication statistique sur un phénomène ne suffit donc pas, à elle seule, à établir une expertise en politique publique sur ce phénomène.'}

  return <main className="page qvl-experts-v01">
    <button className="back-link" onClick={onBack}><Icon name="back"/>Retour à l’atelier</button>
    <header className="qvl-experts-head">
      <div><div className="qvl-experts-title-row"><h1>Experts ministériels</h1><span className="regime extract">Extraction stricte</span></div><p>Repérez les auteurs ministériels dont les expertises documentées correspondent réellement au sujet recherché.</p></div>
      <div className="qvl-experts-kpis"><span><b>{allExperts.length}</b> experts</span><span><b>{publicationCount}</b> publications</span></div>
    </header>

    <section className="qvl-experts-search-card">
      <div className="qvl-experts-search-grid">
        <div className="qvl-experts-field topic"><label>Sujet ou thème <span>facultatif</span></label><div className="qvl-experts-query"><Icon name="search" size={18}/><input value={query} onChange={e=>{setQuery(e.target.value);if(results!==null)setResults(null)}} onKeyDown={e=>{if(e.key==='Enter')runSearch()}} placeholder="Ex. cybercriminalité, violences contre les élus, intelligence artificielle…"/></div></div>
        <div className="qvl-experts-field"><label>Organisme</label><select value={organisation} onChange={e=>setOrganisation(e.target.value)}><option value="">Tous les organismes</option>{organisations.map(o=><option key={o}>{o}</option>)}</select></div>
        <div className="qvl-experts-field"><label>Domaine</label><select value={domain} onChange={e=>setDomain(e.target.value)}><option value="">Tous les domaines</option>{domains.map(d=><option key={d}>{d}</option>)}</select></div>
      </div>
      <div className="qvl-experts-actions"><button className="qvl-experts-primary" onClick={runSearch} disabled={loading}>{loading?'Recherche…':'Rechercher dans le corpus'}</button><button className="qvl-experts-secondary" onClick={reset}>Réinitialiser</button><div className="qvl-experts-method"><Icon name="info" size={16}/><span>Une signature ne suffit pas. La recherche s’appuie d’abord sur les micro-expertises validées associées aux publications de l’auteur ; la recherche plein corpus n’intervient qu’en repli pour les publications non encore décrites dans ce référentiel.</span></div></div>
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
        <div className="qvl-expert-note"><Icon name="info" size={16}/><span>La présence dans <b>auteurs_MI</b> constitue le point de départ du répertoire, mais la correspondance avec le sujet recherché est établie par les micro-expertises documentées de la publication, ou à défaut par un matériau explicite du corpus.</span></div>
      </div></> }</aside>
    </div>}
  </main>
}
