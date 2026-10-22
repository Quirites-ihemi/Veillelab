import React, { useEffect, useState } from 'react'
import Header from './components/Header.jsx'
import LandingPage from './LandingPage.jsx'
import { useData } from './hooks/useData.js'
import Explorer from './pages/Explorer.jsx'
import Expertises from './pages/Expertises.jsx'
import Atelier from './pages/Atelier.jsx'
import About from './pages/About.jsx'
import Home from './pages/Home.jsx'
import CrossDocuments from './pages/CrossDocuments.jsx'
import { MentionsLegales, Accessibilite, DonneesPersonnelles, Contact } from './pages/LegalPages.jsx'
import { useHashRoute, navigate, VIEW_TO_TAB, TAB_TO_VIEW } from './lib/router.js'
import './site.css'

const FOOTER_TABS = new Set(['home', 'atelier', 'documents', 'about', 'legal', 'accessibility', 'privacy', 'contact'])

function Footer() {
  const go = view => e => { e.preventDefault(); navigate([view]) }
  return (
    <footer className="footer site-footer">
      <nav aria-label="Informations du site">
        <a href="#/mentions-legales" onClick={go('mentions-legales')}>Mentions légales</a>
        <a href="#/accessibilite" onClick={go('accessibilite')}>Accessibilité : non conforme</a>
        <a href="#/donnees-personnelles" onClick={go('donnees-personnelles')}>Données personnelles</a>
        <a href="#/contact" onClick={go('contact')}>Contact</a>
      </nav>
      <p>Quiritès Veille Lab · IHEMI · base stabilisée du 22 octobre 2026</p>
    </footer>
  )
}

export default function App(){
  const [showLanding,setShowLanding]=useState(true)
  const route=useHashRoute()
  const {data,error}=useData()
  const active=VIEW_TO_TAB[route.view] ?? 'home'

  useEffect(()=>{
    window.scrollTo({top:0,left:0,behavior:'auto'})
  },[route.view])

  if(showLanding){
    return <LandingPage onEnter={()=>{ setShowLanding(false); if(!route.view) navigate(['accueil'],{replace:true}) }} />
  }

  if(error){
    return (
      <div className="load-screen error">
        <h1>Quiritès Veille Lab</h1>
        <p>{error.message}</p>
      </div>
    )
  }

  if(!data){
    return (
      <div className="load-screen">
        <div className="loader"></div>
        <strong>Chargement de la base Quiritès…</strong>
      </div>
    )
  }

  const a=route.args
  return <>
    <Header active={active} onChange={tab=>navigate([TAB_TO_VIEW[tab]||'accueil'])}/>
    {active==='home'&&<Home data={data}/>}
    {active==='expertises'&&<Expertises data={data}
      focusExpertiseId={a[0]||null} focusToken={a[0]||''}
      onSelectExpertise={id=>navigate(['atlas',id],{replace:true})}/>}
    {active==='explorer'&&<Explorer data={data}
      route={a}
      onRoute={(parts,opts)=>navigate(['explorer',...parts],opts)}
      onOpenAtlas={id=>navigate(['atlas',id])}/>}
    {active==='atelier'&&<Atelier data={data}/>}
    {active==='documents'&&<CrossDocuments data={data} sub={a[0]||''} onSub={s=>navigate(['documents',s])}/>}
    {active==='about'&&<About data={data}/>}
    {active==='legal'&&<MentionsLegales/>}
    {active==='accessibility'&&<Accessibilite/>}
    {active==='privacy'&&<DonneesPersonnelles/>}
    {active==='contact'&&<Contact/>}
    {FOOTER_TABS.has(active)&&<Footer/>}
  </>
}
