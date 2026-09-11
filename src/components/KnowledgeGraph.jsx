import React, { useMemo, useRef, useState, useEffect } from 'react'
import Icon from './Icon.jsx'
import { buildAdjacency, selectVisibleGraph } from '../lib/graph.js'

const TYPE_VISUAL={
  acteur:{label:'Acteur',color:'#2d8fe8',soft:'#eaf5ff'},
  expert_public:{label:'Expert public',color:'#0e66c6',soft:'#e8f2ff'},
  action:{label:'Action',color:'#f05a36',soft:'#fff0eb'},
  notion_idee:{label:'Notion / idée',color:'#7557d9',soft:'#f1edff'},
  probleme:{label:'Problème',color:'#e13b34',soft:'#fff0ee'},
  'Problème':{label:'Problème',color:'#e13b34',soft:'#fff0ee'},
  localisation:{label:'Localisation',color:'#13aaa8',soft:'#e7f8f7'},
  signal_faible:{label:'Signal faible',color:'#ffad19',soft:'#fff6dc'},
  recommandation:{label:'Recommandation',color:'#df46c8',soft:'#fff0fb'},
}
const LEGEND_ORDER=['acteur','expert_public','action','notion_idee','probleme','localisation','signal_faible','recommandation']
const TYPE_ORDER=new Map(LEGEND_ORDER.map((t,i)=>[t,i]))

