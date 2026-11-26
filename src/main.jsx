import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './responsive.css'

// Rien n'est conservé après la fermeture de l'onglet : on efface ce que
// les versions précédentes avaient laissé durablement dans le navigateur.
try {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('qvl:') || key.startsWith('quirites:')) localStorage.removeItem(key)
  }
} catch { /* stockage indisponible */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
