import React, { useMemo } from 'react'
import { navigate } from '../lib/router.js'
import { ELIGIBLE_PUBLICATIONS, TRANSVERSAL_NOTIONS } from './CrossDocuments.jsx'
import '../home.css'

// Libellés d'affichage des domaines de la base (colonne « domaine »).
// Un domaine absent de cette table s'affiche tel quel.
export const DOMAIN_LABELS = {
  'Migrations/intégration': 'Migrations, intégration, citoyenneté',
  'Démocraties et sujets informationnels': 'Démocratie et information',
  "Administration territoriale de l'Etat": 'Administration territoriale',
  'Radicalités / Terrorisme': 'Radicalités et terrorisme',
}
export const domainLabel = d => DOMAIN_LABELS[d] || d

// Un thème devient une vignette à partir de ce nombre de publications ;
// en dessous, il est cité dans la ligne « Aussi ».
const MIN_TILE = 3
const TINTS = ['#e6edff', '#fde8ec', '#fbf3d9', '#ecebff', '#fff0e3', '#e3f7f1', '#e2f4fb', '#edf1f6']

function imageSrc(p) {
  const base = import.meta.env.BASE_URL || '/'
  const raw = String(p?.image_path || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  return `${base}${raw.replace(/^\.?\/+/, '')}`
}

const asset = name => `${import.meta.env.BASE_URL || '/'}images/accueil/${name}`

function Arrow() { return <span aria-hidden="true"> →</span> }

export default function Home({ data }) {
  const pubs = data.publications || []
  const expertiseCount = (data.expertise_nodes || []).length

  const themes = useMemo(() => {
    const byDomain = new Map()
    pubs.forEach(p => {
      const d = String(p.domaine || '').trim() || 'Autres'
      if (!byDomain.has(d)) byDomain.set(d, [])
      byDomain.get(d).push(p)
    })
    return [...byDomain.entries()]
      .map(([domain, list]) => ({
        domain,
        label: domainLabel(domain),
        count: list.length,
        covers: [...list]
          .filter(p => p.has_image !== false && p.image_path)
          .sort((a, b) => String(b.année_publication || '').localeCompare(String(a.année_publication || '')) || String(b.publication_id).localeCompare(String(a.publication_id)))
          .slice(0, 3),
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr'))
  }, [pubs])

  const tiles = themes.filter(t => t.count >= MIN_TILE)
  const others = themes.filter(t => t.count < MIN_TILE)
  const go = parts => e => { e.preventDefault(); navigate(parts) }

  return (
    <main className="home">
      <section className="home-hero" aria-labelledby="home-title">
        <p className="home-kicker">L’application compagne du bulletin de veille de l’IHEMI</p>
        <h1 id="home-title">Des publications sur la sécurité, analysées pour que vous puissiez les explorer, les relier et en tirer un travail.</h1>
        <p className="home-count">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5V5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z" /></svg>
          {pubs.length} publications à ce jour · une dizaine ajoutée chaque mois
        </p>
        <p className="home-lead">Chaque information affichée renvoie à sa publication, à sa page et au passage source. Voici ce que vous pouvez faire, onglet par onglet.</p>
      </section>

      <section className="home-corpus" aria-labelledby="home-corpus-title">
        <div className="home-section-head">
          <h2 id="home-corpus-title">Les publications en un coup d’œil</h2>
          <a href="#/explorer/publications" onClick={go(['explorer', 'publications'])}>Toutes les publications<Arrow /></a>
        </div>
        <div className="home-themes">
          {tiles.map((t, i) => (
            <a key={t.domain} className="home-theme" href={`#/explorer/theme/${encodeURIComponent(t.domain)}`} onClick={go(['explorer', 'theme', t.domain])}>
              <span className="home-theme-covers" style={{ background: TINTS[i % TINTS.length] }} aria-hidden="true">
                {t.covers.map(p => <img key={p.publication_id} src={imageSrc(p)} alt="" loading="lazy" />)}
              </span>
              <span className="home-theme-text">
                <strong>{t.label}</strong>
                <span>{t.count} publication{t.count > 1 ? 's' : ''}</span>
              </span>
            </a>
          ))}
        </div>
        {others.length > 0 && (
          <p className="home-others">Aussi :{' '}
            {others.map((t, i) => (
              <React.Fragment key={t.domain}>
                {i > 0 && ' · '}
                <a href={`#/explorer/theme/${encodeURIComponent(t.domain)}`} onClick={go(['explorer', 'theme', t.domain])}>{t.label}</a> ({t.count})
              </React.Fragment>
            ))}
          </p>
        )}
      </section>

      <section className="home-services" aria-label="Les services de l’application">
        <article className="home-service s-atlas">
          <img src={asset('atlas.jpg')} alt="Capture de l’Atlas : constellations d’expertises regroupées en familles" loading="lazy" />
          <p className="home-service-tab">Atlas des expertises ministérielles</p>
          <h2>Repérer les expertises du ministère que révèlent les publications.</h2>
          <ul>
            <li>Parcourir la carte des {expertiseCount} expertises, regroupées en familles.</li>
            <li>Filtrer par direction ou service, et par type : problème public, méthode, instrument.</li>
            <li>Ouvrir une fiche : définition, expertises voisines, publications qui en témoignent.</li>
          </ul>
          <a className="home-cta" href="#/atlas" onClick={go(['atlas'])}>Ouvrir l’Atlas<Arrow /></a>
        </article>

        <article className="home-service s-explorer">
          <img src={asset('explorer.jpg')} alt="Capture de l’explorateur : les idées clés d’une publication reliées entre elles, avec le passage source" loading="lazy" />
          <p className="home-service-tab">Explorer une publication</p>
          <h2>Lire une publication autrement : voir d’un coup d’œil qui agit, face à quel problème, avec quelles réponses.</h2>
          <p className="home-service-lead">Chaque publication est mise à plat en idées clés reliées entre elles. Ce que la lecture page après page disperse devient visible.</p>
          <ul>
            <li>Saisir l’architecture d’un texte : problèmes, acteurs, actions, recommandations et tendances.</li>
            <li>Suivre les liens plutôt que les pages : à quel problème répond une recommandation, qui la porte, ce qui y contribue.</li>
            <li>Retrouver pour chaque idée sa page, ou son timecode, et le passage source.</li>
            <li>Poser une question (IA) à la publication. Réponse générée par IA, à vérifier dans les passages cités.</li>
          </ul>
          <a className="home-cta" href="#/explorer" onClick={go(['explorer'])}>Explorer une publication<Arrow /></a>
        </article>

        <article className="home-service s-atelier">
          <img className="contain" src={asset('atelier.jpg')} alt="Capture de l’Atelier : la liste des six outils et la présentation de l’un d’eux" loading="lazy" />
          <p className="home-service-tab">Atelier de veille</p>
          <h2>Produire un travail de veille à partir des publications, avec l’aide de l’IA.</h2>
          <p className="home-service-lead">Six outils, de la synthèse d’une publication à la construction d’un scénario :</p>
          <div className="home-chips">
            <span>Résumé analytique</span><span>Glossaire</span><span>Extraction de recommandations</span><span>Experts ministériels</span><span>Scénario de veille</span><span>Avancer avec le corpus</span>
          </div>
          <p className="home-ai-note">Textes générés par IA, reliés aux passages sources : à relire et vérifier avant usage.</p>
          <a className="home-cta" href="#/atelier" onClick={go(['atelier'])}>Ouvrir l’Atelier<Arrow /></a>
        </article>

        <article className="home-service s-documents">
          <img src={asset('frise.jpg')} alt="Capture de la frise : les repères datés d’une publication, chacun relié à sa page" loading="lazy" />
          <p className="home-service-tab">D’un document à l’autre</p>
          <h2>Voir les textes se recomposer sous vos yeux : en frise, en parcours, en arbre de lecture.</h2>
          <p className="home-service-lead">Une approche expérimentale : l’interface fait émerger ce que contiennent les publications, sans jamais perdre le passage source.</p>
          <ul className="home-status-list">
            <li><span className="status beta">Bêta</span><span><a href="#/documents/frise" onClick={go(['documents', 'frise'])}><strong>Du texte à la frise</strong></a> : la trame temporelle d’une publication apparaît, dates, jalons et tendances, chaque repère relié à son passage ({ELIGIBLE_PUBLICATIONS.length} publications).</span></li>
            <li><span className="status beta">Bêta</span><span><a href="#/documents/notions" onClick={go(['documents', 'notions'])}><strong>Suivre une notion</strong></a> : une notion passe d’une publication à l’autre ({TRANSVERSAL_NOTIONS.length} notions).</span></li>
            <li><span className="status ok">Disponible</span><span><a href="#/documents/recommandations" onClick={go(['documents', 'recommandations'])}><strong>L’arbre des recommandations</strong></a> : à partir d’une publication, ses fils de lecture se séparent en publications liées et en pistes pour aller plus loin (toutes les publications).</span></li>
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
