import React, { useMemo, useRef, useState, useEffect } from 'react'
import Icon from './Icon.jsx'
import { buildAdjacency, selectVisibleGraph } from '../lib/graph.js'

/* =========================================================
   PALETTE « Encre et terre cuite »
   Le type de nœud ne sert qu'à la couleur et à l'icône.
   Il n'intervient à aucun moment dans le calcul des positions.
   ========================================================= */
const TYPE_VISUAL={
  acteur:{label:'Acteur',color:'#3C6193'},
  expert_public:{label:'Expert public',color:'#5691C0'},
  action:{label:'Action',color:'#C36B48'},
  notion_idee:{label:'Notion / idée',color:'#6D5DA6'},
  probleme:{label:'Problème',color:'#A8423E'},
  'Problème':{label:'Problème',color:'#A8423E'},
  localisation:{label:'Localisation',color:'#2E8C80'},
  signal_faible:{label:'Signal faible',color:'#C08A33'},
  recommandation:{label:'Recommandation',color:'#9C4B86'},
}
const LEGEND_ORDER=['acteur','expert_public','action','notion_idee','probleme','localisation','signal_faible','recommandation']

const INK_NODE='#16233C'      // libellés de nœuds
const INK_RELATION='#4A5B76'  // libellés de relations
const EDGE_WEAK='#B2BECE'
const EDGE_STRONG='#3A5273'

// éclaircissement d'une teinte vers le blanc : halos et aplats secondaires
function lighten(hex,amount){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16)
  const mix=v=>Math.round(v+(255-v)*amount)
  return '#'+[mix(r),mix(g),mix(b)].map(v=>('0'+v.toString(16)).slice(-2)).join('')
}

const RELATION_LABELS={
  REPOND_A:'Répond à', REPOSE_SUR:'Repose sur', SE_DECLINE_EN:'Se décline en', PERMET_DE:'Permet de',
  CARACTERISE:'Caractérise', ILLUSTRE:'Illustre', CONTRIBUE_A:'Contribue à', S_INSCRIT_DANS:'S’inscrit dans',
  MENE:'Mène', MET_EN_OEUVRE:'Met en œuvre', S_APPUIE_SUR:'S’appuie sur', CONCERNE:'Concerne',
  LOCALISE_DANS:'Localisé dans', EST_DESTINATAIRE_DE:'Est destinataire de', MOBILISE:'Mobilise', PRESIDE:'Préside',
  S_APPLIQUE_A:'S’applique à', PILOTE:'Pilote', RESPONSABLE_DE:'Responsable de', IMPULSE:'Impulse', ASSOCIATION:'Association',
  A_POUR_OBJECTIF:'A pour objectif', ASSOCIE_A:'Associé à', COLLABORE_AVEC:'Collabore avec', PARTICIPE_A:'Participe à',
  PRECONISE:'Préconise', PORTE:'Porte', DEVELOPPE:'Développe', ENCADRE:'Encadre', FINANCE:'Finance', UTILISE_POUR:'Utilise pour',
  INTERVIENT_SUR:'Intervient sur', SPECIALISE_DANS:'Spécialisé dans', EXPERTISE_SUR:'Expertise sur', FAIT_SUITE_A:'Fait suite à',
  COMPREND:'Comprend', OBSERVEE_DANS:'Observée dans', RENFORCE:'Renforce', INFLUENCE:'Influence',
}

function visualFor(type='notion_idee'){
  const normalized=type==='Problème'?'probleme':type
  return TYPE_VISUAL[normalized] || TYPE_VISUAL.notion_idee
}
function relationLabel(type=''){
  if(RELATION_LABELS[type]) return RELATION_LABELS[type]
  return String(type).toLowerCase().replace(/_/g,' ').replace(/^./,c=>c.toUpperCase())
}
function wrap(text,max=25){
  const words=String(text).split(/\s+/),lines=[]
  let line=''
  for(const w of words){
    const next=(line+' '+w).trim()
    if(next.length>max&&line){lines.push(line);line=w}else line=next
  }
  if(line)lines.push(line)
  return lines.slice(0,4)
}