const RELATION_LABELS={
  REPOND_A:'Répond à', REPOSE_SUR:'Repose sur', SE_DECLINE_EN:'Se décline en', PERMET_DE:'Permet de',
  CARACTERISE:'Caractérise', ILLUSTRE:'Illustre', CONTRIBUE_A:'Contribue à', S_INSCRIT_DANS:'S’inscrit dans',
  MENE:'Mène', MET_EN_OEUVRE:'Met en œuvre', S_APPUIE_SUR:'S’appuie sur', CONCERNE:'Concerne',
  LOCALISE_DANS:'Localisé dans', EST_DESTINATAIRE_DE:'Est destinataire de', MOBILISE:'Mobilise', PRESIDE:'Préside',
  S_APPLIQUE_A:'S’applique à', PILOTE:'Pilote', RESPONSABLE_DE:'Responsable de', IMPULSE:'Impulse', ASSOCIATION:'Association',
  A_POUR_OBJECTIF:'A pour objectif', ASSOCIE_A:'Associé à', COLLABORE_AVEC:'Collabore avec', PARTICIPE_A:'Participe à',
  PRECONISE:'Préconise', PORTE:'Porte', DEVELOPPE:'Développe', ENCADRE:'Encadre', FINANCE:'Finance', UTILISE_POUR:'Utilise pour',
  INTERVIENT_SUR:'Intervient sur', SPECIALISE_DANS:'Spécialisé dans', EXPERTISE_SUR:'Expertise sur', FAIT_SUITE_A:'Fait suite à',
  COMPREND:'Comprend', OBSERVEE_DANS:'Observée dans', RENFORCE:'Renforce', INFLUENCE:'Influence'
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

function typeRank(type){
  const normalized=type==='Problème'?'probleme':type
  return TYPE_ORDER.has(normalized)?TYPE_ORDER.get(normalized):99
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

/*
 * Mise en page "réseau organique" :
 * - le nœud actif reste le point d'ancrage ;
 * - les voisins directs occupent une surface, pas une couronne ;
 * - les nœuds de second niveau se placent près du voisin qui les relie au centre ;
 * - une courte relaxation déterministe réduit les collisions et casse la symétrie.
 *
 * Contrairement à l'ancienne rosace, le rayon n'est donc jamais constant.
 */
function layoutGraph(nodes,relations,focusId){
  const adj=buildAdjacency(nodes,relations),out={}
  const focus=nodes.find(n=>n.node_id===focusId)||nodes[0]
  if(!focus)return out

  const width=1170,height=770
  const cx=585,cy=380
  const bounds={left:92,right:1078,top:92,bottom:675}
  out[focus.node_id]={x:cx,y:cy,focus:true,active:true,fixed:true}

  const directIds=new Set((adj.get(focus.node_id)||[]).map(x=>x.id))
  const directNodes=nodes
    .filter(n=>directIds.has(n.node_id))
    .sort((a,b)=>(adj.get(b.node_id)?.length||0)-(adj.get(a.node_id)?.length||0)||typeRank(a.type_noeud)-typeRank(b.type_noeud)||String(a.libelle).localeCompare(String(b.libelle),'fr'))

  // Répartition en disque irrégulier (spirale d'or) : aucune couronne régulière.
  const golden=Math.PI*(3-Math.sqrt(5))
  directNodes.forEach((n,i)=>{
    const count=Math.max(1,directNodes.length)
    const t=(i+.72)/count
    const jitter=(stableHash(n.node_id)-.5)*.42
    const angle=i*golden-.92+jitter
    const base=175+Math.sqrt(t)*245
    const degreeBoost=Math.min(42,(adj.get(n.node_id)?.length||0)*3)
    const rx=base+degreeBoost
    const ry=(base*.72)+degreeBoost*.35
    out[n.node_id]={
      x:clamp(cx+Math.cos(angle)*rx,bounds.left,bounds.right),
      y:clamp(cy+Math.sin(angle)*ry,bounds.top,bounds.bottom),
      hub:true,active:true,angle
    }
  })

  const remaining=nodes.filter(n=>n.node_id!==focus.node_id&&!directIds.has(n.node_id))
  const byParent=new Map(directNodes.map(n=>[n.node_id,[]]))
  const orphans=[]

  remaining.forEach(n=>{
    const possible=(adj.get(n.node_id)||[])
      .filter(x=>directIds.has(x.id))
      .sort((a,b)=>(adj.get(b.id)?.length||0)-(adj.get(a.id)?.length||0))
    const parentId=possible[0]?.id
    if(parentId&&byParent.has(parentId))byParent.get(parentId).push(n)
    else orphans.push(n)
  })

  // Les nœuds secondaires forment de petites ramifications autour de leur hub.
  directNodes.forEach(parent=>{
    const list=(byParent.get(parent.node_id)||[]).sort((a,b)=>typeRank(a.type_noeud)-typeRank(b.type_noeud)||String(a.libelle).localeCompare(String(b.libelle),'fr'))
    const p=out[parent.node_id]
    if(!p||!list.length)return
    const dx=p.x-cx,dy=p.y-cy
    const norm=Math.max(1,Math.hypot(dx,dy))
    const ux=dx/norm,uy=dy/norm
    const tx=-uy,ty=ux
    list.forEach((n,i)=>{
      const center=(list.length-1)/2
      const band=i-center
      const tier=Math.floor(Math.abs(band)/3)
      const fan=band*72
      const outward=108+tier*45+(stableHash(n.node_id)-.5)*24
      out[n.node_id]={
        x:clamp(p.x+ux*outward+tx*fan,bounds.left,bounds.right),
        y:clamp(p.y+uy*outward+ty*fan*.72,bounds.top,bounds.bottom),
        secondary:true,parentId:parent.node_id
      }
    })
  })

  // Nœuds sans parent direct : périphérie répartie de façon asymétrique.
  orphans.forEach((n,i)=>{
    const angle=i*golden+1.15+(stableHash(n.node_id)-.5)*.28
    const radius=410+34*(i%3)
    out[n.node_id]={
      x:clamp(cx+Math.cos(angle)*radius,bounds.left,bounds.right),
      y:clamp(cy+Math.sin(angle)*radius*.68,bounds.top,bounds.bottom),
      secondary:true
    }
  })

  const movable=nodes.filter(n=>n.node_id!==focus.node_id&&out[n.node_id])
  const all=nodes.filter(n=>out[n.node_id])
  const edges=relations.filter(r=>out[r.source_id]&&out[r.cible_id])

  // Relaxation légère et déterministe : répulsion + ressorts, centre fixé.
  // Elle évite les superpositions sans transformer le graphe en simulation instable.
  for(let iter=0;iter<62;iter++){
    const delta=new Map(movable.map(n=>[n.node_id,{x:0,y:0}]))

    for(let i=0;i<all.length;i++){
      const a=all[i],pa=out[a.node_id]
      for(let j=i+1;j<all.length;j++){
        const b=all[j],pb=out[b.node_id]
        let dx=pb.x-pa.x,dy=pb.y-pa.y
        let dist=Math.hypot(dx,dy)
        if(dist<.01){dx=.01;dy=.01;dist=.014}
        const aMain=a.node_id===focus.node_id||directIds.has(a.node_id)
        const bMain=b.node_id===focus.node_id||directIds.has(b.node_id)
        const desired=aMain&&bMain?142:(aMain||bMain?112:88)
        if(dist<desired){
          const force=(desired-dist)*.055
          const ux=dx/dist,uy=dy/dist
          if(delta.has(a.node_id)){delta.get(a.node_id).x-=ux*force;delta.get(a.node_id).y-=uy*force}
          if(delta.has(b.node_id)){delta.get(b.node_id).x+=ux*force;delta.get(b.node_id).y+=uy*force}
        }
      }
    }

    edges.forEach(r=>{
      const a=out[r.source_id],b=out[r.cible_id]
      let dx=b.x-a.x,dy=b.y-a.y,dist=Math.max(1,Math.hypot(dx,dy))
      const touchesFocus=r.source_id===focus.node_id||r.cible_id===focus.node_id
      const desired=touchesFocus?285:158
      const force=(dist-desired)*(touchesFocus?.010:.016)
      const ux=dx/dist,uy=dy/dist
      if(delta.has(r.source_id)){delta.get(r.source_id).x+=ux*force;delta.get(r.source_id).y+=uy*force}
      if(delta.has(r.cible_id)){delta.get(r.cible_id).x-=ux*force;delta.get(r.cible_id).y-=uy*force}
    })

    movable.forEach(n=>{
      const p=out[n.node_id],d=delta.get(n.node_id)
      // Très faible rappel vers la position initiale de branche pour conserver la stabilité.
      p.x=clamp(p.x+d.x,bounds.left,bounds.right)
      p.y=clamp(p.y+d.y,bounds.top,bounds.bottom)
    })
  }

  return out
}

function LegendGlyph({type}){
  const visual=visualFor(type)
  return <span className="kg-legend-icon" style={{background:visual.color}}><svg viewBox="0 0 24 24" aria-hidden="true"><Glyph type={type} x={12} y={12} color="#fff" size={7.4}/></svg></span>
}

export default function KnowledgeGraph({nodes,relations,selectedId,selectedRelationId,onSelectNode,onSelectRelation,highlightIds=[],nodeScale=1,linkDensity=1,showWeak=true,maxNodes=38,resetToken=0,fitToken=0}){
  const [scale,setScale]=useState(1),[pan,setPan]=useState({x:0,y:0})
  const drag=useRef(null)
  const moved=useRef(false)

  useEffect(()=>{setScale(1);setPan({x:0,y:0})},[resetToken,fitToken])
  const visible=useMemo(()=>selectVisibleGraph(nodes,relations,selectedId,false,maxNodes),[nodes,relations,selectedId,maxNodes])
  const positions=useMemo(()=>layoutGraph(visible.nodes,visible.relations,visible.focus),[visible])
  const focusId=selectedId||visible.focus
  const highlighted=new Set(highlightIds)
  const adj=useMemo(()=>buildAdjacency(visible.nodes,visible.relations),[visible])
  const direct=new Set((adj.get(focusId)||[]).map(x=>x.id))
  const legendTypes=LEGEND_ORDER.filter(type=>visible.nodes.some(n=>(n.type_noeud==='Problème'?'probleme':n.type_noeud)===type))

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

  return <div className="knowledge-constellation explorer-v6-knowledge explorer-v9-knowledge">
    <div className="kg-icon-legend">
      <div className="kg-legend-items">{legendTypes.map(type=>{const visual=visualFor(type);return <span className="kg-legend-item" key={type}><LegendGlyph type={type}/><b>{visual.label}</b></span>})}</div>
      <span className="kg-drag-hint"><span className="kg-hand">↔</span> Cliquez-glissez pour déplacer le graphe</span>
    </div>
    <svg viewBox="0 0 1170 770" className="knowledge-svg" onWheel={e=>{e.preventDefault();setScale(s=>Math.max(.58,Math.min(1.85,s+(e.deltaY < 0 ? .08 : -.08))))}} onPointerDownCapture={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={cancelPan} onPointerLeave={cancelPan}>
      <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
        {visible.relations.map(r=>{
          const a=positions[r.source_id],b=positions[r.cible_id];if(!a||!b)return null
          const selected=r.relation_id===selectedRelationId
          const strong=selected||r.source_id===focusId||r.cible_id===focusId||highlighted.has(r.source_id)||highlighted.has(r.cible_id)
          if(!showWeak&&!strong)return null
          const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,label=relationLabel(r.type_relation)
          const labelWidth=Math.max(74,Math.min(170,label.length*7.2+22))
          return <g key={r.relation_id} data-relation-id={r.relation_id} className={`kg-relation ${strong?'strong':'weak'} ${selected?'selected':''}`}>
            <line className={`kg-edge ${strong?'strong':'weak'}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{opacity:strong ? .96 : Math.min(.52,.34*linkDensity),strokeWidth:selected?3.8:strong?2.6:1.5}}/>
            {strong&&<g className="kg-relation-label" transform={`translate(${mx},${my})`} pointerEvents="none"><rect x={-labelWidth/2} y="-14" width={labelWidth} height="28" rx="14"/><text y="5" textAnchor="middle">{label}</text></g>}
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
          const fill=active?visual.color:visual.soft
          const glyphColor=active?'#fff':visual.color
          const lines=wrap(n.libelle,focus?27:isDirect?24:22)
          return <g key={n.node_id} data-node-id={n.node_id} className={`kg-node ${focus?'focus':''} ${p.secondary?'secondary':''}`} role="button" tabIndex="0" aria-label={n.libelle} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelectNode(n)}}}>
            <circle className="node-hit-target" cx={p.x} cy={p.y} r={Math.max(r+13,30)} fill="transparent"/>
            {(focus||isDirect)&&<circle pointerEvents="none" cx={p.x} cy={p.y} r={r+27} fill={visual.color} opacity={focus ? .16 : .09}/>}            
            {(focus||isDirect)&&<circle pointerEvents="none" cx={p.x} cy={p.y} r={r+15} fill={visual.color} opacity={focus ? .13 : .08}/>}            
            <circle pointerEvents="none" cx={p.x} cy={p.y} r={r} fill={fill} stroke={visual.color} strokeWidth={focus?3.2:isDirect?2.4:1.8}/>
            <Glyph type={n.type_noeud} x={p.x} y={p.y} color={glyphColor} size={focus?20:isDirect?16:13}/>
            <text x={p.x} y={p.y+r+25} textAnchor="middle" className={`kg-label ${focus?'focus-label':''} ${p.secondary?'secondary-label':''}`}>{lines.map((line,i)=><tspan key={i} x={p.x} dy={i?18:0}>{line}</tspan>)}</text>
          </g>
        })}
      </g>
    </svg>
    <div className="graph-tools vertical"><button onClick={()=>setScale(s=>Math.min(1.85,s+.12))}><Icon name="plus"/></button><button onClick={()=>setScale(s=>Math.max(.58,s-.12))}><Icon name="minus"/></button><button onClick={()=>{setScale(1);setPan({x:0,y:0})}}><Icon name="target"/></button></div>
  </div>
}
