import React, { useEffect, useState } from 'react'
import './LandingPage.css'
import './presentation.css'
import { PresentationIntro, PresentationLab } from './components/PresentationText.jsx'
import quiritesLogo from './landing-quirites-logo.png'
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
  // Le radar s'affiche seul pendant 3 secondes, puis s'estompe pour laisser
  // place au texte de présentation (le bouton « Revoir le radar » le rappelle).
  const withText = true
  const [reading, setReading] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReading(true), 3000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={`qlab-radar-landing ${withText && reading ? 'is-reading' : ''}`}>
      <div className="qlab-radar-landing__visual" aria-hidden="true">
        <div className="qlab-radar-landing__visual-frame">
          <img src={radarVisual} alt="" />
          <div className="qlab-radar-landing__radar-sweep" />
          <div className="qlab-radar-landing__pulse qlab-radar-landing__pulse--one" />
          <div className="qlab-radar-landing__pulse qlab-radar-landing__pulse--two" />
        </div>
        <div className="qlab-radar-landing__visual-fade" />
      </div>

      <main className="qlab-radar-landing__content">
        <section className="qlab-radar-landing__copy">
          <img
            src={quiritesLogo}
            alt="Quiritès"
            className="qlab-radar-landing__logo"
          />

          <div className="qlab-radar-landing__eyebrow">
            EXPLORER · RELIER · METTRE EN PERSPECTIVE
          </div>

          <h1>
            <span>Bienvenue dans</span>
            <strong>
              Quiritès <em>Veille Lab</em>
            </strong>
          </h1>

          <p className="qlab-radar-landing__companion">
            L’application compagne du bulletin de veille de Quiritès
          </p>

          <p className="qlab-radar-landing__lead">
            Naviguez dans les univers métiers du ministère de l’Intérieur.
          </p>

          <p className="qlab-radar-landing__signature">
            Le bulletin donne à lire. L’application donne matière à penser et à agir.
          </p>

          <a
            className="qlab-radar-landing__bulletin-link"
            href="https://www.quirites.fr/actualites/veille"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span aria-hidden="true">↗</span>
            Découvrir le bulletin de veille
          </a>

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

        {withText && (
          <section className="qlab-radar-landing__presentation" aria-label="Présentation de Quiritès Veille Lab" aria-hidden={!reading}>
            <div className="qlab-radar-landing__presentation-inner">
              <div className="qlab-radar-landing__presentation-top">
                <span className="qlab-radar-landing__pres-kicker">PRÉSENTATION</span>
                <button type="button" className="qlab-radar-landing__toggle" onClick={() => setReading(false)} tabIndex={reading ? 0 : -1}>Revoir le radar</button>
              </div>
              <div className="qvl-pres qvl-pres--dark">
                <PresentationIntro/>
                <PresentationLab motto={false}/>
              </div>
            </div>
          </section>
        )}
        {withText && !reading && (
          <button type="button" className="qlab-radar-landing__toggle qlab-radar-landing__toggle--read" onClick={() => setReading(true)}>Lire la présentation</button>
        )}
      </main>

      {showCgu && (
        <div
          className="qlab-radar-landing__modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowCgu(false)}
        >
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

            <span className="qlab-radar-landing__modal-kicker">
              VERSION PROVISOIRE
            </span>
            <h2 id="qlab-cgu-title">
              Conditions générales d’utilisation
            </h2>

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
