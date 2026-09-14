export const EXPLORER_GUIDE_SESSION_KEY='quirites_explorer_eclaireur_v1_seen'
export const EXPLORER_GUIDE_STEP_MS=15000

export const EXPLORER_GUIDE_STEPS={
  1:{
    title:'Explorer une publication',
    body:[
      ['Vous êtes dans l’espace d’exploration des publications. '],
      ['Ici, le contenu d’un texte est représenté sous la forme d’un ',{strong:'graphe de connaissances'},' : les informations importantes sont transformées en éléments reliés entre eux.']
    ],
    mode:'intro'
  },
  2:{
    title:'Les points',
    body:[
      [{strong:'Chaque point représente un élément repéré dans la publication'},' : un acteur, un problème, une idée, une recommandation, une localisation, un signal faible…'],
      [{strong:'Le graphe permet d’aborder la publication à partir d’un sujet'},' et de voir comment il s’articule, ou pas, avec d’autres sujets.']
    ],
    mode:'points'
  },
  3:{
    title:'Les liens ont un sens',
    body:[
      [{strong:'Les liens indiquent comment deux éléments sont reliés dans la publication.'}],
      ['Le ',{strong:'verbe inscrit sur le lien'},' précise cette relation : répond à, mobilise, contribue à, s’appuie sur…']
    ],
    mode:'links'
  },
  4:{
    title:'Explorer autrement',
    body:[
      [{strong:'Lire la publication permet d’en suivre le raisonnement. Le graphe permet de l’explorer autrement.'}],
      ['Vous pouvez partir d’un problème, d’un acteur ou d’une recommandation et suivre les relations qui vous intéressent.']
    ],
    mode:'path'
  },
  5:{
    title:'Changer de point de vue',
    body:[
      [{strong:'Chaque clic peut ouvrir une autre lecture du même texte.'}],
      ['En sélectionnant un nouvel élément, celui-ci devient votre nouveau point de départ et fait apparaître ses propres relations.']
    ],
    mode:'viewpoint'
  },
  6:{
    title:'Revenir à la preuve documentaire',
    body:[
      [{strong:'Chaque élément du graphe reste relié à sa source documentaire.'}],
      ['Vous pouvez vérifier la page ou le timecode qui justifie un élément ou une relation et, lorsque c’est disponible, consulter la preuve complète.']
    ],
    mode:'proof'
  },
  7:{
    title:'À vous d’explorer',
    body:[
      [{strong:'Vous savez maintenant comment utiliser ce graphe.'}],
      ['Sélectionnez un élément, suivez ses relations et revenez à la preuve documentaire lorsque vous souhaitez vérifier ce que vous voyez.'],
      ['L’Éclaireur reste disponible si vous avez besoin de vous repérer.']
    ],
    mode:'free'
  }
}

export function explorerGuideStep(step){
  return EXPLORER_GUIDE_STEPS[step] || EXPLORER_GUIDE_STEPS[7]
}
