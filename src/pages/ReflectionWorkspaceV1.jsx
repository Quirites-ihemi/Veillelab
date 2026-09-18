import React, { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { runReflectionAction, searchCorpus } from '../services/reflectionApi.js'
import './reflection-workspace.css'

const STARTERS = [
  { id:'question', label:'Formuler ma question', kind:'Question', tone:'blue', placeholder:'Quelle question souhaitez-vous explorer ?' },
  { id:'problem', label:'Décrire le problème', kind:'Problème', tone:'ice', placeholder:'Décrivez le problème tel que vous le posez aujourd’hui…' },
  { id:'hypothesis', label:'Poser une hypothèse', kind:'Hypothèse', tone:'mint', placeholder:'Formulez l’hypothèse que vous souhaitez documenter ou mettre à l’épreuve…' },
  { id:'corpus', label:'Ajouter un élément du corpus', kind:'Élément du corpus', tone:'sand', placeholder:'Recherchez d’abord un élément dans le corpus depuis la colonne de droite.' },
  { id:'note', label:'Ajouter une note libre', kind:'Note', tone:'lilac', placeholder:'Écrivez une observation, une piste ou un point à garder en tête…' },
]

const ACTION_GROUPS = [
  {
    title:'Documenter', icon:'book',
    items:[
      { id:'DOC01', label:'Trouver des éléments dans le corpus', icon:'search' },
      { id:'DOC02', label:'Remonter à la source et à la preuve', icon:'file' },
      { id:'DOC03', label:'Trouver des situations comparables', icon:'graph' },
    ]
  },
  {
    title:'Mettre à l’épreuve', icon:'target',
    items:[
      { id:'MIR01', label:'Confronter mon affirmation au corpus', icon:'target' },
      { id:'MIR04', label:'Repérer des contradictions entre les éléments', icon:'warning' },
      { id:'MIR08', label:'Vérifier sur quoi mon affirmation repose concrètement', icon:'search' },
    ]
  },
  {
    title:'Prendre du recul', icon:'layers',
    items:[
      { id:'MET01', label:'Vérifier si deux éléments sont comparables', icon:'link' },
      { id:'MET02', label:'Vérifier la nature du lien', icon:'link' },
      { id:'MET04', label:'Éprouver une recommandation', icon:'spark' },
    ]
  },
]

const ACTION_BY_ID = Object.fromEntries(ACTION_GROUPS.flatMap(group => group.items).map(item => [item.id,item]))
const STORAGE_KEY = 'quirites:reflection-canvas:v1'

function normalizeMaterialId(value){
  const text=String(value||'').trim()
  if(!text)return null
  if(/^(chunk|node|relation):/i.test(text))return text
  if(/^C\d+/i.test(text))return `chunk:${text}`
  if(/^N\d+/i.test(text))return `node:${text}`
  if(/^R\d+/i.test(text))return `relation:${text}`
  return null
}

function materialIdOf(material){
  if(!material)return null
  if(material.material_id)return normalizeMaterialId(material.material_id)
  if(material.chunk_id)return normalizeMaterialId(material.chunk_id)
  if(material.node_id)return normalizeMaterialId(material.node_id)
  if(material.relation_id)return normalizeMaterialId(material.relation_id)
  if(material.finding_id)return normalizeMaterialId(material.finding_id)
  if(material.result_id)return normalizeMaterialId(material.result_id)
  if(material.id)return normalizeMaterialId(material.id)
  return null
}

function publicationOf(material){
  return material?.publication || material?.source_publication || null
}

function materialText(material){
  if(!material)return ''
  if(material?.content?.text)return material.content.text
  if(material?.text)return material.text
  if(material?.label)return material.label
  if(material?.libelle)return material.libelle
  if(material?.formulation)return material.formulation
  if(material?.source_label||material?.target_label)return `${material.source_label||''} — ${material.relation_type||'relation'} → ${material.target_label||''}`
  if(material?.source?.label||material?.target?.label)return `${material.source?.label||''} — ${material.relation_type||'relation'} → ${material.target?.label||''}`
  return material?.selected_material?.text || ''
}

function locatorOf(material){
  return material?.provenance?.locator || material?.provenance?.source_locator || material?.locator || material?.page_source || null
}

function materialKind(material){
  const id=materialIdOf(material)
  if(id?.startsWith('chunk:'))return 'Extrait'
  if(id?.startsWith('relation:'))return 'Relation'
  if(id?.startsWith('node:'))return material?.content?.node_type || material?.node_type || 'Élément du graphe'
  return 'Élément du corpus'
}

function shortText(text, max=260){
  const value=String(text||'').replace(/\s+/g,' ').trim()
  return value.length>max?`${value.slice(0,max).trim()}…`:value
}

function makeCanvasCard({kind='Note',text='',tone='blue',material=null,x=null,y=null}){
  const now=Date.now()
  return {
    id:`card-${now}-${Math.random().toString(36).slice(2,7)}`,
    kind,
    text,
    tone,
    material,
    materialId:materialIdOf(material),
    x:x??56,
    y:y??48,
    createdAt:now,
  }
}

function restoreCanvas(){
  try{
    const parsed=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null')
    return Array.isArray(parsed)?parsed:[]
  }catch{return []}
}

function actionReadiness(actionId, selectedCards){
  const selected=selectedCards || []
  const materials=selected.filter(card=>card.materialId)
  const only=selected[0]
  const text=only?.text?.trim()
  if(actionId==='DOC01')return {ready:selected.length===1&&Boolean(text), hint:'Sélectionnez une carte contenant une question, une hypothèse, un problème ou une note.'}
  if(actionId==='DOC02')return {ready:selected.length===1&&Boolean(only?.materialId), hint:'Sélectionnez un élément du corpus ajouté au canevas.'}
  if(actionId==='DOC03')return {ready:selected.length===1&&Boolean(text||only?.materialId), hint:'Sélectionnez un élément à partir duquel chercher des situations comparables.'}
  if(actionId==='MIR01')return {ready:selected.length===1&&Boolean(text), hint:'Sélectionnez une carte qui formule une affirmation ou une hypothèse.'}
  if(actionId==='MIR04')return {ready:materials.length>=2, hint:'Sélectionnez au moins deux éléments du corpus dans le canevas.'}
  if(actionId==='MIR08')return {ready:selected.length===1&&Boolean(text), hint:'Sélectionnez une affirmation ou une hypothèse à vérifier.'}
  if(actionId==='MET01')return {ready:materials.length===2&&selected.length===2, hint:'Sélectionnez exactement deux éléments du corpus.'}
  if(actionId==='MET02')return {ready:selected.length===1&&only?.materialId?.startsWith('relation:'), hint:'Sélectionnez une relation du graphe ajoutée au canevas.'}
  if(actionId==='MET04'){
    const nodeType=String(only?.material?.content?.node_type||only?.material?.node_type||'').toLowerCase()
    return {ready:selected.length===1&&only?.materialId?.startsWith('node:')&&nodeType.includes('recommand'), hint:'Sélectionnez un nœud de recommandation ajouté au canevas.'}
  }
  return {ready:false,hint:'Sélectionnez un élément du canevas.'}
}

function payloadForAction(actionId, selectedCards){
  const only=selectedCards[0]
  const materialIds=selectedCards.map(card=>card.materialId).filter(Boolean)
  if(actionId==='DOC01')return {element:only.text,limit:12}
  if(actionId==='DOC02')return {material_id:only.materialId}
  if(actionId==='DOC03')return only.materialId?{material_id:only.materialId}:{element:only.text}
  if(actionId==='MIR01')return {assertion:only.text}
  if(actionId==='MIR04')return {material_ids:materialIds}
  if(actionId==='MIR08')return {text:only.text}
  if(actionId==='MET01')return {material_ids:materialIds}
  if(actionId==='MET02')return {material_id:only.materialId}
  if(actionId==='MET04')return {material_id:only.materialId}
  return {}
}

function flattenActionMaterials(actionId,result){
  if(!result)return []
  if(actionId==='DOC01')return result.materials||[]
  if(actionId==='DOC02'){
    const base=[]
    if(result.selected_material){
      base.push({
        material_id:result.selected_material_id,
        content:{text:result.selected_material.text||result.selected_material.label||''},
        publication:result.publication,
        provenance:result.provenance,
      })
    }
    return base
  }
  if(actionId==='DOC03')return (result.cases||[]).flatMap(item=>item.evidence_materials||item.materials||item.evidence||[])
  if(actionId==='MIR01')return [...(result.evidence?.support||[]),...(result.evidence?.nuance||[]),...(result.evidence?.contradiction||[])]
  if(actionId==='MIR04')return [...(result.findings?.explicit_contradictions||[]),...(result.findings?.documented_tensions||[])]
  if(actionId==='MIR08')return (result.checks||[]).flatMap(check=>check.materials||[])
  if(actionId==='MET01')return []
  if(actionId==='MET02')return result.relation?[{
    material_id:`relation:${result.relation.relation_id}`,
    content:{text:`${result.relation.source?.label||''} — ${result.relation.relation_type||''} → ${result.relation.target?.label||''}`},
    publication:result.relation.publication,
    provenance:result.provenance,
    relation_type:result.relation.relation_type,
  }]:[]
  if(actionId==='MET04')return result.recommendation?[{
    material_id:`node:${result.recommendation.node_id}`,
    content:{text:result.recommendation.label,node_type:result.recommendation.node_type},
    node_type:result.recommendation.node_type,
    publication:result.recommendation.publication,
    provenance:result.recommendation.provenance,
  }]:[]
  return []
}

export default function ReflectionWorkspaceV1({onBack}){
  const [cards,setCards]=useState(restoreCanvas)
  const [selectedIds,setSelectedIds]=useState([])
  const [composer,setComposer]=useState(null)
  const [draft,setDraft]=useState('')
  const [activeAction,setActiveAction]=useState(null)
  const [actionResult,setActionResult]=useState(null)
  const [actionLoading,setActionLoading]=useState(false)
  const [actionError,setActionError]=useState('')
  const [corpusQuery,setCorpusQuery]=useState('')
  const [corpusResult,setCorpusResult]=useState(null)
  const [corpusLoading,setCorpusLoading]=useState(false)
  const [corpusError,setCorpusError]=useState('')
  const [guidance,setGuidance]=useState('')
  const canvasRef=useRef(null)
  const dragRef=useRef(null)

  useEffect(()=>{
    try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(cards))}catch{}
  },[cards])

  const selectedCards=useMemo(()=>selectedIds.map(id=>cards.find(card=>card.id===id)).filter(Boolean),[selectedIds,cards])

  useEffect(()=>{
    const onMove=e=>{
      const drag=dragRef.current
      if(!drag||!canvasRef.current)return
      const rect=canvasRef.current.getBoundingClientRect()
      const maxX=Math.max(12,rect.width-drag.width-12)
      const maxY=Math.max(12,rect.height-drag.height-12)
      const x=Math.min(maxX,Math.max(12,e.clientX-rect.left-drag.offsetX))
      const y=Math.min(maxY,Math.max(12,e.clientY-rect.top-drag.offsetY))
      setCards(list=>list.map(card=>card.id===drag.id?{...card,x,y}:card))
    }
    const onUp=()=>{dragRef.current=null;document.body.classList.remove('qvl-reflection-dragging')}
    window.addEventListener('pointermove',onMove)
    window.addEventListener('pointerup',onUp)
    return()=>{window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp)}
  },[])

  const beginComposer=starter=>{
    if(starter.id==='corpus'){
      setGuidance('Utilisez « Interroger le corpus » à droite, puis ajoutez le matériau qui vous intéresse au canevas.')
      setComposer(null)
      setTimeout(()=>document.querySelector('.qvl-global-search-panel textarea')?.focus(),0)
      return
    }
    setComposer(starter)
    setDraft('')
    setGuidance('')
    setTimeout(()=>document.querySelector('.qvl-canvas-composer textarea')?.focus(),0)
  }

  const addDraft=()=>{
    if(!composer||!draft.trim())return
    const index=cards.length
    const x=38+(index%3)*242
    const y=44+(Math.floor(index/3)%3)*150
    const card=makeCanvasCard({kind:composer.kind,text:draft.trim(),tone:composer.tone,x,y})
    setCards(list=>[...list,card])
    setSelectedIds([card.id])
    setComposer(null);setDraft('');setActionResult(null);setActiveAction(null)
  }

  const addMaterialToCanvas=(material,kindOverride)=>{
    const text=materialText(material)
    if(!text)return
    const index=cards.length
    const card=makeCanvasCard({
      kind:kindOverride||materialKind(material),
      text,
      tone:'sand',
      material,
      x:54+(index%3)*236,
      y:54+(Math.floor(index/3)%3)*154,
    })
    setCards(list=>[...list,card])
    setSelectedIds([card.id])
    setGuidance('Élément ajouté au canevas. Vous pouvez maintenant le sélectionner pour remonter à la preuve, chercher un cas comparable ou examiner ses liens.')
  }

  const deleteCard=id=>{
    setCards(list=>list.filter(card=>card.id!==id))
    setSelectedIds(ids=>ids.filter(value=>value!==id))
  }

  const toggleSelection=(card,e)=>{
    const multi=e.shiftKey||e.ctrlKey||e.metaKey
    if(multi){
      setSelectedIds(ids=>ids.includes(card.id)?ids.filter(id=>id!==card.id):[...ids,card.id].slice(-8))
    }else setSelectedIds([card.id])
    setGuidance('')
  }

  const startDrag=(e,card)=>{
    if(e.button!==0||e.target.closest('button,textarea,input,a'))return
    const el=e.currentTarget.closest('.qvl-canvas-card')
    const rect=el.getBoundingClientRect()
    dragRef.current={id:card.id,offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top,width:rect.width,height:rect.height}
    document.body.classList.add('qvl-reflection-dragging')
    el.setPointerCapture?.(e.pointerId)
  }

  const runAction=async actionId=>{
    const readiness=actionReadiness(actionId,selectedCards)
    setActiveAction(actionId)
    setActionResult(null)
    setActionError('')
    if(!readiness.ready){setGuidance(readiness.hint);return}
    setGuidance('')
    setActionLoading(true)
    try{
      const result=await runReflectionAction(actionId,payloadForAction(actionId,selectedCards))
      setActionResult(result)
    }catch(error){setActionError(error?.message||String(error))}
    finally{setActionLoading(false)}
  }

  const runCorpusSearch=async e=>{
    e?.preventDefault()
    if(!corpusQuery.trim()||corpusLoading)return
    setCorpusLoading(true);setCorpusError('');setCorpusResult(null)
    try{setCorpusResult(await searchCorpus(corpusQuery.trim(),{limit:12,maxPerPublication:3}))}
    catch(error){setCorpusError(error?.message||String(error))}
    finally{setCorpusLoading(false)}
  }

  const currentAction=activeAction?ACTION_BY_ID[activeAction]:null

  return <main className="qvl-reflection-page">
    <div className="qvl-reflection-back-wrap"><button className="back-link" onClick={onBack}><Icon name="back"/>Retour à l’atelier</button></div>
    <section className="qvl-reflection-hero">
      <div className="qvl-hero-motto" aria-hidden="true"><span>Comprendre</span><span>Éclairer</span><span>Agir</span><i/></div>
      <div className="qvl-hero-copy">
        <h1>Réfléchir avec le corpus</h1>
        <h2>Documenter · Mettre à l’épreuve · Prendre du recul</h2>
        <p>Le travail humain au centre ; le corpus à portée de main ; l’IA en appui, jamais au volant.</p>
      </div>
      <div className="qvl-hero-signature" aria-hidden="true"><span className="qvl-building-sketch">⌂</span><span>Des savoirs<br/>pour l’action<br/>publique</span><i/></div>
    </section>

    <div className="qvl-reflection-shell">
      <aside className="qvl-reflection-left">
        <h2>Pour avancer dans votre réflexion</h2>
        {ACTION_GROUPS.map((group,index)=><section className="qvl-action-group" key={group.title}>
          <h3><Icon name={group.icon} size={18}/><span>{index+1}. {group.title}</span></h3>
          <div className="qvl-action-list">
            {group.items.map(item=>{
              const readiness=actionReadiness(item.id,selectedCards)
              return <button type="button" key={item.id} className={`qvl-action-button ${activeAction===item.id?'active':''} ${readiness.ready?'ready':'context-needed'}`} onClick={()=>runAction(item.id)} title={readiness.ready?item.label:readiness.hint}>
                <span className="qvl-action-icon"><Icon name={item.icon} size={22}/></span>
                <span>{item.label}</span>
                <Icon name="chevron" size={16}/>
              </button>
            })}
          </div>
        </section>)}
      </aside>

      <section className="qvl-reflection-center">
        <header className="qvl-canvas-intro">
          <div className="qvl-canvas-title"><span className="qvl-pencil">✎</span><h2>Votre espace de réflexion</h2></div>
          <p>Commencez par poser ce sur quoi vous travaillez : une question, un problème, une hypothèse, un élément du corpus ou simplement une note. À partir de là, vous pourrez chercher ce qui existe dans le corpus, vérifier vos affirmations, confronter plusieurs éléments ou prendre du recul sur votre raisonnement.</p>
          <p className="qvl-canvas-promise">Vous construisez l’analyse. Quiritès vous aide à l’étayer, à la questionner et à <strong>identifier les sources utiles</strong>.</p>
          <div className="qvl-starter-row">
            {STARTERS.map(starter=><button type="button" key={starter.id} className={`qvl-starter ${starter.tone}`} onClick={()=>beginComposer(starter)}><Icon name="plus" size={18}/><span>{starter.label}</span></button>)}
          </div>
        </header>

        {composer&&<div className="qvl-canvas-composer">
          <div><strong>{composer.kind}</strong><span>Écrivez avec vos mots. Rien ne sera généré à votre place.</span></div>
          <textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder={composer.placeholder} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')addDraft()}}/>
          <div className="qvl-composer-actions"><button type="button" onClick={()=>{setComposer(null);setDraft('')}}>Annuler</button><button type="button" className="primary" disabled={!draft.trim()} onClick={addDraft}>Ajouter au canevas</button></div>
        </div>}

        <div className={`qvl-canvas ${cards.length?'has-cards':''}`} ref={canvasRef} onClick={e=>{if(e.target===e.currentTarget)setSelectedIds([])}}>
          {!cards.length&&<div className="qvl-empty-canvas">
            <div className="qvl-empty-cards" aria-hidden="true"><i/><i/></div>
            <h3>Votre canevas est encore vide</h3>
            <p>Ajoutez une carte pour commencer à structurer votre réflexion.</p>
            <div className="qvl-hand-hint" aria-hidden="true"><span>↖</span><em>Commencez ici<br/>et construisez votre analyse<br/>pas à pas</em></div>
          </div>}
          {cards.map(card=>{
            const selected=selectedIds.includes(card.id)
            return <article key={card.id} className={`qvl-canvas-card ${card.tone} ${selected?'selected':''} ${card.materialId?'corpus-card':''}`} style={{left:card.x,top:card.y}} onClick={e=>{e.stopPropagation();toggleSelection(card,e)}} onPointerDown={e=>startDrag(e,card)}>
              <header><span>{card.kind}</span>{card.materialId&&<small>{card.materialId.replace(':',' · ')}</small>}<button type="button" aria-label="Supprimer la carte" onClick={e=>{e.stopPropagation();deleteCard(card.id)}}><Icon name="close" size={14}/></button></header>
              <p>{card.text}</p>
              {card.material&&<footer><span>{publicationOf(card.material)?.publication_id||publicationOf(card.material)?.titre||''}</span>{locatorOf(card.material)&&<span>p./repère {locatorOf(card.material)}</span>}</footer>}
            </article>
          })}
        </div>
        {cards.length>0&&<div className="qvl-canvas-help"><span>{selectedCards.length?`${selectedCards.length} carte${selectedCards.length>1?'s':''} sélectionnée${selectedCards.length>1?'s':''}`:'Cliquez sur une carte pour la sélectionner.'}</span><span>Maj/Ctrl + clic pour sélectionner plusieurs éléments · Faites glisser une carte pour la déplacer.</span></div>}
      </section>

      <aside className="qvl-reflection-right">
        <section className="qvl-corpus-panel">
          <h2><Icon name="file" size={21}/>Ce que le corpus apporte</h2>
          <div className={`qvl-assist-zone ${actionResult||actionLoading||actionError||guidance?'active':''}`}>
            {!activeAction&&!actionLoading&&!actionResult&&!actionError&&!guidance&&<RightEmpty/>}
            {guidance&&<div className="qvl-guidance"><span className="qvl-guidance-icon"><Icon name="info" size={20}/></span><strong>Pour utiliser cette fonction</strong><p>{guidance}</p></div>}
            {currentAction&&actionLoading&&<div className="qvl-loading"><span>✦</span><strong>{currentAction.label}</strong><p>Le corpus est interrogé à partir de l’élément sélectionné.</p></div>}
            {actionError&&<div className="qvl-error"><strong>La vérification n’a pas abouti</strong><p>{actionError}</p></div>}
            {actionResult&&<ActionResult actionId={activeAction} result={actionResult} onAdd={addMaterialToCanvas}/>} 
          </div>
        </section>

        <section className="qvl-global-search-panel">
          <div className="qvl-search-panel-head"><h2><span className="qvl-chat-bubble">◯</span>Interroger le corpus</h2><button type="button" onClick={()=>setGuidance('Posez une question ou quelques mots-clés. Le moteur cherche dans l’ensemble du corpus actif et restitue uniquement les matériaux réellement présents.')}>Conseils d’usage</button></div>
          <form onSubmit={runCorpusSearch}>
            <textarea maxLength={500} value={corpusQuery} onChange={e=>setCorpusQuery(e.target.value)} placeholder="Posez une question sur le corpus…"/>
            <span className="qvl-char-count">{corpusQuery.length}/500</span>
            <div className="qvl-corpus-scope"><Icon name="layers" size={17}/><span>Tout le corpus</span><span>⌄</span></div>
            <button className="qvl-search-submit" type="submit" disabled={!corpusQuery.trim()||corpusLoading}><Icon name="search" size={19}/>{corpusLoading?'Recherche…':'Lancer la recherche'}</button>
          </form>
          {corpusError&&<div className="qvl-search-error">{corpusError}</div>}
          {corpusResult&&<CorpusSearchResult result={corpusResult} onAdd={addMaterialToCanvas}/>} 
          {!corpusResult&&!corpusError&&<div className="qvl-corpus-info"><Icon name="info" size={17}/><span>Le corpus entier est disponible : notes, rapports, études, articles, textes officiels, podcasts, etc.</span></div>}
        </section>
      </aside>
    </div>
  </main>
}