function Glyph({type,x,y,color,size=17}){
  const t=String(type||'').toLowerCase()
  if(t==='localisation') return <g transform={`translate(${x-size},${y-size}) scale(${size/12})`} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s6-5.4 6-12a6 6 0 1 0-12 0c0 6.6 6 12 6 12Z"/><circle cx="12" cy="10" r="2"/></g>
  if(t==='acteur'||t==='expert_public') return <g transform={`translate(${x-size},${y-size}) scale(${size/12})`} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="8" r="3"/><path d="M5.5 20c.8-4 3-6 6.5-6s5.7 2 6.5 6"/></g>
  if(t==='action') return <g transform={`translate(${x-size},${y-size}) scale(${size/12})`} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h13M13 7l5 5-5 5"/><circle cx="6" cy="12" r="2"/></g>
  if(t==='signal_faible') return <g transform={`translate(${x-size},${y-size}) scale(${size/12})`} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="1.5" fill={color}/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13"/></g>
  if(t==='recommandation') return <g transform={`translate(${x-size},${y-size}) scale(${size/12})`} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m6 12 4 4 8-9"/><circle cx="12" cy="12" r="9"/></g>
  if(t==='probleme'||t==='problème') return <g transform={`translate(${x-size},${y-size}) scale(${size/12})`} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 3 20h18L12 3Z"/><path d="M12 9v5M12 17h.01"/></g>
  return <g transform={`translate(${x-size},${y-size}) scale(${size/12})`} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4M8 14c-1.6-1.3-2.5-3-2.5-5A6.5 6.5 0 0 1 18 6.8c.6 2.6-.2 5-2.4 7.1-.8.8-1.3 1.5-1.5 2.1h-4.2c-.2-.6-.8-1.3-1.9-2Z"/></g>
}

function stableHash(value=''){
  let h=2166136261
  for(const ch of String(value)){
    h^=ch.charCodeAt(0)
    h=Math.imul(h,16777619)
  }
  return (h>>>0)/4294967295
}

function clamp(value,min,max){return Math.max(min,Math.min(max,value))}

/* ---------------------------------------------------------
   Gabarit d'un nœud : rayon, halo et place réellement occupée
   par son libellé. Sert au desserrage et au calcul des bornes,
   pour que le cadrage tienne compte du texte et pas seulement
   des cercles.
   --------------------------------------------------------- */
// Hiérarchie des libellés :
// - à l'entrée dans une publication : 28 / 23 / 18
// - après sélection d'un nœud : 26 / 20 / 16
const NODE_LABEL_STYLE_SELECTED={
  focus:{fontSize:26,lineH:30,charW:13.8,maxChars:29},
  direct:{fontSize:20,lineH:24,charW:10.6,maxChars:27},
  secondary:{fontSize:16,lineH:20,charW:8.5,maxChars:24},
}
const NODE_LABEL_STYLE_ENTRY={
  focus:{fontSize:28,lineH:32,charW:14.8,maxChars:30},
  direct:{fontSize:23,lineH:27,charW:12.2,maxChars:28},
  secondary:{fontSize:18,lineH:22,charW:9.6,maxChars:25},
}

function labelStyleForRole(role,entryMode=false,labelScale=1){
  const set=entryMode?NODE_LABEL_STYLE_ENTRY:NODE_LABEL_STYLE_SELECTED
  const base=set[role] || set.secondary
  return {
    ...base,
    fontSize:base.fontSize*labelScale,
    lineH:base.lineH*labelScale,
    charW:base.charW*labelScale,
  }
}

