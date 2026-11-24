import React, { useEffect, useRef, useState } from 'react'
import { VIDEOS, TAB_VIDEO } from '../lib/videos.js'
import '../video-hint.css'

// Fenêtre proposant la vidéo de l'onglet, avec lien vers le dépôt des vidéos.
// « Plus tard » / × / Échap : masquée pour cet onglet jusqu'à la prochaine visite.
// « Ne plus afficher » : masquée définitivement, sur tous les onglets.
const OFF_KEY = 'qvl:video-hint:off'
const CLOSED_KEY = tab => `qvl:video-hint:closed:${tab}`

function read(store, key) { try { return window[store].getItem(key) } catch { return null } }
function write(store, key) { try { window[store].setItem(key, '1') } catch { /* stockage indisponible */ } }

export default function VideoHint({ tab }) {
  const [visible, setVisible] = useState(false)
  const watchRef = useRef(null)
  const video = VIDEOS[TAB_VIDEO[tab]]

  useEffect(() => {
    setVisible(false)
    if (!video) return
    if (read('localStorage', OFF_KEY) === '1') return
    if (read('sessionStorage', CLOSED_KEY(tab)) === '1') return
    const timer = setTimeout(() => setVisible(true), 600)
    return () => clearTimeout(timer)
  }, [tab, video])

  const close = () => { write('sessionStorage', CLOSED_KEY(tab)); setVisible(false) }
  const never = () => { write('localStorage', OFF_KEY); setVisible(false) }

  useEffect(() => {
    if (!visible) return
    const prev = document.activeElement
    watchRef.current?.focus()
    const onKey = e => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible || !video) return null

  return (
    <div className="qvl-video-overlay" onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
      <div className="qvl-video-card" role="dialog" aria-modal="true" aria-labelledby="qvl-video-title">
        <button type="button" className="qvl-video-x" aria-label="Fermer" onClick={close}>×</button>
        <a className="qvl-video-thumb" href={video.href} target="_blank" rel="noopener noreferrer" onClick={close} tabIndex={-1} aria-hidden="true">
          <img src={video.image} alt="" loading="eager"/>
          <span className="qvl-video-playbig">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>
          </span>
          <span className="qvl-video-duration">{video.duration}</span>
        </a>
        <div className="qvl-video-body">
          <span className="qvl-video-kicker">Vidéo</span>
          <h2 id="qvl-video-title">{video.title}</h2>
          <p>{video.lead}</p>
          <div className="qvl-video-actions">
            <a ref={watchRef} className="qvl-video-watch" href={video.href} target="_blank" rel="noopener noreferrer" onClick={close}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>
              Voir la vidéo
            </a>
            <button type="button" className="qvl-video-later" onClick={close}>Plus tard</button>
            <button type="button" className="qvl-video-never" onClick={never}>Ne plus afficher</button>
          </div>
        </div>
      </div>
    </div>
  )
}
