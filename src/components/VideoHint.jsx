import React, { useEffect, useState } from 'react'
import { VIDEOS, TAB_VIDEO } from '../lib/videos.js'
import '../video-hint.css'

// Encart signalant la vidéo de l'onglet, avec lien vers le dépôt des vidéos.
// × : masqué jusqu'à la prochaine visite. « Ne plus afficher » : masqué définitivement.
const OFF_KEY = 'qvl:video-hint:off'
const CLOSED_KEY = tab => `qvl:video-hint:closed:${tab}`

function read(store, key) { try { return window[store].getItem(key) } catch { return null } }
function write(store, key) { try { window[store].setItem(key, '1') } catch { /* stockage indisponible */ } }

export default function VideoHint({ tab }) {
  const [visible, setVisible] = useState(false)
  const video = VIDEOS[TAB_VIDEO[tab]]

  useEffect(() => {
    setVisible(false)
    if (!video) return
    if (read('localStorage', OFF_KEY) === '1') return
    if (read('sessionStorage', CLOSED_KEY(tab)) === '1') return
    const timer = setTimeout(() => setVisible(true), 700)
    return () => clearTimeout(timer)
  }, [tab, video])

  if (!visible || !video) return null

  const close = () => { write('sessionStorage', CLOSED_KEY(tab)); setVisible(false) }
  const never = () => { write('localStorage', OFF_KEY); setVisible(false) }

  return (
    <aside className="qvl-video-hint" aria-label="Vidéo">
      <a className="qvl-video-hint-link" href={video.href} target="_blank" rel="noopener noreferrer" onClick={close}>
        <span className="qvl-video-hint-play" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>
        </span>
        <span className="qvl-video-hint-text">
          <strong>{video.title}</strong>
          <span>Voir la vidéo · {video.duration} <span aria-hidden="true">↗</span></span>
        </span>
      </a>
      <button type="button" className="qvl-video-hint-never" onClick={never}>Ne plus afficher</button>
      <button type="button" className="qvl-video-hint-x" aria-label="Fermer" onClick={close}>×</button>
    </aside>
  )
}
