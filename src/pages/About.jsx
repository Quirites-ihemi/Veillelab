import React from 'react'
import Icon from '../components/Icon.jsx'

export default function About({ data }) {
  const pubs = data?.publications || []
  const withText = pubs.filter(p => (p.chunk_count || 0) > 0).length
  return (
    <main className="page about-page">
      <section className="page-heading">
        <h1>À propos</h1>
        <p>Quiritès Veille Lab est l’application compagne du bulletin de veille de l’IHEMI. Elle aide à lire, relier et exploiter les publications que le bulletin signale.</p>
      </section>
      <div className="about-cards">
        <article>
          <Icon name="book" size={30} />
          <h2>Le bulletin donne à lire</h2>
          <p>Les publications constituent les sources de référence : rapports, notes, articles, podcasts, documentaires. L’application n’a pas vocation à remplacer leur lecture ; chaque publication renvoie à son original.</p>
        </article>
        <article>
          <Icon name="graph" size={30} />
          <h2>L’application donne à explorer</h2>
          <p>Chaque publication est analysée en idées clés reliées entre elles (problèmes, acteurs, actions, recommandations, tendances), et les expertises du ministère qu’elle révèle sont repérées.</p>
        </article>
        <article>
          <Icon name="eye" size={30} />
          <h2>La provenance reste visible</h2>
          <p>Chaque élément est relié à sa publication, à une page ou un timecode, et au passage source. Les textes produits par l’intelligence artificielle citent ces passages et doivent être vérifiés.</p>
        </article>
      </div>
      <div className="about-note">
        <Icon name="info" />
        <div>
          <strong>Ce qu’il faut savoir</strong>
          <p>
            {pubs.length} publications sont analysées à ce jour, et une dizaine s’ajoute chaque mois.
            {' '}{withText} d’entre elles disposent de leur texte consultable ; pour les autres, seules les idées clés et leurs liens sont présentés.
            {' '}Les fonctions marquées « bêta » sont expérimentales et couvrent une partie des publications.
          </p>
        </div>
      </div>
    </main>
  )
}
