import React, { useState } from 'react'
import { navigate } from '../lib/router.js'
import '../home.css'
import '../publications.css'

// Libellés d'affichage des domaines de la base (colonne « domaine »).
// Un domaine absent de cette table s'affiche tel quel.
export const DOMAIN_LABELS = {
  'Migrations/intégration': 'Migrations, intégration, citoyenneté',
  'Démocraties et sujets informationnels': 'Démocratie et information',
  "Administration territoriale de l'Etat": 'Administration territoriale',
  "Administration territoriale de l'État": 'Administration territoriale',
  'Radicalités / Terrorisme': 'Radicalités et terrorisme',
}
export const domainLabel = d => DOMAIN_LABELS[d] || d



function Arrow() { return <span aria-hidden="true"> →</span> }

export default function Home({ data }) {
  const pubs = data.publications || []

  const go = parts => e => { e.preventDefault(); navigate(parts) }
  const [find, setFind] = useState('')

  return (
    <main className="home">
      <section className="home-hero" aria-labelledby="home-title">
        <p className="home-kicker">L’application compagne du bulletin de veille de l’IHEMI</p>
        <h1 id="home-title">Repérer l’essentiel des publications et le réutiliser dans vos travaux.</h1>
        <p className="home-count">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5V5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z" /></svg>
          {pubs.length} publications à ce jour · une dizaine ajoutée chaque mois
        </p>
        <p className="home-lead">Chaque information affichée renvoie à sa publication, à sa page et au passage source.</p>
        <div className="home-find">
          <form role="search" onSubmit={e => { e.preventDefault(); navigate(find.trim() ? ['publications', 'recherche', find.trim()] : ['publications']) }}>
            <input value={find} onChange={e => setFind(e.target.value)} placeholder="Chercher une publication : un sujet, un titre, un organisme…" aria-label="Chercher une publication" />
            <button type="submit">Chercher</button>
          </form>
          <p>Ou <a href="#/publications" onClick={go(['publications'])}>parcourir les {pubs.length} publications</a>, par thème, organisme, type ou année.</p>
        </div>
      </section>

      <section className="home-services" aria-label="Les services de l’application">
        <article className="home-service s-atlas">
          <p className="home-service-tab">Atlas des expertises ministérielles</p>
          <h2>Repérer les expertises du ministère que révèlent les publications.</h2>
          <a className="home-cta" href="#/atlas" onClick={go(['atlas'])}>Ouvrir l’Atlas<Arrow /></a>
        </article>

        <article className="home-service s-explorer">
          <p className="home-service-tab">Explorer une publication</p>
          <h2>Lire une publication autrement : voir d’un coup d’œil qui agit, face à quel problème, avec quelles réponses.</h2>
          <p className="home-service-lead">Chaque publication est mise à plat en idées clés reliées entre elles. Ce que la lecture page après page disperse devient visible.</p>
          <a className="home-cta" href="#/explorer" onClick={go(['explorer'])}>Explorer une publication<Arrow /></a>
        </article>

        <article className="home-service s-atelier">
          <p className="home-service-tab">Atelier de veille</p>
          <h2>Construire vos propres travaux avec une IA qui s’appuie uniquement sur les publications.</h2>
                    <p className="home-ai-note">Textes générés par IA, reliés aux passages sources : à relire et vérifier avant usage.</p>
          <a className="home-cta" href="#/atelier" onClick={go(['atelier'])}>Ouvrir l’Atelier<Arrow /></a>
        </article>

        <article className="home-service s-documents">
          <p className="home-service-tab">D’un document à l’autre</p>
          <h2>Voir les textes se recomposer sous vos yeux : en frise, en parcours, en arbre de lecture.</h2>
          <p className="home-service-lead">Explorez les liens entre les publications et leurs passages sources.</p>
          <ul className="home-links">
            <li><a href="#/documents/frise" onClick={go(['documents', 'frise'])}>Du texte à la frise</a></li>
            <li><a href="#/documents/notions" onClick={go(['documents', 'notions'])}>Suivre une notion</a></li>
            <li><a href="#/documents/recommandations" onClick={go(['documents', 'recommandations'])}>L’arbre des recommandations</a></li>
          </ul>
          <a className="home-cta" href="#/documents" onClick={go(['documents'])}>Ouvrir D’un document à l’autre<Arrow /></a>
        </article>
      </section>


      <section className="home-about" aria-label="La démarche">
        <div>
          <h2>D’où viennent ces contenus ?</h2>
          <p>Les publications du bulletin sont la référence : l’application aide à les lire, pas à les remplacer.</p>
        </div>
        <a className="home-cta light" href="#/a-propos" onClick={go(['a-propos'])}>À propos<Arrow /></a>
      </section>
    </main>
  )
}