function nodeBox(node,role,nodeScale=1,entryMode=false,labelScale=1){
  const r=(role==='focus'?46:role==='direct'?31:20)*nodeScale
  const style=labelStyleForRole(role,entryMode,labelScale)
  const lines=wrap(node.libelle,style.maxChars)
  const halo=role==='focus'?38:role==='direct'?13:8
  const labelW=Math.max(...lines.map(l=>l.length))*style.charW
  const labelGap=26
  return {
    r,
    lines:lines.length,
    up:r+halo,
    down:r+labelGap+(lines.length-1)*style.lineH+12,
    half:Math.max(r+halo,labelW/2+12)
  }
}

/* =========================================================
   PLACEMENT B — RÉSEAU ASYMÉTRIQUE ÉQUILIBRÉ
   Moteur force-directed : chaque entité repousse toutes les
   autres, chaque relation rapproche les deux entités qu'elle
   relie. Trois contraintes légères s'y ajoutent :
     1. les entités très reliées repoussent plus fort et se
        dégagent de la place ;
     2. un terme d'égalisation détend les zones tassées vers
        les zones vides ;
     3. une poussée faible dans le sens source → cible donne
        une tendance de lecture, sans imposer d'axe.
   Aucun angle, aucun rayon, aucun anneau, aucune racine :
   la position ne dépend que des relations. Le type de nœud
   n'entre jamais dans le calcul. Positions initiales tirées
   d'un hachage stable du node_id et nombre d'itérations fixe :
   la même publication redonne toujours la même image.
   ========================================================= */
