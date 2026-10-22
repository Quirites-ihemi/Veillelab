// Informations légales du site. Les valeurs entre [crochets] sont À COMPLÉTER
// avant la mise en ligne publique : elles s'affichent surlignées tant qu'elles
// commencent par « [ ».
export const LEGAL = {
  editeur: 'Institut des hautes études du ministère de l’Intérieur (IHEMI)',
  adresseEditeur: '[Adresse postale de l’IHEMI]',
  directionPublication: '[Nom et fonction de la directrice ou du directeur de publication]',
  contactEmail: '[Adresse électronique de contact]',
  hebergementSite: 'GitHub Pages — GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis',
  hebergementIA: 'Google Cloud (Cloud Run), région europe-west9 (Paris) — [raison sociale du contractant à confirmer]',
  dpo: '[Coordonnées de la ou du délégué à la protection des données]',
  conservationQuestionsIA: '[Durée de conservation des questions envoyées aux fonctions d’IA]',
  dateDeclarationAccessibilite: '22 octobre 2026',
  dateMiseAJour: '22 octobre 2026',
}

export const isPlaceholder = v => typeof v === 'string' && v.trim().startsWith('[')
