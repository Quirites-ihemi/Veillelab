import React from 'react'
import Icon from './Icon.jsx'
import './corpus-proof-modal.css'

function firstPage(value=''){
  const match=String(value||'').match(/\d+/)
  return match?match[0]:''
}

function sourceHref(source={}){
  const raw=String(source?.url||source?.url_contenu||source?.url_source||'').trim()
  if(!raw)return''
  const page=firstPage(source?.repere||source?.page||source?.page_source)
  if(/\.pdf(?:$|[?#])/i.test(raw)&&page)return `${raw.split('#')[0]}#page=${page}`
  return raw
}

function locatorLabel(source={}){
  const raw=String(source?.repere||source?.page||source?.page_source||'').trim()
  if(!raw)return''
  if(/^\d+(?:\s*[;,]\s*\d+)*$/.test(raw))return `p. ${raw.replaceAll(';', ', ')}`
  return raw
}

export default function CorpusProofModal({source,onClose,contextLabel='',contextText='',why=''}){
  if(!source)return null
  const title=source.titre||source.title||source.publication_id||'Publication source'
  const organisation=source.organisme_producteur||source.organisme||source.organisation||''
  const year=source.annee_publication||source.annee||source.year||''
  const publicationId=source.publication_id||''
  const chunkId=source.chunk_id||source.material_id||''
  const locator=locatorLabel(source)
  const excerpt=String(source.extrait||source.text||source.texte||'').trim()
  const href=sourceHref(source)

  return <div className="qvl-corpus-proof-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section className="qvl-corpus-proof-modal" role="dialog" aria-modal="true" aria-label="Preuve complète">
      <header>
        <div className="qvl-corpus-proof-title-block">
          <span>Preuve complète</span>
          <h2>{title}</h2>
          <p>{[organisation,year,publicationId].filter(Boolean).join(' · ')}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer la preuve complète"><Icon name="close" size={18}/></button>
      </header>

      <div className="qvl-corpus-proof-body">
        {contextText&&<section className="qvl-corpus-proof-section qvl-corpus-proof-context">
          <h3>{contextLabel||'Élément documenté'}</h3>
          <p>{contextText}</p>
        </section>}

        <section className="qvl-corpus-proof-section">
          <h3>Éléments de preuve</h3>
          <article className="qvl-corpus-proof-excerpt">
            <div className="qvl-corpus-proof-excerpt-head">
              <div><strong>{source.section||'Extrait source'}</strong>{chunkId&&<small>{chunkId}</small>}</div>
              {locator&&<span>{locator}</span>}
            </div>
            {excerpt?<p>{excerpt}</p>:<p className="qvl-corpus-proof-unavailable">Aucun extrait textuel fin n’est disponible pour cette source.</p>}
          </article>
        </section>

        {why&&<section className="qvl-corpus-proof-section qvl-corpus-proof-why">
          <h3>Pourquoi ce matériau a été retenu</h3>
          <p>{why}</p>
        </section>}

        <section className="qvl-corpus-proof-section qvl-corpus-proof-provenance">
          <h3>Provenance</h3>
          <div>
            <strong>{title}</strong>
            <span>{[organisation,year,publicationId,locator?`repère ${locator.replace(/^p\.\s*/,'')}`:''].filter(Boolean).join(' · ')}</span>
          </div>
          <p>Texte restitué à partir de la source du corpus, sans ajout de connaissance extérieure.</p>
        </section>
      </div>

      <footer>
        {href&&<a href={href} target="_blank" rel="noreferrer"><Icon name="external" size={15}/>Ouvrir la source</a>}
        <button type="button" onClick={onClose}>Fermer</button>
      </footer>
    </section>
  </div>
}