function layoutGraph(nodes,relations,focusId,opts={}){
  const out={}
  if(!nodes.length)return out
  const nodeScale=opts.nodeScale||1
  const labelScale=opts.labelScale||1
  const entryMode=!!opts.entryMode
  const ratio=clamp(opts.containerRatio||1.5,0.85,3.4)

  // le cadre de calcul épouse le format du conteneur : le réseau
  // se déploie directement à la bonne forme, sans étirement
  const H=760, W=Math.round(H*ratio)

  const index=new Map(nodes.map((n,i)=>[n.node_id,i]))
  const n=nodes.length
  const edges=relations
    .filter(r=>index.has(r.source_id)&&index.has(r.cible_id)&&r.source_id!==r.cible_id)
    .map(r=>[index.get(r.source_id),index.get(r.cible_id)])

  const nb=nodes.map(()=>[])
  edges.forEach(([a,b])=>{
    if(nb[a].indexOf(b)<0)nb[a].push(b)
    if(nb[b].indexOf(a)<0)nb[b].push(a)
  })
  const degree=nb.map(l=>l.length)

  // composantes connexes : les groupes sans relation entre eux ne doivent
  // pas s'expulser à travers tout le canevas, ce qui réduirait le graphe principal.
  const componentId=Array(n).fill(-1)
  let componentCount=0
  for(let start=0;start<n;start++){
    if(componentId[start]!==-1)continue
    const q=[start]
    componentId[start]=componentCount
    while(q.length){
      const u=q.shift()
      nb[u].forEach(v=>{
        if(componentId[v]===-1){componentId[v]=componentCount;q.push(v)}
      })
    }
    componentCount++
  }

  const p=nodes.map(nd=>({
    x:W*(0.12+0.76*stableHash(nd.node_id)),
    y:H*(0.12+0.76*stableHash(nd.node_id+'#y'))
  }))

  const k=Math.sqrt(W*H/n)*0.86
  const t0=W*0.09, IT=520

  for(let it=0;it<IT;it++){
    const t=t0*Math.pow(1-it/IT,1.6)+0.4
    const d=p.map(()=>({x:0,y:0}))
    const near=p.map(()=>0)

    for(let i=0;i<n;i++){
      for(let j=i+1;j<n;j++){
        const dx=p[i].x-p[j].x, dy=p[i].y-p[j].y
        const dist=Math.sqrt(dx*dx+dy*dy)||0.01
        // 1. les entités très reliées se dégagent davantage de place
        const scale=1+0.18*Math.min(6,Math.max(degree[i],degree[j]))
        const crossComponent=componentId[i]!==componentId[j]
        const f=(k*k*scale*(crossComponent?0.22:1))/dist
        d[i].x+=dx/dist*f; d[i].y+=dy/dist*f
        d[j].x-=dx/dist*f; d[j].y-=dy/dist*f
        if(dist<k*1.35){near[i]++;near[j]++}
      }
    }

    edges.forEach(([a,b])=>{
      const dx=p[a].x-p[b].x, dy=p[a].y-p[b].y
      const dist=Math.sqrt(dx*dx+dy*dy)||0.01
      const f=(dist*dist)/(k*1.15)
      d[a].x-=dx/dist*f; d[a].y-=dy/dist*f
      d[b].x+=dx/dist*f; d[b].y+=dy/dist*f
      // 3. tendance de lecture : la cible dérive légèrement vers la droite
      const bias=k*0.055
      d[a].x-=bias; d[b].x+=bias
    })

    // 2. égalisation des densités
    const mean=near.reduce((s,v)=>s+v,0)/n
    for(let q=0;q<n;q++){
      const excess=near[q]-mean
      if(excess>0){
        const cx=p[q].x-W/2, cy=p[q].y-H/2
        const m=Math.sqrt(cx*cx+cy*cy)||1
        d[q].x+=cx/m*excess*k*0.035
        d[q].y+=cy/m*excess*k*0.035
      }
      const pull=0.030+0.10/(1+degree[q])
      d[q].x+=(W/2-p[q].x)*pull*0.85
      d[q].y+=(H/2-p[q].y)*pull*1.25
      const m2=Math.sqrt(d[q].x*d[q].x+d[q].y*d[q].y)||0.01
      const step=Math.min(m2,t)/m2
      p[q].x=clamp(p[q].x+d[q].x*step,10,W-10)
      p[q].y=clamp(p[q].y+d[q].y*step,10,H-10)
    }
  }

  // rôles : ils ne servent qu'à dimensionner les gabarits
  const fi=index.has(focusId)?index.get(focusId):0
  const directSet=new Set(nb[fi])
  const boxes=nodes.map((nd,i)=>nodeBox(nd,i===fi?'focus':directSet.has(i)?'direct':'secondary',nodeScale,entryMode,labelScale))

  // desserrage tenant compte des libellés : il n'écarte que des
  // gabarits qui se touchent, sans rappel vers une ancre
  for(let it=0;it<70;it++){
    const d=p.map(()=>({x:0,y:0}))
    for(let i=0;i<n;i++){
      for(let j=i+1;j<n;j++){
        const needX=(boxes[i].half+boxes[j].half)*0.92
        const needY=(boxes[i].down+boxes[j].up)*0.88
        const dx=p[j].x-p[i].x, dy=p[j].y-p[i].y
        if(Math.abs(dx)>=needX||Math.abs(dy)>=needY)continue
        const px=(needX-Math.abs(dx))*0.055*(dx<0?-1:1)
        const py=(needY-Math.abs(dy))*0.085*(dy<0?-1:1)
        d[i].x-=px; d[i].y-=py
        d[j].x+=px; d[j].y+=py
      }
    }
    for(let q=0;q<n;q++){p[q].x+=d[q].x;p[q].y+=d[q].y}
  }

  // mise au format du conteneur : on n'écarte qu'un seul axe, celui
  // qui manque. Les nœuds gardent leur taille, seules les distances
  // augmentent, donc aucune déformation.
  const xs=p.map(q=>q.x), ys=p.map(q=>q.y)
  const spanX=Math.max(1,Math.max(...xs)-Math.min(...xs))
  const spanY=Math.max(1,Math.max(...ys)-Math.min(...ys))
  const current=spanX/spanY
  if(current<ratio){
    const f=Math.min(ratio/current,1.9), mid=(Math.max(...xs)+Math.min(...xs))/2
    p.forEach(q=>{q.x=mid+(q.x-mid)*f})
  }else if(current>ratio){
    const f=Math.min(current/ratio,1.9), mid=(Math.max(...ys)+Math.min(...ys))/2
    p.forEach(q=>{q.y=mid+(q.y-mid)*f})
  }

  nodes.forEach((nd,i)=>{
    out[nd.node_id]={
      x:p[i].x,
      y:p[i].y,
      focus:i===fi,
      secondary:i!==fi&&!directSet.has(i)
    }
  })
  return out
}

