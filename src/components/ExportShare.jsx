import React, { useState } from 'react'
import Icon from './Icon.jsx'
import { buildHash } from '../lib/router.js'
import '../export-share.css'

export function shareUrl(parts) {
  const hash = Array.isArray(parts) ? buildHash(parts) : (parts || window.location.hash)
  return `${window.location.origin}${window.location.pathname}${window.location.search}${hash}`
}

// Lien de CONSULTATION d’un résultat public, jamais d’un espace de travail personnel.
export default function ExportShare({ shareParts = null, label = '', formats = [], waitingFor = '', showShareWhenWaiting = false }) {
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const hasShare = Boolean(shareParts)
  if (!formats.length && !hasShare && !waitingFor) return null
  const link = hasShare ? shareUrl(shareParts) : ''
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setStatus('Lien copié')
    } catch {
      // Compatible navigateur plus ancien ou contexte sans permission Clipboard.
      const input = document.createElement('textarea')
      input.value = link; input.style.position = 'fixed'; input.style.opacity = '0'
      document.body.appendChild(input); input.select()
      const done = document.execCommand('copy'); input.remove()
      setStatus(done ? 'Lien copié' : 'Copie impossible : sélectionnez le lien dans la barre d’adresse.')
    }
  }
  const run = async action => {
    if (busy) return
    setBusy(true); setStatus('')
    try { await action(); setStatus('Export lancé') }
    catch (err) { setStatus(err?.message || 'Export indisponible') }
    finally { setBusy(false) }
  }
  return <div className={`qvl-export-share ${waitingFor ? 'qvl-export-share-waiting' : ''}`} aria-label="Actions pour exporter et partager">
    {waitingFor && <><button className="qvl-action-button qvl-action-export" type="button" disabled title={waitingFor}><Icon name="download" size={17}/> Exporter</button>{showShareWhenWaiting && <button className="qvl-action-button qvl-action-share" type="button" disabled title={waitingFor}><Icon name="link" size={17}/> Partager</button>}<span className="qvl-action-hint">{waitingFor}</span></>}
    {formats.length > 0 && <details className="qvl-export-menu">
      <summary className="qvl-action-button qvl-action-export" aria-label="Choisir un format d’export"><Icon name="download" size={17}/> Exporter</summary>
      <div className="qvl-export-options" role="group" aria-label="Choisir un format d’export">
        {formats.map(f => <button key={f.label} type="button" disabled={busy || f.disabled} onClick={() => run(f.action)} title={f.title || ''}>{f.label}</button>)}
      </div>
    </details>}
    {hasShare && <details className="qvl-export-menu">
      <summary className="qvl-action-button qvl-action-share"><Icon name="link" size={17}/> Partager</summary>
      <div className="qvl-export-options" role="group" aria-label="Partager en consultation">
        <span className="qvl-share-caption">Lien de consultation · {label || 'vue sélectionnée'}</span>
        <button type="button" onClick={copy}>Copier le lien direct</button>
        <a href={`mailto:?subject=${encodeURIComponent(`Quiritès Veille Lab — ${label}`)}&body=${encodeURIComponent(`Consulter ce résultat dans Quiritès Veille Lab :\n${link}`)}`}>Envoyer par courriel</a>
      </div>
    </details>}
    {status && <span className="qvl-export-status" role="status">{status}</span>}
  </div>
}
