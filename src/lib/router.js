import { useEffect, useState } from 'react'

// Routage par l'adresse (#/vue/arg1/arg2) : chaque écran a une adresse
// partageable et le bouton « Retour » du navigateur revient à l'écran précédent.
// Le hachage (#) fonctionne sur GitHub Pages sans configuration serveur.

export function parseHash(hash = window.location.hash) {
  const parts = String(hash || '')
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map(p => {
      try { return decodeURIComponent(p) } catch (_e) { return p }
    })
  return { view: parts[0] || '', args: parts.slice(1) }
}

export function buildHash(parts = []) {
  return '#/' + parts.filter(x => x !== undefined && x !== null && x !== '').map(x => encodeURIComponent(String(x))).join('/')
}

export function navigate(parts, { replace = false } = {}) {
  const next = buildHash(parts)
  if (window.location.hash === next) return
  if (replace) {
    window.history.replaceState(null, '', next)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = next
  }
}

export function useHashRoute() {
  const [route, setRoute] = useState(() => parseHash())
  useEffect(() => {
    const onChange = () => setRoute(parseHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

// Correspondance entre les adresses lisibles et les identifiants internes des onglets.
export const VIEW_TO_TAB = {
  '': 'home',
  accueil: 'home',
  atlas: 'expertises',
  explorer: 'explorer',
  atelier: 'atelier',
  documents: 'documents',
  'a-propos': 'about',
  'mentions-legales': 'legal',
  accessibilite: 'accessibility',
  'donnees-personnelles': 'privacy',
  contact: 'contact',
}

export const TAB_TO_VIEW = {
  home: 'accueil',
  expertises: 'atlas',
  explorer: 'explorer',
  atelier: 'atelier',
  documents: 'documents',
  about: 'a-propos',
  legal: 'mentions-legales',
  accessibility: 'accessibilite',
  privacy: 'donnees-personnelles',
  contact: 'contact',
}
