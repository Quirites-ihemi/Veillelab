import React from 'react'

export default function About() {
  return (
    <main className="page about-page">
      <section className="page-heading">
        <h1>À propos</h1>
      </section>
      <section className="about-text" style={{ maxWidth: 920, color: '#24455f' }}>
        <p style={{ margin: '0 0 16px' }}>La veille consiste à observer l’environnement d’une organisation pour comprendre les acteurs qui l’entourent et les dynamiques qui la concernent. Alliés, acteurs critiques, partenaires ponctuels ou durables : leurs positions et leurs relations évoluent selon les sujets et les circonstances.</p>
        <p style={{ margin: '0 0 16px' }}>Pour les acteurs publics, cette attention suppose aussi d’écouter les différentes composantes de la société afin de concevoir et de mettre en œuvre l’action publique avec les parties prenantes. Elle fait écho aux travaux de Francis Chateauraynaud, pour qui «&nbsp;la vigilance devient une compétence primordiale des acteurs, sans laquelle ils ne sauraient disposer de prises sur le monde&nbsp;» (<a style={{ color: '#1f4fe0', textDecoration: 'underline' }} href="https://doi.org/10.3406/polix.1998.1762" target="_blank" rel="noopener noreferrer">Francis Chateauraynaud, «&nbsp;La sociologie pragmatique à l’épreuve des risques. Exercice de crise sur le dossier nucléaire&nbsp;»</a>).</p>
        <p style={{ margin: '0 0 16px' }}>La veille éditoriale y contribue en donnant à voir ce qui se dit, par qui et avec quels moyens, sur un ensemble de thématiques. Chaque mois, le bulletin Quiritès rassemble les productions intellectuelles du ministère de l’Intérieur, qui éclairent et soutiennent l’activité opérationnelle, ainsi que celles d’organisations partenaires.</p>
        <p style={{ margin: '0 0 10px' }}>Cette veille poursuit trois objectifs&nbsp;:</p>
        <ul style={{ margin: '0 0 16px', paddingLeft: 22, lineHeight: 1.65 }}>
          <li style={{ marginBottom: 8 }}><strong>Rendre visibles les savoirs et les expertises.</strong> Au fil des mois et des années, les publications forment un corpus identifiable, révélant des expertises, des thématiques transversales et des sujets peu documentés. Leur mise en lumière contribue au travail d’influence du département.</li>
          <li style={{ marginBottom: 8 }}><strong>Prendre le pouls du débat public.</strong> À son échelle, le bulletin permet de suivre les préoccupations récurrentes, les approches qui se confrontent et les déplacements de l’attention.</li>
          <li><strong>Repérer les évolutions.</strong> L’observation des publications aide à discerner des tendances, des contre-tendances et des signes de nouveauté, pour mieux appréhender les phénomènes émergents.</li>
        </ul>
        <p style={{ margin: '0 0 16px' }}>Avec Quiritès Veille Lab, le département de l’influence met les résultats de cette veille au service de vos travaux&nbsp;: explorer les publications, questionner le corpus et mobiliser les connaissances qu’il rassemble.</p>
        <p style={{ margin: '0 0 16px' }}><strong>Bienvenue&nbsp;!</strong></p>
        <p style={{ margin: 0 }}>Pour tout contact&nbsp;: <a style={{ color: '#1f4fe0', textDecoration: 'underline' }} href="mailto:quirites@interieur.gouv.fr">quirites@interieur.gouv.fr</a></p>
      </section>
    </main>
  )
}