function RightEmpty(){return <div className="qvl-right-empty"><span className="qvl-round-book"><Icon name="book" size={31}/></span><strong>Sélectionnez une carte de votre canevas.</strong><p>Quiritès vous proposera les recherches et vérifications adaptées à ce que vous êtes en train de travailler.</p></div>}

function CorpusSearchResult({result,onAdd}){
  const materials=result?.results||result?.materials||[]
  return <div className="qvl-search-results">
    <div className="qvl-result-summary"><strong>{materials.length} élément{materials.length>1?'s':''}</strong><span>dans le corpus</span></div>
    <div className="qvl-mini-results">{materials.slice(0,8).map((material,index)=><MaterialMini key={materialIdOf(material)||index} material={material} onAdd={()=>onAdd(material)}/>)}</div>
  </div>
}

function ActionResult({actionId,result,onAdd}){
  const action=ACTION_BY_ID[actionId]
  const materials=flattenActionMaterials(actionId,result)
  return <div className="qvl-action-result">
    <header><span className="qvl-result-kicker">{action?.label}</span><ResultHeadline actionId={actionId} result={result}/></header>
    <ResultBody actionId={actionId} result={result}/>
    {materials.length>0&&<div className="qvl-result-materials">
      <h4>Éléments mobilisés</h4>
      {materials.slice(0,8).map((material,index)=><MaterialMini key={materialIdOf(material)||`${actionId}-${index}`} material={material} onAdd={()=>onAdd(material)}/>) }
    </div>}
    <div className="qvl-method-note"><Icon name="info" size={15}/><span>{result?.guardrails?.note||'Le résultat reste un appui documentaire. La décision et l’interprétation appartiennent à l’analyste.'}</span></div>
  </div>
}