/* ---------------------------------------------------------
   Bornes réelles du dessin, halos et libellés compris.
   --------------------------------------------------------- */
function graphBounds(nodes,positions,focusId,directSet,nodeScale=1,entryMode=false,labelScale=1){
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity
  nodes.forEach(n=>{
    const p=positions[n.node_id]
    if(!p)return
    const role=n.node_id===focusId?'focus':directSet.has(n.node_id)?'direct':'secondary'
    const b=nodeBox(n,role,nodeScale,entryMode,labelScale)
    minX=Math.min(minX,p.x-b.half)
    maxX=Math.max(maxX,p.x+b.half)
    minY=Math.min(minY,p.y-b.up)
    maxY=Math.max(maxY,p.y+b.down)
  })
  if(!isFinite(minX))return {minX:0,minY:0,maxX:100,maxY:100}
  return {minX,minY,maxX,maxY}
}

/* ---------------------------------------------------------
   viewBox : bornes réelles, élargies sur le seul axe manquant
   pour épouser le format du conteneur. Aucune déformation,
   preserveAspectRatio reste à sa valeur par défaut.
   --------------------------------------------------------- */
function computeViewBox(bounds,containerW,containerH,topInset=0){
  const pad=30
  let x=bounds.minX-pad,y=bounds.minY-pad
  let w=Math.max(1,bounds.maxX-bounds.minX)+pad*2
  let h=Math.max(1,bounds.maxY-bounds.minY)+pad*2
  if(!(containerW>0&&containerH>0))return {x,y,w,h}

  // la légende flottante occupe le haut du cadre : on lui réserve sa place
  const usableH=Math.max(40,containerH-topInset)

  // un petit graphe est agrandi, mais pas au point de devenir grotesque
  const minW=containerW/1.5,minH=usableH/1.5
  if(w<minW){x-=(minW-w)/2;w=minW}
  if(h<minH){y-=(minH-h)/2;h=minH}

  const ratio=containerW/usableH
  if(w/h<ratio){const nw=h*ratio;x-=(nw-w)/2;w=nw}
  else if(w/h>ratio){const nh=w/ratio;y-=(nh-h)/2;h=nh}

  // bande vide réservée au-dessus, sans déformation : le rapport
  // final vaut exactement containerW / containerH
  const extra=(w/containerW)*topInset
  y-=extra
  h+=extra
  return {x,y,w,h}
}

function LegendGlyph({type}){
  const visual=visualFor(type)
  return <span className="kg-legend-icon" style={{background:visual.color}}><svg viewBox="0 0 24 24" aria-hidden="true"><Glyph type={type} x={12} y={12} color="#fff" size={7.4}/></svg></span>
}

const LEGEND_INSET=58

