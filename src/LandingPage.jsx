import React, { useState } from 'react'
import './LandingPage.css'
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

  return (
    <div className="qlab-radar-landing">
      <div className="qlab-radar-landing__hero">
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

          <a className="qlab-radar-landing__read-more" href="#qlab-demarche">
            Découvrir la démarche <span aria-hidden="true">↓</span>
          </a>
        </section>
      </main>
      </div>

      <section className="qlab-radar-landing__manifesto" id="qlab-demarche" aria-labelledby="qlab-demarche-title">
        <div className="qlab-radar-landing__manifesto-inner">
          <header className="qlab-radar-landing__manifesto-header">
            <p className="qlab-radar-landing__manifesto-kicker">LE BULLETIN ET SON APPLICATION COMPAGNE</p>
            <h2 id="qlab-demarche-title">De la connaissance à l’action</h2>
            <p className="qlab-radar-landing__manifesto-intro">
              La lutte contre la criminalité organisée, la sécurité, le maintien de l’ordre public,
              les migrations, la gestion des crises, l’action publique territoriale ou encore les
              transformations numériques constituent autant de champs d’action, de recherche et de
              réflexion qui traversent les métiers du ministère de l’Intérieur et mobilisent de
              nombreux acteurs au-delà de son périmètre institutionnel.
            </p>
            <p className="qlab-radar-landing__manifesto-statement">
              C’est à la rencontre de ces univers que se situe le bulletin de veille de Quiritès.
            </p>
          </header>

          <div className="qlab-radar-landing__manifesto-panels">
            <article className="qlab-radar-landing__manifesto-panel">
              <p className="qlab-radar-landing__manifesto-panel-kicker">01 / LE BULLETIN</p>
              <h3>Valoriser les expertises, donner à voir un écosystème</h3>
              <p>
                En réunissant des publications issues du ministère de l’Intérieur et des travaux
                produits à l’extérieur, le bulletin poursuit deux ambitions complémentaires :
              </p>
              <ul>
                <li>
                  <strong>Valoriser les expertises ministérielles</strong>, en mettant en lumière
                  les savoirs, les savoir-faire et les travaux des services du ministère de l’Intérieur.
                </li>
                <li>
                  <strong>Donner à voir la richesse d’un écosystème d’acteurs</strong>, en accordant
                  également une place aux productions de ceux qui contribuent aux missions du
                  ministère — acteurs de la sécurité privée, associations de sécurité civile,
                  acteurs de l’intégration et de la citoyenneté — ainsi qu’aux travaux des
                  institutions et organismes de recherche qui éclairent ces domaines.
                </li>
              </ul>
            </article>

            <article className="qlab-radar-landing__manifesto-panel qlab-radar-landing__manifesto-panel--lab">
              <p className="qlab-radar-landing__manifesto-panel-kicker">02 / QUIRITÈS VEILLE LAB</p>
              <h3>Faire de la veille un appui à la réflexion et à l’action</h3>
              <p>
                L’application prolonge cette démarche avec une ambition : <strong>faire des
                connaissances réunies par la veille un véritable appui à la réflexion et à l’action.</strong>
              </p>
              <p>Elle propose trois manières de mobiliser ces connaissances :</p>
              <ul>
                <li>
                  <strong>Explorer les expertises et les écosystèmes d’action.</strong> Les graphes
                  de connaissances rendent visibles les savoirs et savoir-faire ministériels, les
                  missions des acteurs internes et externes, ainsi que les relations documentées
                  qui structurent cet écosystème.
                </li>
                <li>
                  <strong>Interroger les connaissances à partir de ses propres besoins.</strong> Grâce
                  à l’interrogation du corpus en langage naturel, chacun peut rechercher des
                  informations, confronter des approches et rassembler des éléments utiles pour
                  comprendre une situation, approfondir une problématique ou préparer un travail.
                </li>
                <li>
                  <strong>Mettre les publications en perspective.</strong> La navigation entre
                  documents, le suivi des notions et les rapprochements documentaires ouvrent de
                  nouvelles pistes de lecture et permettent d’élargir la réflexion au-delà d’une
                  publication isolée.
                </li>
              </ul>
            </article>
          </div>

          <div className="qlab-radar-landing__manifesto-conclusion">
            <p className="qlab-radar-landing__manifesto-principle">
              L’objectif n’est pas de penser ou de décider à la place de l’utilisateur,
              mais de lui donner les moyens de mobiliser les connaissances, de construire
              son propre raisonnement et d’éclairer ses choix.
            </p>
            <p>
              Au fil des éditions, le bulletin et son application compagne ont ainsi vocation à
              constituer <strong>une base de connaissances ouverte, durable et évolutive</strong>,
              accessible à tous ceux qui souhaitent mieux comprendre les enjeux des métiers du
              ministère de l’Intérieur et s’appuyer sur les travaux qui leur sont consacrés.
            </p>
            <a
              className="qlab-radar-landing__manifesto-bulletin"
              href="https://www.quirites.fr/actualites/veille"
              target="_blank"
              rel="noopener noreferrer"
            >
              Découvrir le bulletin de veille <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>

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
