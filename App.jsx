import React, { useEffect, useState } from 'react'
import Header from './components/Header.jsx'
import LandingPage from './LandingPage.jsx'
import { useData } from './hooks/useData.js'
import Explorer from './pages/Explorer.jsx'
import Expertises from './pages/Expertises.jsx'
import Atelier from './pages/Atelier.jsx'
import About from './pages/About.jsx'
import CrossDocuments from './pages/CrossDocuments.jsx'

export default function App(){
  const [showLanding,setShowLanding]=useState(true)
  const [active,setActive]=useState('expertises')
  // Lien « Voir dans l’Atlas » depuis l’onglet 2 : expertise à ouvrir.
  const [atlasFocus,setAtlasFocus]=useState(null)
  const {data,error}=useData()

  useEffect(()=>{
    window.scrollTo({top:0,left:0,behavior:'auto'})
  },[active])

  if(showLanding){
    return <LandingPage onEnter={()=>setShowLanding(false)} />
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

  return <>
    <Header active={active} onChange={setActive}/>
    {active==='expertises'&&<Expertises data={data} focusExpertiseId={atlasFocus?.id} focusToken={atlasFocus?.token}/>} 
    {active==='explorer'&&<Explorer data={data} onOpenAtlas={id=>{setAtlasFocus(f=>({id,token:(f?.token||0)+1}));setActive('expertises')}}/>} 
    {active==='atelier'&&<Atelier data={data}/>} 
    {active==='documents'&&<CrossDocuments data={data}/>}
    {active==='about'&&<About/>}
    {(active==='atelier'||active==='documents'||active==='about')&&
      <footer className="footer">
        Quiritès Veille Lab · prototype local · base stabilisée du 22 octobre 2026
      </footer>
    }
  </>
}
