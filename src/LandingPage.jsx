import React, { useState } from 'react'
import './LandingPage.css'
import landingLogo from './landing-logo.png'
import radarVisual from './landing-radar.png'

const cguDraft = [
  'Quiritès Veille Lab est un prototype d’exploration documentaire fondé sur un corpus de publications sélectionnées dans les bulletins de veille.',
  'Les contenus, résultats, rapprochements et visualisations proposés dépendent du périmètre du corpus actif et peuvent être incomplets.',
  'L’utilisateur reste responsable de l’interprétation, de la vérification et de l’usage des informations produites par l’application.',
  'Les fonctionnalités d’assistance ne se substituent ni à l’analyse professionnelle ni à la consultation des sources originales.',
  'Ce texte est provisoire et pourra être remplacé ultérieurement par les conditions générales d’utilisation définitives.'
]

export default function LandingPage({ onEnter }) {
  const [accepted, setAccepted] = useState(false)
  const [showCgu, setShowCgu] = useState(false)

  return (
    <div className="qlab-radar-landing">
      <header className="qlab-radar-landing__header">
        <div className="qlab-radar-landing__brand-wrap">
          <img src={landingLogo} alt="Quiritès Veille Lab" className="qlab-radar-landing__logo" />
        </div>

        <nav className="qlab-radar-landing__nav" aria-label="Aperçu des espaces du Lab">
          <span>Expertises ministérielles</span>
          <span>Explorer une publication</span>
          <span>Avancer avec le corpus</span>
          <span>La veille à l’IHEMI</span>
        </nav>
      </header>

      <main className="qlab-radar-landing__hero">
        <section className="qlab-radar-landing__copy">
          <div className="qlab-radar-landing__eyebrow">EXPLORER · RELIER · METTRE EN PERSPECTIVE</div>

          <h1>
            <span>Bienvenue dans</span>
            <strong>Quiritès <em>Veille Lab</em></strong>
          </h1>

          <p className="qlab-radar-landing__lead">
            Naviguez dans les publications et dans les univers métiers du ministère de l’Intérieur.
          </p>

          <div className="qlab-radar-landing__tricolor" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          <p className="qlab-radar-landing__intro">
            Explorez des publications, des expertises et des pistes de réflexion à partir du corpus actif de l’ensemble des bulletins de veille.
          </p>

          <p className="qlab-radar-landing__note">
            Résultats fondés sur le corpus actif des bulletins de veille.
          </p>

          <div className="qlab-radar-landing__actions">
            <button
              type="button"
              className="qlab-radar-landing__enter"
              onClick={onEnter}
              disabled={!accepted}
              title={accepted ? 'Entrer dans le Lab' : 'Acceptez les CGU pour entrer dans le Lab'}
            >
              <span aria-hidden="true">→</span>
              Entrer dans le Lab
            </button>
          </div>

          <div className="qlab-radar-landing__cgu-row">
            <label>
              <input
                type="checkbox"
                checked={accepted}
                onChange={event => setAccepted(event.target.checked)}
              />
              <span>J’accepte les CGU</span>
            </label>
            <button type="button" onClick={() => setShowCgu(true)}>
              Voir les conditions générales d’utilisation
            </button>
          </div>
        </section>

        <section className="qlab-radar-landing__visual" aria-label="Radar de veille">
          <img src={radarVisual} alt="Radar de veille centré sur la France et plusieurs univers thématiques" />
          <div className="qlab-radar-landing__visual-fade" />
          <div className="qlab-radar-landing__radar-sweep" aria-hidden="true" />
          <div className="qlab-radar-landing__pulse qlab-radar-landing__pulse--one" aria-hidden="true" />
          <div className="qlab-radar-landing__pulse qlab-radar-landing__pulse--two" aria-hidden="true" />
        </section>
      </main>

      {showCgu && (
        <div className="qlab-radar-landing__modal-backdrop" role="presentation" onMouseDown={() => setShowCgu(false)}>
          <section
            className="qlab-radar-landing__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qlab-cgu-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <button
              type="button"
              className="qlab-radar-landing__modal-close"
              aria-label="Fermer les conditions générales d’utilisation"
              onClick={() => setShowCgu(false)}
            >
              ×
            </button>

            <span className="qlab-radar-landing__modal-kicker">VERSION PROVISOIRE</span>
            <h2 id="qlab-cgu-title">Conditions générales d’utilisation</h2>

            <div className="qlab-radar-landing__modal-copy">
              {cguDraft.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>

            <div className="qlab-radar-landing__modal-actions">
              <button
                type="button"
                onClick={() => {
                  setAccepted(true)
                  setShowCgu(false)
                }}
              >
                J’accepte les CGU
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