function ResultHeadline({actionId,result}){
  let text='Résultat documentaire'
  if(actionId==='DOC01')text=`${result?.search?.returned_materials??result?.materials?.length??0} éléments trouvés`
  if(actionId==='DOC02')text=result?.provenance?.status==='fine_proof_available'?'Preuve fine disponible':'Provenance disponible'
  if(actionId==='DOC03')text=`${result?.cases?.length??0} situation${(result?.cases?.length??0)>1?'s':''} candidate${(result?.cases?.length??0)>1?'s':''}`
  if(actionId==='MIR01')text='Ce que le corpus permet de confronter'
  if(actionId==='MIR04')text='Tensions et contradictions documentées'
  if(actionId==='MIR08')text='État de l’ancrage empirique'
  if(actionId==='MET01')text='Conditions de comparabilité'
  if(actionId==='MET02')text='Nature documentaire du lien'
  if(actionId==='MET04')text='Documentation de la recommandation'
  return <h3>{text}</h3>
}

function ResultBody({actionId,result}){
  if(actionId==='DOC01')return <p className="qvl-result-note">Le corpus restitue les matériaux les plus pertinents sans construire l’analyse à votre place.</p>
  if(actionId==='DOC02')return <div className="qvl-status-stack"><StatusRow label="Niveau de provenance" value={result?.provenance?.level||'—'}/><StatusRow label="Repère" value={result?.provenance?.source_locator||'Non disponible'}/><p>{result?.provenance?.message}</p>{(result?.proofs||[]).slice(0,2).map((proof,index)=><blockquote key={proof.proof_id||index}>{shortText(proof.text||proof.texte,360)}</blockquote>)}</div>
  if(actionId==='DOC03')return <div className="qvl-status-stack"><StatusRow label="Cas candidats" value={result?.cases?.length??0}/><p>{result?.guardrails?.note}</p></div>
  if(actionId==='MIR01')return <div className="qvl-metric-grid"><Metric label="Appuis" value={result?.evidence?.support?.length||0}/><Metric label="Nuances / tensions" value={result?.evidence?.nuance?.length||0}/><Metric label="Contradictions explicites" value={result?.evidence?.contradiction?.length||0}/>{result?.claim_analysis?.methodological_caution&&<p className="qvl-wide-note">{result.claim_analysis.methodological_caution}</p>}</div>
  if(actionId==='MIR04')return <div className="qvl-metric-grid"><Metric label="Contradictions explicites" value={result?.findings?.explicit_contradictions?.length||0}/><Metric label="Tensions documentées" value={result?.findings?.documented_tensions?.length||0}/><p className="qvl-wide-note">{result?.documentary_state?.note}</p></div>
  if(actionId==='MIR08')return <div className="qvl-metric-grid"><Metric label="Segments vérifiés" value={result?.summary?.empirical_segments_checked||0}/><Metric label="Ancrés empiriquement" value={result?.summary?.empirically_anchored_segments||0}/><Metric label="À documenter" value={result?.summary?.weakly_anchored_segments||0}/></div>
  if(actionId==='MET01')return <div className="qvl-criteria-list">{(result?.criteria||[]).map(item=><CriterionRow key={item.id} label={item.label} status={item.status}/>) }<p>{result?.summary?.note}</p></div>
  if(actionId==='MET02')return <div className="qvl-status-stack"><StatusRow label="Type de relation" value={result?.relation?.relation_type||'—'}/><StatusRow label="Famille" value={humanStatus(result?.assessment?.relation_family)}/><StatusRow label="Lecture causale" value={result?.assessment?.causal_interpretation?.causal_inference_allowed?'À examiner':'Non établie'}/><p>{result?.assessment?.causal_interpretation?.note}</p></div>
  if(actionId==='MET04')return <div className="qvl-criteria-list">{(result?.criteria||[]).map(item=><CriterionRow key={item.id} label={item.label} status={item.status}/>) }<p>{result?.summary?.note}</p></div>
  return null
}

