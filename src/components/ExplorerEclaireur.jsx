import React from 'react'
import { explorerGuideStep } from '../lib/explorerEclaireurRules.js'

function RichLine({parts}){
  return <p>{parts.map((part,i)=>{
    if(typeof part==='string') return <React.Fragment key={i}>{part}</React.Fragment>
    if(part?.strong) return <strong key={i}>{part.strong}</strong>
    return null
  })}</p>
}

export default function ExplorerEclaireur({step,paused,onTogglePause,onCollapse,onReplay,collapsed=false}){
  const content=explorerGuideStep(step)
  if(collapsed){
    return <button className="explorer-eclaireur-recall" onClick={onReplay} type="button" aria-label="Rouvrir l’Éclaireur">
      <span className="explorer-eclaireur-mini-radar" aria-hidden="true"><i/></span>
      <span>Besoin d’aide ?</span>
    </button>
  }
  return <aside className={`explorer-eclaireur explorer-eclaireur-${content.mode}`} data-guide-step={step}>
    <div className="explorer-eclaireur-head">
      <span className="explorer-eclaireur-radar" aria-hidden="true"><i className="ring ring-a"/><i className="ring ring-b"/><i className="sweep"/><i className="dot"/></span>
      <div><strong>L’ÉCLAIREUR</strong><small>Je vous guide dans le graphe</small></div>
      <button type="button" className="explorer-eclaireur-close" onClick={onCollapse} aria-label="Réduire l’Éclaireur">×</button>
    </div>
    <div className="explorer-eclaireur-copy">
      <h3>{content.title}</h3>
      {content.body.map((line,i)=><RichLine key={i} parts={line}/>) }
    </div>
    {step>=2&&step<=6&&<div className="explorer-eclaireur-controls">
      <button type="button" onClick={onTogglePause} className="explorer-eclaireur-pause">{paused?'▶ Reprendre':'Ⅱ Pause'}</button>
      <span>La démonstration se poursuit automatiquement.</span>
    </div>}
    {step===7&&<div className="explorer-eclaireur-controls final"><button type="button" onClick={onCollapse}>Explorer librement</button></div>}
  </aside>
}
