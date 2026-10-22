import React from 'react'
import { LEGAL, isPlaceholder } from '../legal.js'
import '../legal-pages.css'

function V({ value }) {
  return isPlaceholder(value) ? <mark className="legal-todo">{value}</mark> : <>{value}</>
}

function Page({ title, children }) {
  return (
    <main className="legal-page">
      <h1>{title}</h1>
      {children}
      <p className="legal-updated">Dernière mise à jour : {LEGAL.dateMiseAJour}</p>
    </main>
  )
}

export function MentionsLegales() {
  return (
    <Page title="Mentions légales">
      <h2>Éditeur</h2>
      <p><V value={LEGAL.editeur} /><br /><V value={LEGAL.adresseEditeur} /></p>
      <h2>Direction de la publication</h2>
      <p><V value={LEGAL.directionPublication} /></p>
      <h2>Hébergement</h2>
      <p>Site : <V value={LEGAL.hebergementSite} /></p>
      <p>Fonctions d’intelligence artificielle : <V value={LEGAL.hebergementIA} /></p>
      <h2>Contenus</h2>
      <p>Les publications présentées restent la propriété de leurs auteurs et éditeurs. Quiritès Veille Lab en propose une analyse documentaire et renvoie systématiquement aux sources originales, dont les liens sont indiqués pour chaque publication.</p>
      <p>Les textes produits par les fonctions d’intelligence artificielle sont générés à partir des publications du bulletin. Ils peuvent comporter des erreurs et doivent être vérifiés dans les passages sources cités.</p>
      <h2>Contact</h2>
      <p><V value={LEGAL.contactEmail} /></p>
    </Page>
  )
}

export function Accessibilite() {
  return (
    <Page title="Déclaration d’accessibilité">
      <p><V value={LEGAL.editeur} /> s’engage à rendre ses sites internet accessibles conformément à l’article 47 de la loi n° 2005-102 du 11 février 2005.</p>
      <p>Cette déclaration d’accessibilité s’applique au site Quiritès Veille Lab.</p>
      <h2>État de conformité</h2>
      <p>Quiritès Veille Lab est <strong>non conforme</strong> avec le référentiel général d’amélioration de l’accessibilité (RGAA) : aucun audit n’a encore été réalisé.</p>
      <h2>Contenus non accessibles connus</h2>
      <ul>
        <li>Les représentations graphiques interactives (Atlas des expertises, carte d’une publication, frise, parcours d’une notion) ne sont pas entièrement utilisables au clavier ni restituées par les lecteurs d’écran.</li>
        <li>Certains textes de couleur claire sur fond sombre peuvent présenter un contraste insuffisant.</li>
        <li>Les extraits des podcasts et du documentaire ne disposent pas tous de transcription.</li>
      </ul>
      <h2>Établissement de cette déclaration</h2>
      <p>Cette déclaration a été établie le {LEGAL.dateDeclarationAccessibilite}.</p>
      <h2>Retour d’information et contact</h2>
      <p>Si vous n’arrivez pas à accéder à un contenu ou à un service, vous pouvez nous contacter pour être orienté vers une alternative accessible ou obtenir le contenu sous une autre forme : <V value={LEGAL.contactEmail} />.</p>
      <h2>Voies de recours</h2>
      <p>Si vous constatez un défaut d’accessibilité vous empêchant d’accéder à un contenu ou à une fonctionnalité, que vous nous le signalez et que vous ne parvenez pas à obtenir une réponse rapide, vous êtes en droit de faire parvenir vos doléances ou une demande de saisine au Défenseur des droits :</p>
      <ul>
        <li>écrire un message au Défenseur des droits (formulaire en ligne sur defenseurdesdroits.fr) ;</li>
        <li>contacter le délégué du Défenseur des droits dans votre région ;</li>
        <li>envoyer un courrier par la poste (gratuit, ne pas mettre de timbre) : Défenseur des droits, Libre réponse 71120, 75342 Paris CEDEX 07.</li>
      </ul>
    </Page>
  )
}

export function DonneesPersonnelles() {
  return (
    <Page title="Données personnelles">
      <h2>Consultation du site</h2>
      <p>La consultation de Quiritès Veille Lab ne nécessite ni compte ni identification. Le site n’utilise ni cookie publicitaire ni outil de mesure d’audience.</p>
      <p>Pour le confort de navigation, le navigateur conserve temporairement, le temps de la session, quelques préférences (guide déjà consulté, travail en cours dans l’Atelier). Elles restent sur votre appareil et disparaissent à la fermeture de l’onglet.</p>
      <h2>Fonctions d’intelligence artificielle</h2>
      <p>Lorsque vous posez une question à une publication ou utilisez un outil de l’Atelier, votre question et les éléments sélectionnés sont transmis au service d’IA hébergé par <V value={LEGAL.hebergementIA} />, afin de produire la réponse.</p>
      <p>N’y saisissez pas de données personnelles ou sensibles. Durée de conservation : <V value={LEGAL.conservationQuestionsIA} />.</p>
      <h2>Vos droits</h2>
      <p>Vous disposez d’un droit d’accès, de rectification et d’effacement des données vous concernant. Pour l’exercer : <V value={LEGAL.dpo} />. Vous pouvez également adresser une réclamation à la CNIL (cnil.fr).</p>
    </Page>
  )
}

export function Contact() {
  return (
    <Page title="Contact">
      <p>Une question, une erreur repérée dans une publication ou un passage source, une suggestion ? Écrivez-nous : <V value={LEGAL.contactEmail} />.</p>
    </Page>
  )
}