function Metric({label,value}){return <div className="qvl-metric"><strong>{value}</strong><span>{label}</span></div>}
function StatusRow({label,value}){return <div className="qvl-status-row"><span>{label}</span><strong>{value}</strong></div>}
function CriterionRow({label,status}){const documented=status==='documented_in_graph'||['documented_alignment','documented_overlap','same_publication_context','partially_aligned_source_context'].includes(status);const caution=status?.startsWith('different_');return <div className={`qvl-criterion ${documented?'ok':caution?'caution':'neutral'}`}><span>{documented?'✓':caution?'!':'·'}</span><div><strong>{label}</strong><small>{humanStatus(status)}</small></div></div>}
function humanStatus(value){return String(value||'').replaceAll('_',' ').replace(/^./,c=>c.toUpperCase())||'Non documenté'}

function MaterialMini({material,onAdd}){
  const id=materialIdOf(material)
  const pub=publicationOf(material)
  const text=materialText(material)||material?.source?.label||material?.target?.label||''
  const provenance=material?.provenance
  return <article className="qvl-material-mini">
    <div className="qvl-material-top"><span>{materialKind(material)}</span>{id&&<small>{id.replace(':',' · ')}</small>}</div>
    <p>{shortText(text,240)}</p>
    <div className="qvl-material-meta"><span>{pub?.publication_id||pub?.titre||material?.publication_id||''}</span>{locatorOf(material)&&<span>repère {locatorOf(material)}</span>}{provenance?.level&&<span>prov. {provenance.level}</span>}</div>
    <button type="button" onClick={onAdd}><Icon name="plus" size={14}/>Ajouter au canevas</button>
  </article>
}
