import React, { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import quiritesVeilleLabLogo from '../quirites-veille-lab-logo.png'

const tabs=[
  {id:'home',label:'Accueil',icon:'home'},
  {id:'expertises',label:'Atlas des expertises ministérielles',icon:'graph'},
  {id:'explorer',label:'Explorer une publication',icon:'compass'},
  {id:'atelier',label:'Atelier de veille',icon:'spark'},
  {id:'documents',label:'D’un document à l’autre',icon:'layers'},
  {id:'about',label:'À propos',icon:'building'},
]

export default function Header({active,onChange}){
  // Sur téléphone et tablette, les onglets se replient dans un menu.
  const [menuOpen,setMenuOpen]=useState(false)
  useEffect(()=>{ setMenuOpen(false) },[active])
  const pick=id=>{ setMenuOpen(false); onChange(id) }
  return <header className={`topbar ${menuOpen?'menu-open':''}`}>
    <button className="brand" onClick={()=>pick('home')} aria-label="Accueil Quiritès Veille Lab">
      <img className="brand-logo" src={quiritesVeilleLabLogo} alt="Quiritès Veille Lab" />
    </button>
    <button type="button" className="menu-toggle" aria-expanded={menuOpen} aria-controls="main-nav" onClick={()=>setMenuOpen(v=>!v)}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{menuOpen?<path d="M6 6l12 12M18 6L6 18"/>:<path d="M4 7h16M4 12h16M4 17h16"/>}</svg>
      <span>Menu</span>
    </button>
    <nav id="main-nav" className="topnav" aria-label="Navigation principale">
      {tabs.map(t=><button key={t.id} className={`navtab ${active===t.id?'active':''}`} aria-current={active===t.id?'page':undefined} onClick={()=>pick(t.id)}>
        <Icon name={t.icon} size={17}/><span>{t.label}</span>
      </button>)}
    </nav>
    <div className="top-actions">
      <button className="round-action" aria-label="Aide">?</button>
    </div>
  </header>
}