export default function KnowledgeGraph({nodes,relations,selectedId,selectedRelationId,onSelectNode,onSelectRelation,highlightIds=[],nodeScale=1,labelScale=1,linkDensity=1,showWeak=true,showRelationLabels=false,maxNodes=38,resetToken=0,fitToken=0}){
  const [scale,setScale]=useState(1),[pan,setPan]=useState({x:0,y:0})
  const [frame,setFrame]=useState({w:0,h:0})
  const [hoveredRelationId,setHoveredRelationId]=useState(null)
  const shell=useRef(null)
  const drag=useRef(null)
  const moved=useRef(false)

  useEffect(()=>{setScale(1);setPan({x:0,y:0})},[resetToken,fitToken])

  // Le cadre se mesure lui-même : c'est lui qui donne le format
  // auquel le réseau est ajusté, sans hauteur codée en dur.
  useEffect(()=>{
    const el=shell.current
    if(!el)return
    const read=()=>{
      const r=el.getBoundingClientRect()
      setFrame(prev=>Math.abs(prev.w-r.width)<2&&Math.abs(prev.h-r.height)<2?prev:{w:r.width,h:r.height})
    }
    read()
    if(typeof ResizeObserver==='undefined'){
      window.addEventListener('resize',read)
      return ()=>window.removeEventListener('resize',read)
    }
    const observer=new ResizeObserver(read)
    observer.observe(el)
    return ()=>observer.disconnect()
  },[])

  const visible=useMemo(()=>selectVisibleGraph(nodes,relations,selectedId,false,maxNodes),[nodes,relations,selectedId,maxNodes])
  const entryMode=!selectedId

  // rapport du conteneur arrondi au vingtième : la forme reste
  // identique d'une ouverture à l'autre et ne tremble pas au
  // redimensionnement
  const containerRatio=useMemo(()=>{
    const usable=frame.h-LEGEND_INSET
    if(!(frame.w>0&&usable>0))return 1.5
    return clamp(Math.round((frame.w/usable)*20)/20,0.85,3.4)
  },[frame.w,frame.h])

  const positions=useMemo(
    ()=>layoutGraph(visible.nodes,visible.relations,visible.focus,{nodeScale,labelScale,containerRatio,entryMode}),
    [visible,nodeScale,labelScale,containerRatio,entryMode]
  )

  const focusId=selectedId||visible.focus
  const highlighted=new Set(highlightIds)
  const adj=useMemo(()=>buildAdjacency(visible.nodes,visible.relations),[visible])
  const direct=new Set((adj.get(focusId)||[]).map(x=>x.id))
  const legendTypes=LEGEND_ORDER.filter(type=>visible.nodes.some(n=>(n.type_noeud==='Problème'?'probleme':n.type_noeud)===type))

  // Un seul cadrage stable : les libellés sont dimensionnés dans le même
  // repère que le layout. On évite ainsi la boucle d'amplification qui
  // grossissait le texte après le calcul des collisions.
  const bounds=useMemo(()=>graphBounds(visible.nodes,positions,focusId,direct,nodeScale,entryMode,labelScale),[visible.nodes,positions,focusId,nodeScale,entryMode,labelScale])
  const viewBox=useMemo(()=>computeViewBox(bounds,frame.w,frame.h,LEGEND_INSET),[bounds,frame.w,frame.h])

  const nodeById=useMemo(()=>Object.fromEntries(visible.nodes.map(n=>[n.node_id,n])),[visible.nodes])
  const relationById=useMemo(()=>Object.fromEntries(visible.relations.map(r=>[r.relation_id,r])),[visible.relations])

  function beginPan(e){
    if(e.button!==0)return
    moved.current=false
    const nodeEl=e.target.closest?.('[data-node-id]')
    const relationEl=e.target.closest?.('[data-relation-id]')
    drag.current={
      x:e.clientX,
      y:e.clientY,
      pan,
      pointerId:e.pointerId,
      nodeId:nodeEl?.dataset?.nodeId||null,
      relationId:relationEl?.dataset?.relationId||null,
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function movePan(e){
    if(!drag.current||!(e.buttons&1))return
    const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y
    if(Math.hypot(dx,dy)>5)moved.current=true
    if(moved.current)setPan({x:drag.current.pan.x+dx,y:drag.current.pan.y+dy})
  }
  function endPan(e){
    if(!drag.current)return
    const interaction=drag.current
    const wasMoved=moved.current
    try{e.currentTarget.releasePointerCapture?.(interaction.pointerId)}catch(_e){}
    drag.current=null
    moved.current=false
    if(wasMoved)return
    if(interaction.nodeId&&nodeById[interaction.nodeId]){
      onSelectNode(nodeById[interaction.nodeId])
      return
    }
    if(interaction.relationId&&relationById[interaction.relationId]){
      onSelectRelation(relationById[interaction.relationId])
    }
  }
  function cancelPan(e){
    if(!drag.current)return
    try{e.currentTarget.releasePointerCapture?.(drag.current.pointerId)}catch(_e){}
    drag.current=null
    moved.current=false
  }

  return <div ref={shell} className="knowledge-constellation explorer-v6-knowledge explorer-v9-knowledge">
    <div className="kg-icon-legend">
      <div className="kg-legend-items">{legendTypes.map(type=>{const visual=visualFor(type);return <span className="kg-legend-item" key={type}><LegendGlyph type={type}/><b>{visual.label}</b></span>})}</div>
      <span className="kg-drag-hint"><span className="kg-hand">↔</span> Cliquez-glissez pour déplacer le graphe</span>
    </div>
    <svg viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`} className="knowledge-svg" onWheel={e=>{e.preventDefault();setScale(s=>Math.max(.58,Math.min(1.85,s+(e.deltaY < 0 ? .08 : -.08))))}} onPointerDownCapture={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={cancelPan} onPointerLeave={cancelPan}>
      <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`} style={{transformOrigin:`${viewBox.x+viewBox.w/2}px ${viewBox.y+viewBox.h/2}px`}}>
        {visible.relations.map(r=>{
          const a=positions[r.source_id],b=positions[r.cible_id];if(!a||!b)return null
          const selected=r.relation_id===selectedRelationId
          const hovered=r.relation_id===hoveredRelationId
          const linkedToSelected=Boolean(selectedId)&&(r.source_id===selectedId||r.cible_id===selectedId)
          const strong=selected||linkedToSelected||r.source_id===focusId||r.cible_id===focusId||highlighted.has(r.source_id)||highlighted.has(r.cible_id)
          if(!showWeak&&!strong)return null
          const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,label=relationLabel(r.type_relation)
          const labelWidthPx=Math.max(84,Math.min(190,label.length*7.6+24))
          const showThisLabel=showRelationLabels||selected||hovered||linkedToSelected
          return <g key={r.relation_id} data-relation-id={r.relation_id} className={`kg-relation ${strong?'strong':'weak'} ${selected?'selected':''}`}
            onPointerEnter={()=>setHoveredRelationId(r.relation_id)}
            onPointerLeave={()=>setHoveredRelationId(current=>current===r.relation_id?null:current)}>
            {/* Ligne de capture invisible : facilite le survol et le clic sur une arête fine. */}
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="14" vectorEffect="non-scaling-stroke" pointerEvents="stroke"/>
            <line className={`kg-edge ${strong?'strong':'weak'}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              vectorEffect="non-scaling-stroke"
              style={{
                stroke:strong?EDGE_STRONG:'#71839C',
                opacity:strong?.96:Math.min(.72,.56*linkDensity),
                strokeWidth:selected?3.2:strong?2.25:1.25
              }}/>
            {/* Doctrine des verbes : masqués à l'entrée, visibles pour les relations
                du nœud sélectionné, au survol / clic d'une arête, ou globalement à la demande. */}
            {showThisLabel&&<g className="kg-relation-label" transform={`translate(${mx},${my})`} pointerEvents="none">
              <rect x={-labelWidthPx/2} y="-16" width={labelWidthPx} height="32" rx="16"
                vectorEffect="non-scaling-stroke"
                style={{fill:'#FFFFFF',stroke:selected?'#C36B48':'#C9D4E2',strokeWidth:selected?1.8:1.1,opacity:.98}}/>
              <text y="5" textAnchor="middle" style={{fill:INK_RELATION,fontSize:'13px',fontWeight:720,letterSpacing:'.1px'}}>{label}</text>
            </g>}
          </g>
        })}
        {visible.nodes.map(n=>{
          const p=positions[n.node_id];if(!p)return null
          const visual=visualFor(n.type_noeud)
          const focus=n.node_id===focusId
          const isDirect=direct.has(n.node_id)
          const highlightedNode=highlighted.has(n.node_id)
          const active=focus||isDirect||highlightedNode
          const r=(focus?46:isDirect?31:20)*nodeScale
          // A. nœuds secondaires : aplat plus tenu et contour affirmé,
          //    pour que le type reste identifiable sans concurrencer
          //    la sélection
          const fill=active?visual.color:lighten(visual.color,.80)
          const stroke=active?visual.color:lighten(visual.color,.10)
          const glyphColor=active?'#fff':visual.color
          const role=focus?'focus':isDirect?'direct':'secondary'
          const labelStyle=labelStyleForRole(role,entryMode,labelScale)
          const lines=wrap(n.libelle,labelStyle.maxChars)
          return <g key={n.node_id} data-node-id={n.node_id} className={`kg-node ${focus?'focus':''} ${p.secondary?'secondary':''}`} role="button" tabIndex="0" aria-label={n.libelle} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelectNode(n)}}}>
            <circle className="node-hit-target" cx={p.x} cy={p.y} r={Math.max(r+13,30)} fill="transparent"/>
            {/* C. nœud sélectionné : trois couches de halo clair plutôt
                qu'une saturation ou une taille supplémentaire */}
            {focus&&<circle pointerEvents="none" cx={p.x} cy={p.y} r={r+36} fill={lighten(visual.color,.68)} opacity=".5"/>}
            {focus&&<circle pointerEvents="none" cx={p.x} cy={p.y} r={r+21} fill={lighten(visual.color,.52)} opacity=".62"/>}
            {focus&&<circle pointerEvents="none" cx={p.x} cy={p.y} r={r+8} fill="none" stroke={lighten(visual.color,.35)} strokeWidth="2.4" opacity=".9"/>}
            {isDirect&&!focus&&<circle pointerEvents="none" cx={p.x} cy={p.y} r={r+11} fill={lighten(visual.color,.5)} opacity=".5"/>}
            <circle pointerEvents="none" cx={p.x} cy={p.y} r={r} fill={fill} stroke={stroke} strokeWidth={focus?3.2:isDirect?2.4:2}/>
            <Glyph type={n.type_noeud} x={p.x} y={p.y} color={glyphColor} size={focus?20:isDirect?16:13}/>
            {(()=>{
              const labelPx=labelStyle.fontSize
              const weight=focus?850:isDirect?790:730
              const y=p.y+r+26
              return <text x={p.x} y={y} textAnchor="middle" pointerEvents="none"
                className={`kg-label ${focus?'focus-label':''} ${p.secondary?'secondary-label':''}`}
                style={{fill:INK_NODE,fontSize:`${labelPx}px`,fontWeight:weight,stroke:'#fff',strokeWidth:3.4,paintOrder:'stroke',strokeLinejoin:'round'}}>
                {lines.map((line,i)=><tspan key={i} x={p.x} dy={i?labelStyle.lineH:0}>{line}</tspan>)}
              </text>
            })()}
          </g>
        })}
      </g>
    </svg>
    <div className="graph-tools vertical"><button onClick={()=>setScale(s=>Math.min(1.85,s+.12))}><Icon name="plus"/></button><button onClick={()=>setScale(s=>Math.max(.58,s-.12))}><Icon name="minus"/></button><button onClick={()=>{setScale(1);setPan({x:0,y:0})}}><Icon name="target"/></button></div>
  </div>
}
