import React from 'react'

// Texte de présentation de Quiritès Veille Lab, partagé par la page
// d'accueil, l'écran de présentation et le panneau du bouton « ? ».
// Si onNavigate est fourni, les noms d'onglets deviennent des liens.
export const PRESENTATION_WAYS = [
  {
    title: 'Explorer les expertises et les écosystèmes d’action',
    tabs: [['expertises', 'Atlas des expertises ministérielles'], ['explorer', 'Explorer une publication']],
    text: 'Les graphes de connaissances rendent visibles les savoirs et savoir-faire ministériels, les missions des acteurs internes et externes, ainsi que les relations documentées qui structurent cet écosystème.',
  },
  {
    title: 'Mobiliser et actionner les connaissances',
    tabs: [['atelier', 'Atelier de veille']],
    text: 'Grâce à l’interrogation du corpus en langage naturel, chacun peut rechercher des informations, confronter des approches et rassembler des éléments utiles pour comprendre une situation, approfondir une problématique ou préparer un travail.',
  },
  {
    title: 'Mettre les publications en perspective',
    tabs: [['documents', 'D’un document à l’autre']],
    text: 'La frise chronologique, le suivi des notions et l’arbre des recommandations ouvrent de nouvelles pistes de lecture et permettent d’élargir la réflexion au-delà d’une publication isolée.',
  },
]

function TabName({ id, label, onNavigate }) {
  if (!onNavigate) return <em className="qvl-pres-tabname">{label}</em>
  return <button type="button" className="qvl-pres-tablink" onClick={() => onNavigate(id)}>{label} <span aria-hidden="true">›</span></button>
}

export function PresentationIntro() {
  return <>
    <p>La lutte contre la criminalité organisée, la sécurité, le maintien de l’ordre public, les migrations, la gestion des crises, l’action publique territoriale ou encore les transformations numériques constituent autant de champs d’action, de recherche et de réflexion qui traversent les métiers du ministère de l’Intérieur et mobilisent de nombreux acteurs au-delà de son périmètre institutionnel.</p>
    <p>C’est à la rencontre de ces univers que se situe le bulletin de veille de Quiritès.</p>
    <p>En réunissant des publications issues du ministère de l’Intérieur et des travaux produits à l’extérieur, le bulletin poursuit deux ambitions complémentaires :</p>
    <ul className="qvl-pres-aims">
      <li><strong>Valoriser les expertises ministérielles</strong>, en mettant en lumière les savoirs, les savoir-faire et les travaux des services du ministère de l’Intérieur.</li>
      <li><strong>Donner à voir la richesse d’un écosystème d’acteurs</strong>, en accordant également une place aux productions de ceux qui contribuent aux missions du ministère (acteurs de la sécurité privée, associations de sécurité civile, acteurs de l’intégration et de la citoyenneté), ainsi qu’aux travaux des institutions et organismes de recherche qui éclairent ces domaines.</li>
    </ul>
  </>
}

export function PresentationLab({ onNavigate, motto = true }) {
  return <>
    <h3 className="qvl-pres-h3">Quiritès Veille Lab : de la connaissance à l’action</h3>
    <p>L’application prolonge cette démarche avec une ambition : faire des connaissances réunies par la veille un véritable appui à la réflexion et à l’action.</p>
    <p>Elle propose trois manières de mobiliser ces connaissances :</p>
    <div className="qvl-pres-ways">
      {PRESENTATION_WAYS.map((w, i) => <article key={w.title} className="qvl-pres-way">
        <span className="qvl-pres-num">{i + 1}</span>
        <h4>{w.title}</h4>
        <div className="qvl-pres-tabs">{w.tabs.map(([id, label]) => <TabName key={id} id={id} label={label} onNavigate={onNavigate}/>)}</div>
        <p>{w.text}</p>
      </article>)}
    </div>
    <p>L’onglet <TabName id="about" label="La veille à l’IHEMI" onNavigate={onNavigate}/> présente la démarche, la méthode, les sources et les usages de l’application.</p>
    <p className="qvl-pres-trust">Chaque résultat reste relié à la publication dont il est issu, et à la page ou au passage qui le fonde : on peut toujours revenir à la source. L’objectif n’est pas de penser ou de décider à la place de l’utilisateur, mais de lui donner les moyens de mobiliser les connaissances, de construire son propre raisonnement et d’éclairer ses choix.</p>
    <p>Au fil des éditions, le bulletin et son application compagne ont ainsi vocation à constituer une base de connaissances ouverte, durable et évolutive, accessible à tous ceux qui souhaitent mieux comprendre les enjeux des métiers du ministère de l’Intérieur et s’appuyer sur les travaux qui leur sont consacrés.</p>
    {motto && <p className="qvl-pres-motto">Le bulletin donne à lire. L’application donne matière à penser et à agir.</p>}
  </>
}

export const BULLETIN_URL = 'https://www.quirites.fr/actualites/veille'
