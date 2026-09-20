import React, { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { searchCorpus, analyzeScenarioFraming } from '../services/reflectionApi.js'
import { exportScenarioWord, exportScenarioExcel } from '../utils/scenarioExport.js'
import scenarioHero from '../header-corpus-securite.png'
import './scenario-workspace.css'

const STEPS = [
  { id: 1, label: 'Formulation du besoin' },
  { id: 2, label: 'Objets de veille' },
  { id: 3, label: 'Tendances et signaux' },
  { id: 4, label: 'Prévisualisation et génération' },
]

const OBJECT_TYPE_LABELS = {
  acteur: 'Acteur',
  expert_public: 'Acteur',
  localisation: 'Territoire',
  instrument_dispositif: 'Dispositif',
  action: 'Action / dispositif',
  probleme: 'Problème',
  notion_idee: 'Notion',
  recommandation: 'Réponse publique',
  methode: 'Méthode',
}

const FORMULATION_NODE_TYPES = new Set(['notion_idee'])
const OBJECT_NODE_TYPES = new Set(['acteur', 'expert_public', 'localisation', 'instrument_dispositif', 'action', 'probleme', 'recommandation'])
const DYNAMIC_INTENT_WORDS = /(evolution|perspective|avenir|futur|tendance|changement|emerg)/i

const CHANGE_WORDS = /(émerg|evolu|évolu|hausse|baisse|augmentation|diminution|apparition|diffusion|renforcement|accélération|acceleration|mutation|nouveau|nouvelle|croissan|recul|essor|développement|developpement|progression|déplacement|deplacement)/i

const SCENARIO_BOILERPLATE_WORDS = new Set([
  'souhaite','souhaiter','souhaitons','voudrais','voudrait','veux','veut','faire','mettre','mieux',
  'veille','suivi','surveillance','suivre','surveiller','observer','observation','comprendre','analyser','analyse',
  'evolution','evolutions','perspective','perspectives','avenir','futur','future','tendance','tendances',
  'changement','changements','signal','signaux','faible','faibles','emergence','emergent','emergents',
  'sujet','besoin','question','theme','domaine','matiere','enjeu','enjeux','particulier','particuliere',
  'particulierement','notamment','vise','viser','visant','concerne','concernant','autour','focus',
  'acteur','acteurs','action','actions','reponse','reponses','dispositif','dispositifs','source','sources',
  'lutte','contre','leurs','notre','votre','recente','recentes','recent','recents','nouveau','nouveaux','nouvelle','nouvelles',
  'bon','bonne','bons','bonnes','pratique','pratiques',
  'echelle','niveau','local','locale','locaux','locales','communal','communale','communaux','communales',
  'territorial','territoriale','territoriaux','territoriales','regional','regionale','regionaux','regionales'
])

const SCENARIO_CONTEXT_WORDS = new Set([
  'commune','communes','collectivite','collectivites','francilien','francilienne','franciliens','franciliennes',
  'france','europe','europeen','europeenne','europeens','europeennes','departement','departements',
  'region','regions','ville','villes','rural','rurale','ruraux','rurales','urbain','urbaine','urbains','urbaines',
  'public','publique','publics','publiques','prive','privee','prives','privees'
])

function scenarioWords(value='') {
  return normalize(value).split(' ').filter(Boolean)
}

function simpleStem(token='') {
  let value = normalize(token)
  if (value.length > 7 && value.endsWith('es')) value = value.slice(0, -2)
  else if (value.length > 6 && value.endsWith('s')) value = value.slice(0, -1)
  if (value.length > 7 && value.endsWith('e')) value = value.slice(0, -1)
  return value
}

function extractScenarioSearchProfile(value='') {
  const normalized = normalize(value)
  if (!normalized) return { query: '', anchors: [], context: [] }

  // On cherche d'abord le cœur du besoin, avant les précisions de périmètre.
  let core = normalized
  const veillePos = core.search(/\bveille\b/)
  if (veillePos >= 0) core = core.slice(veillePos + 'veille'.length).trim()
  core = core.replace(/^(?:sur|de|du|des|la|le|les|l|une|un)\s+/, '')
  core = core.split(/\b(?:a l echelle|au niveau|en particulier|particulierement|notamment|sur le territoire|dans|pour|afin de|visant|concerne|concernant)\b/)[0].trim()

  const all = scenarioWords(normalized).filter(t => t.length >= 4)
  let anchors = scenarioWords(core)
    .filter(t => t.length >= 5 && !SCENARIO_BOILERPLATE_WORDS.has(t) && !SCENARIO_CONTEXT_WORDS.has(t))

  if (!anchors.length) {
    anchors = all.filter(t => t.length >= 5 && !SCENARIO_BOILERPLATE_WORDS.has(t) && !SCENARIO_CONTEXT_WORDS.has(t))
  }

  anchors = [...new Set(anchors)].slice(0, 3)
  const anchorSet = new Set(anchors)
  const context = [...new Set(all.filter(t => !anchorSet.has(t) && !SCENARIO_BOILERPLATE_WORDS.has(t)))]
    .filter(t => SCENARIO_CONTEXT_WORDS.has(t) || t.length >= 7)
    .slice(0, 3)

  const queryTokens = [...anchors, ...context]
  return {
    query: queryTokens.length ? queryTokens.join(' ') : normalized,
    anchors,
    context,
    normalized,
  }
}

function resultSearchText(result={}) {
  return normalize([
    result.publication_title, result.section, result.text, result.label,
    result.source_label, result.target_label, result.organisme_producteur, result.domaine
  ].filter(Boolean).join(' '))
}

function resultMatchesScenarioTopic(result, anchors=[]) {
  if (!anchors.length) return true
  const words = resultSearchText(result).split(' ').filter(Boolean)
  return anchors.some(anchor => {
    const stem = simpleStem(anchor)
    if (stem.length < 5) return words.includes(anchor)
    return words.some(word => {
      const wordStem = simpleStem(word)
      return wordStem === stem || wordStem.startsWith(stem) || stem.startsWith(wordStem)
    })
  })
}

function tokenFamilyMatch(haystack, token) {
  const normalizedHaystack = normalize(haystack)
  const words = normalizedHaystack.split(' ').filter(Boolean)
  const normalizedToken = normalize(token)
  const stem = simpleStem(normalizedToken)

  if (normalizedToken.startsWith('commun')) return words.some(word => word.startsWith('commun') || word.startsWith('municip'))
  if (normalizedToken.startsWith('collectivit')) return words.some(word => word.startsWith('collectivit'))
  if (normalizedToken.startsWith('francilien')) return /\bile de france\b/.test(normalizedHaystack) || words.some(word => word.startsWith('francilien'))

  return words.some(word => {
    const wordStem = simpleStem(word)
    if (wordStem === stem) return true
    if (wordStem.length < 6 || stem.length < 6) return false
    return wordStem.startsWith(stem) || stem.startsWith(wordStem)
  })
}

function filterScenarioResults(results=[], anchors=[]) {
  return results.filter(result => resultMatchesScenarioTopic(result, anchors))
}

function rankScenarioResults(results=[], anchors=[], context=[]) {
  return [...results].sort((a, b) => {
    const textA = resultSearchText(a)
    const textB = resultSearchText(b)
    const anchorA = anchors.filter(token => tokenFamilyMatch(textA, token)).length
    const anchorB = anchors.filter(token => tokenFamilyMatch(textB, token)).length
    const contextA = context.filter(token => tokenFamilyMatch(textA, token)).length
    const contextB = context.filter(token => tokenFamilyMatch(textB, token)).length
    const scoreA = contextA * 100 + anchorA * 20 + Number(a.score || 0)
    const scoreB = contextB * 100 + anchorB * 20 + Number(b.score || 0)
    return scoreB - scoreA
  })
}

const FORMULATION_CATEGORY_BONUS = {
  acteur: 18,
  expert_public: 18,
  instrument_dispositif: 22,
  action: 22,
  probleme: 16,
  localisation: 16,
  notion_idee: 12,
  recommandation: 12,
  methode: 8,
}

const CONTEXT_READABLE = [
  { match: /\b(commune|communes|communal|communale|communaux|communales|municipal|municipale|municipaux|municipales)\b/i, label: "l’échelle communale" },
  { match: /\b(francilien|francilienne|franciliens|franciliennes|ile de france)\b/i, label: "le périmètre francilien / Île-de-France" },
  { match: /\b(collectivite|collectivites|territorial|territoriale|territoriaux|territoriales)\b/i, label: "l’échelle des collectivités territoriales" },
  { match: /\b(departement|departements|departemental|departementale|departementaux|departementales)\b/i, label: "l’échelle départementale" },
  { match: /\b(region|regions|regional|regionale|regionaux|regionales)\b/i, label: "l’échelle régionale" },
  { match: /\b(europe|europeen|europeenne|europeens|europeennes|union europeenne)\b/i, label: "le périmètre européen" },
]

function directResultText(result={}) {
  if (result.kind === 'chunk') return normalize([result.section, result.text].filter(Boolean).join(' '))
  if (result.kind === 'node') return normalize([result.label, result.normalized_label].filter(Boolean).join(' '))
  if (result.kind === 'relation') return normalize([result.source_label, result.relation_type, result.target_label].filter(Boolean).join(' '))
  return ''
}

function publicationResultText(result={}) {
  return normalize([result.publication_title, result.organisme_producteur, result.domaine].filter(Boolean).join(' '))
}

function tokenFamilyCount(haystack, token) {
  const words = normalize(haystack).split(' ').filter(Boolean)
  const normalizedToken = normalize(token)
  const stem = simpleStem(normalizedToken)
  if (!normalizedToken || !stem) return 0
  if (normalizedToken.startsWith('commun')) return words.filter(word => word.startsWith('commun') || word.startsWith('municip')).length
  if (normalizedToken.startsWith('collectivit')) return words.filter(word => word.startsWith('collectivit')).length
  if (normalizedToken.startsWith('francilien')) return words.filter(word => word.startsWith('francilien')).length + (normalize(haystack).includes('ile de france') ? 1 : 0)
  return words.filter(word => {
    const wordStem = simpleStem(word)
    if (wordStem === stem) return true
    if (wordStem.length < 6 || stem.length < 6) return false
    return wordStem.startsWith(stem) || stem.startsWith(wordStem)
  }).length
}

function relevanceAssessment(result, profile) {
  const anchors = profile?.anchors || []
  const context = profile?.context || []
  const direct = directResultText(result)
  const publication = publicationResultText(result)

  let topicStrength = 0
  const matchedAnchors = []
  anchors.forEach(anchor => {
    const directCount = tokenFamilyCount(direct, anchor)
    const publicationCount = tokenFamilyCount(publication, anchor)
    if (directCount > 0) matchedAnchors.push(anchor)
    if (directCount >= 2) topicStrength += 4
    else if (directCount === 1) topicStrength += 3
    else if (publicationCount > 0) topicStrength += 1
  })

  const directContext = context.filter(token => tokenFamilyCount(direct, token) > 0)
  const publicationContext = context.filter(token => !directContext.includes(token) && tokenFamilyCount(publication, token) > 0)
  const contextStrength = directContext.length * 3 + publicationContext.length
  const categoryBonus = result.kind === 'node' ? (FORMULATION_CATEGORY_BONUS[result.node_type] || 6) : result.kind === 'relation' ? 8 : 4

  // Un titre de publication pertinent ne suffit pas : la proposition elle-même
  // doit documenter le sujet central. C'est le garde-fou contre les faux positifs
  // issus de mots secondaires comme « commune », « territoire » ou « évolution ».
  const directTopic = matchedAnchors.length > 0
  const strongTopic = topicStrength >= 3 && directTopic
  const strongContext = context.length === 0 || directContext.length > 0
  const score = topicStrength * 100 + contextStrength * 25 + categoryBonus + Number(result.score || 0)

  return {
    eligible: strongTopic,
    tier: strongTopic && strongContext ? 'strong' : strongTopic ? 'broader' : 'reject',
    score,
    matchedAnchors,
    directContext,
    publicationContext,
  }
}

function readableContextMatches(result, profile) {
  const text = `${directResultText(result)} ${publicationResultText(result)}`
  const labels = CONTEXT_READABLE.filter(rule => rule.match.test(text)).map(rule => rule.label)
  // On ne garde que les dimensions effectivement demandées dans le besoin.
  const requested = new Set()
  const contextText = normalize((profile?.context || []).join(' '))
  CONTEXT_READABLE.forEach(rule => { if (rule.match.test(contextText)) requested.add(rule.label) })
  return labels.filter(label => requested.size === 0 || requested.has(label))
}

function requestedContextLabels(profile={}) {
  const needText = profile.normalized || ''
  return CONTEXT_READABLE.filter(rule => rule.match.test(needText)).map(rule => rule.label)
}

function whyThisResult(result, profile, assessment) {
  const contexts = readableContextMatches(result, profile)
  const requestedContexts = requestedContextLabels(profile)
  const central = (profile?.anchors || []).slice(0, 2).join(' / ')
  const label = String(result.label || '').trim()

  let why = central
    ? `Cette notion est directement reliée au sujet central « ${central} » dans le corpus.`
    : 'Cette notion est directement reliée au sujet formulé dans votre besoin.'

  if (contexts.length) {
    why += ` Elle peut vous aider à préciser ${contexts.slice(0, 2).join(' et ')} à travers la notion « ${label} ».`
  } else {
    why += ` Elle peut vous aider à préciser l’angle de cadrage « ${label} » avant de choisir les objets à surveiller.`
  }

  const limits = []
  const missingContexts = requestedContexts.filter(ctx => !contexts.includes(ctx))
  if (missingContexts.length) {
    limits.push(`elle ne documente pas explicitement ${missingContexts.slice(0, 2).join(' ni ')}`)
  }
  if (DYNAMIC_INTENT_WORDS.test(profile?.normalized || '') && !CHANGE_WORDS.test(label)) {
    limits.push("elle ne renseigne pas directement l’évolution du phénomène")
  }
  if (!limits.length) {
    limits.push("cette notion aide au cadrage du besoin ; elle ne constitue pas, à elle seule, une tendance ni un objet de veille")
  }

  return {
    why,
    limit: `Limite : ${limits.join(' ; ')}.`,
  }
}

function buildFormulationItems(results=[], profile={}) {
  const assessed = results
    .filter(result => result.kind === 'node' && FORMULATION_NODE_TYPES.has(result.node_type))
    .map(result => ({ result, assessment: relevanceAssessment(result, profile) }))
    .filter(entry => entry.assessment.eligible)
    .sort((a, b) => b.assessment.score - a.assessment.score)

  const strong = assessed.filter(entry => entry.assessment.tier === 'strong')
  const broader = assessed.filter(entry => entry.assessment.tier === 'broader')
  const selected = strong.slice(0, 4)
  if (selected.length < 3) selected.push(...broader.slice(0, Math.min(2, 4 - selected.length)))

  return dedupe(selected.map(({ result, assessment }) => {
    const rationale = whyThisResult(result, profile, assessment)
    return {
      ...resultToItem(result, 'Notion'),
      why: rationale.why,
      limit: rationale.limit,
      matchTier: assessment.tier,
    }
  })).slice(0, 4)
}

function normalize(value='') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function clip(text, max=260) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  if (value.length <= max) return value
  return `${value.slice(0, max).replace(/\s+\S*$/, '')}…`
}

function sentenceTitle(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  if (!value) return 'Élément documentaire'
  const first = value.split(/(?<=[.!?])\s+/)[0]
  return clip(first, 120)
}

function resultSource(result) {
  return {
    publication_id: result.publication_id || '',
    title: result.publication_title || result.publication_id || 'Source',
    organisation: result.organisme_producteur || '',
    year: result.annee_publication || '',
    locator: result.locator || result.page_debut || '',
    url: result.url_contenu || result.url_source || '',
    provenance: result.provenance_level || '',
    chunk_id: result.chunk_id || result.chunk_id_source || '',
  }
}

function resultToItem(result, forcedCategory='') {
  const source = resultSource(result)
  if (result.kind === 'node') {
    return {
      id: result.result_id,
      category: forcedCategory || OBJECT_TYPE_LABELS[result.node_type] || 'Élément du corpus',
      nodeType: result.node_type || '',
      title: result.label || 'Élément du corpus',
      summary: result.publication_title ? `Élément structuré dans ${result.publication_title}.` : '',
      text: result.label || '',
      source,
      origin: 'corpus',
      raw: result,
    }
  }
  if (result.kind === 'relation') {
    return {
      id: result.result_id,
      category: forcedCategory || 'Relation documentée',
      nodeType: '',
      title: `${result.source_label || result.source_id} — ${result.relation_type || 'LIEN'} — ${result.target_label || result.target_id}`,
      summary: 'Relation structurée dans le graphe de connaissances.',
      text: `${result.source_label || ''} ${result.relation_type || ''} ${result.target_label || ''}`.trim(),
      source,
      origin: 'corpus',
      raw: result,
    }
  }
  return {
    id: result.result_id,
    category: forcedCategory || 'Élément documentaire',
    nodeType: '',
    title: result.section ? result.section : sentenceTitle(result.text),
    summary: clip(result.text, 280),
    text: result.text || '',
    source,
    origin: 'corpus',
    raw: result,
  }
}

function framingNotionToItem(notion={}) {
  const sources = (Array.isArray(notion.sources) ? notion.sources : []).map(source => ({
    publication_id: source.publication_id || '',
    title: source.titre || source.publication_id || 'Source',
    organisation: source.organisme_producteur || '',
    year: source.annee_publication || '',
    locator: source.repere || '',
    url: source.url || '',
    provenance: source.provenance_level || '',
    chunk_id: source.material_id || '',
    excerpt: source.extrait || '',
    material_id: source.material_id || '',
  }))
  return {
    id: notion.notion_id || `notion:${normalize(notion.label || '')}`,
    category: 'Notion',
    nodeType: 'notion_idee',
    title: notion.label || 'Notion de cadrage',
    summary: '',
    text: notion.label || '',
    why: notion.pourquoi || '',
    limit: notion.limite || '',
    dimension: notion.dimension_eclairee || '',
    level: notion.niveau || '',
    synthesized: true,
    source: sources[0] || {},
    sources,
    origin: 'corpus',
    raw: notion,
  }
}

function dedupe(items=[]) {
  const out = []
  const seen = new Set()
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

function sourceUrl(source) {
  const raw = String(source?.url || '').trim()
  if (!raw) return ''
  if (/\.pdf(?:$|[?#])/i.test(raw) && /^\d+$/.test(String(source?.locator || '').trim())) {
    return `${raw.split('#')[0]}#page=${source.locator}`
  }
  return raw
}

function sourceLabel(source) {
  const parts = [source.title, source.organisation, source.year].filter(Boolean)
  if (source.locator) parts.push(`repère ${source.locator}`)
  return parts.join(' · ')
}

function ProposalCard({ item, retained, discarded, reformulation, onRetain, onDiscard, onReformulate }) {
  const sources = item.sources?.length ? item.sources : (item.source?.title ? [item.source] : [])
  return <article className={`qvl-scn-card qvl-scn-formulation-card ${retained ? 'retained' : ''} ${discarded ? 'discarded' : ''}`}>
    <div className="qvl-scn-card-top">
      <span className="qvl-scn-type">{item.category}</span>
      <span className="qvl-scn-origin">{item.synthesized ? 'Synthèse du corpus' : 'Corpus'}</span>
    </div>
    <h3>{item.title}</h3>
    <div className="qvl-scn-why">
      <strong>Pourquoi cette notion est proposée</strong>
      <p>{item.why || 'Cette notion aide à préciser une dimension de votre besoin de veille.'}</p>
      {item.limit && <p className="qvl-scn-limit"><strong>Limite :</strong> {item.limit.replace(/^Limite\s*:\s*/i, '')}</p>}
    </div>
    {sources.length > 0 && <details className="qvl-scn-detail"><summary>Voir les matériaux sources ({sources.length})</summary>
      <div className="qvl-scn-source-list">{sources.map((source, index) => {
        const href = sourceUrl(source)
        return <div className="qvl-scn-source qvl-scn-source-item" key={`${source.material_id || source.publication_id || index}-${index}`}>
          <span className="qvl-scn-source-label">Source {sources.length > 1 ? index + 1 : ''}</span>
          <strong>{sourceLabel(source)}</strong>
          {source.provenance && <span>provenance {source.provenance}</span>}
          {source.excerpt && <p>{clip(source.excerpt, 360)}</p>}
          {href && <a href={href} target="_blank" rel="noreferrer"><Icon name="external" size={14}/> Ouvrir la source</a>}
        </div>
      })}</div>
    </details>}
    <div className="qvl-scn-card-actions">
      <button type="button" className={retained ? 'active' : ''} onClick={() => onRetain(item.id)}>{retained ? '✓ Retenu' : 'Retenir'}</button>
      {onReformulate && <button type="button" className={reformulation ? 'active' : ''} onClick={() => onReformulate(item.id)}>{reformulation ? '✓ Mobilisé pour préciser' : 'Utiliser pour préciser mon besoin'}</button>}
      <button type="button" className={discarded ? 'danger active' : 'danger'} onClick={() => onDiscard(item.id)}>{discarded ? 'Écarté' : 'Écarter'}</button>
    </div>
  </article>
}

function SelectionCard({ item, retained, onToggle }) {
  const href = sourceUrl(item.source)
  return <article className={`qvl-scn-select-card ${retained ? 'retained' : ''}`}>
    <div className="qvl-scn-card-top"><span className="qvl-scn-type">{item.category}</span><span className="qvl-scn-origin">Corpus</span></div>
    <h3>{item.title}</h3>
    {item.summary && <p>{item.summary}</p>}
    <div className="qvl-scn-source"><strong>{sourceLabel(item.source)}</strong>{href && <a href={href} target="_blank" rel="noreferrer"><Icon name="external" size={14}/> Source</a>}</div>
    <button type="button" className={`qvl-scn-retain ${retained ? 'active' : ''}`} onClick={() => onToggle(item.id)}>{retained ? '✓ Retenu' : 'Retenir'}</button>
  </article>
}

function buildQuestions(need, objects) {
  const out = []
  const main = String(need || '').trim()
  if (main) out.push(main.endsWith('?') ? main : `Comment suivre les évolutions liées à : ${main.replace(/[.]+$/, '')} ?`)
  objects.slice(0, 4).forEach(item => out.push(`Que faut-il surveiller concernant « ${item.title} » ?`))
  return [...new Set(out)].slice(0, 5)
}

function groupSelected(items, selectedSet) {
  return items.filter(item => selectedSet.has(item.id))
}

export default function ScenarioWorkspace({ data, onBack }) {
  const [step, setStep] = useState(1)
  const [need, setNeed] = useState('')
  const [workingNeed, setWorkingNeed] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [framing, setFraming] = useState(null)
  const [generalResults, setGeneralResults] = useState([])
  const [nodeResults, setNodeResults] = useState([])
  const [trendResults, setTrendResults] = useState([])
  const [signalResults, setSignalResults] = useState([])
  const [retained, setRetained] = useState(new Set())
  const [discarded, setDiscarded] = useState(new Set())
  const [reformulationRefs, setReformulationRefs] = useState(new Set())
  const [finalized, setFinalized] = useState(false)
  const [searchProfile, setSearchProfile] = useState({ query: '', anchors: [], context: [] })

  const activeNeed = workingNeed.trim() || need.trim()

  const espasMethodItem = useMemo(() => ({
    id: 'enrichment:espas-horizon',
    title: 'ESPAS Horizon Scanning — communauté des veilleurs de l’Union européenne',
    summary: 'Repère méthodologique externe pour la lecture des tendances et des changements émergents.',
    source: { title: 'ESPAS Horizon', organisation: 'European Strategy and Policy Analysis System', url: 'https://espas.eu/horizon.html' },
  }), [])

  const runSearch = async () => {
    const userNeed = need.trim()
    if (!userNeed || loading) return
    setLoading(true)
    setError('')
    setFinalized(false)
    try {
      // Étape 1 : un cadrage sémantique dédié T06 décompose le besoin sans le
      // reformuler, puis sélectionne/audite les notions réellement utiles.
      const framingResult = await analyzeScenarioFraming(userNeed)
      const query = framingResult?.analysis?.requete_recherche || framingResult?.analysis?.sujet_central || userNeed
      const profile = extractScenarioSearchProfile(query)
      setSearchProfile(profile)

      // Les étapes 2 et 3 continuent d'utiliser le moteur global, mais sur le
      // sujet central identifié par T06 : les précisions de périmètre ne sont
      // plus des conditions bloquantes de récupération.
      const [general, nodes, trends, signals] = await Promise.all([
        searchCorpus(query, { limit: 24, maxPerPublication: 4 }),
        searchCorpus(query, { kinds: ['node'], limit: 42, maxPerPublication: 6 }),
        searchCorpus(`${query} tendance évolution émergence`, { kinds: ['node', 'chunk'], limit: 36, maxPerPublication: 5 }),
        searchCorpus(`${query} signal faible signe de changement`, { kinds: ['node', 'chunk'], limit: 36, maxPerPublication: 5 }),
      ])

      const filteredGeneral = rankScenarioResults(filterScenarioResults(general?.results || [], profile.anchors), profile.anchors, profile.context)
      const filteredNodes = rankScenarioResults(filterScenarioResults(nodes?.results || [], profile.anchors), profile.anchors, profile.context)
      const filteredTrends = rankScenarioResults(filterScenarioResults(trends?.results || [], profile.anchors), profile.anchors, profile.context)
      const filteredSignals = rankScenarioResults(filterScenarioResults(signals?.results || [], profile.anchors), profile.anchors, profile.context)

      setFraming(framingResult)
      setGeneralResults(filteredGeneral)
      setNodeResults(filteredNodes)
      setTrendResults(filteredTrends)
      setSignalResults(filteredSignals)
      setWorkingNeed(userNeed)
      setRetained(new Set())
      setDiscarded(new Set())
      setReformulationRefs(new Set())
      setSearched(true)
      setStep(1)
    } catch (e) {
      setError(e?.message || String(e))
      setFraming(null)
    } finally {
      setLoading(false)
    }
  }

  const formulationCorpusItems = useMemo(() => (framing?.notions || []).map(framingNotionToItem), [framing])

  const formulationItems = formulationCorpusItems

  const objectItems = useMemo(() => {
    const allowed = nodeResults
      .filter(r => OBJECT_NODE_TYPES.has(r.node_type))
      .map(r => resultToItem(r))
    // Les notions de cadrage restent des notions : elles ne deviennent pas
    // automatiquement des objets de veille à l'étape suivante.
    return dedupe(allowed).slice(0, 18)
  }, [nodeResults])

  const trendItems = useMemo(() => dedupe([
    ...nodeResults.filter(r => r.node_type === 'tendance').map(r => resultToItem(r, 'Tendance')),
    ...trendResults.filter(r => r.kind === 'node' && r.node_type === 'tendance').map(r => resultToItem(r, 'Tendance')),
  ]).slice(0, 10), [nodeResults, trendResults])

  const weakSignalItems = useMemo(() => dedupe([
    ...nodeResults.filter(r => r.node_type === 'signal_faible').map(r => resultToItem(r, 'Signal faible')),
    ...signalResults.filter(r => r.kind === 'node' && r.node_type === 'signal_faible').map(r => resultToItem(r, 'Signal faible')),
  ]).slice(0, 10), [nodeResults, signalResults])

  const changeItems = useMemo(() => {
    const excluded = new Set([...trendItems, ...weakSignalItems].map(i => i.id))
    const raw = dedupe([...trendResults, ...signalResults]
      .filter(r => !excluded.has(r.result_id))
      .filter(r => {
        const text = r.kind === 'chunk' ? r.text : r.kind === 'node' ? r.label : `${r.source_label} ${r.relation_type} ${r.target_label}`
        return CHANGE_WORDS.test(text || '')
      })
      .map(r => resultToItem(r, 'Signe de changement')))
    return raw.slice(0, 10)
  }, [trendResults, signalResults, trendItems, weakSignalItems])

  const selectedObjects = useMemo(() => groupSelected(objectItems, retained), [objectItems, retained])
  const selectedTrends = useMemo(() => groupSelected(trendItems, retained), [trendItems, retained])
  const selectedChanges = useMemo(() => groupSelected(changeItems, retained), [changeItems, retained])
  const selectedWeakSignals = useMemo(() => groupSelected(weakSignalItems, retained), [weakSignalItems, retained])
  const selectedFormulation = useMemo(() => formulationItems.filter(i => retained.has(i.id)), [formulationItems, retained])

  const toggleRetain = id => {
    setRetained(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
    setDiscarded(prev => { const next = new Set(prev); next.delete(id); return next })
    setFinalized(false)
  }
  const toggleDiscard = id => {
    setDiscarded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
    setRetained(prev => { const next = new Set(prev); next.delete(id); return next })
    setReformulationRefs(prev => { const next = new Set(prev); next.delete(id); return next })
    setFinalized(false)
  }
  const toggleReformulation = id => {
    setReformulationRefs(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const preview = useMemo(() => {
    const sourceItems = dedupe([...selectedFormulation, ...selectedObjects, ...selectedTrends, ...selectedChanges, ...selectedWeakSignals])
    const sources = []
    const seen = new Set()
    sourceItems.forEach(item => {
      const key = item.origin === 'enrichment' ? item.id : `${item.source.publication_id}|${item.source.locator}`
      if (!key || seen.has(key)) return
      seen.add(key)
      sources.push({ ...item.source, origin: item.origin, item_title: item.title })
    })
    return {
      need_original: need.trim(),
      need_working: activeNeed,
      formulation_items: selectedFormulation,
      objects: selectedObjects,
      trends: selectedTrends,
      changes: selectedChanges,
      weak_signals: selectedWeakSignals,
      questions: buildQuestions(activeNeed, selectedObjects),
      sources,
    }
  }, [need, activeNeed, selectedFormulation, selectedObjects, selectedTrends, selectedChanges, selectedWeakSignals])

  const canGo = searched && !loading

  return <main className="page qvl-scenario-v01">
    <button className="back-link" onClick={onBack}><Icon name="back"/>Retour à l’atelier</button>
    <header className="qvl-scn-head qvl-scn-hero">
      <div className="qvl-scn-hero-copy">
        <span className="qvl-scn-kicker">Atelier de veille</span>
        <h1>Scénario de veille</h1>
        <p>Exprimez votre besoin, laissez le corpus vous proposer des notions utiles pour le préciser, puis construisez votre scénario pas à pas.</p>
      </div>
      <img src={scenarioHero} alt="Bibliothèque de travail Quiritès" />
    </header>

    <nav className="qvl-scn-nav" aria-label="Étapes du scénario de veille">
      {STEPS.map(s => <button key={s.id} type="button" className={step === s.id ? 'active' : ''} disabled={s.id > 1 && !canGo} onClick={() => setStep(s.id)}><span>{s.id}</span>{s.label}</button>)}
    </nav>

    {step === 1 && <section className="qvl-scn-section">
      <div className="qvl-scn-need">
        <label>Votre besoin de veille</label>
        <textarea value={need} onChange={e => { setNeed(e.target.value); setSearched(false); setFraming(null); setFinalized(false) }} placeholder="Décrivez librement ce que vous souhaitez mettre en veille, pourquoi et pour qui…"/>
        <button type="button" className="qvl-scn-primary" onClick={runSearch} disabled={!need.trim() || loading}><Icon name="search" size={17}/>{loading ? 'Exploration du corpus…' : 'Voir ce que le corpus met à disposition'}</button>
      </div>
      {error && <p className="qvl-scn-error">{error}</p>}
      {searched && <>
        <div className="qvl-scn-section-title"><div><h2>Les notions du corpus qui peuvent préciser votre besoin</h2><p>Quiritès peut regrouper plusieurs matériaux du corpus pour faire émerger une notion de cadrage utile. Chaque proposition est justifiée, sourcée et accompagnée de ses limites.</p></div></div>
        {formulationCorpusItems.length === 0 && <div className="qvl-scn-no-match">
          <strong>Aucune notion du corpus n’est suffisamment pertinente pour préciser ce besoin.</strong>
          <span>Quiritès préfère ne rien proposer plutôt que d’élargir artificiellement votre demande. Vous pourrez poursuivre avec votre formulation initiale.</span>
        </div>}
        {framing?.limites_couverture?.length > 0 && <div className="qvl-scn-coverage"><strong>Dimensions encore peu couvertes dans les matériaux retrouvés</strong><ul>{framing.limites_couverture.map((limit, index) => <li key={`${index}-${limit}`}>{limit}</li>)}</ul></div>}
        <div className="qvl-scn-grid qvl-scn-notion-grid">{formulationItems.map(item => <ProposalCard key={item.id} item={item} retained={retained.has(item.id)} discarded={discarded.has(item.id)} reformulation={reformulationRefs.has(item.id)} onRetain={toggleRetain} onDiscard={toggleDiscard} onReformulate={toggleReformulation}/>)}</div>
        {reformulationRefs.size > 0 && <div className="qvl-scn-reformulate">
          <label>Préciser votre besoin à partir des éléments choisis</label>
          <p className="qvl-scn-reformulate-help">Votre texte reste sous votre contrôle. Modifiez-le uniquement si les éléments retenus vous conduisent à préciser votre demande.</p>
          <textarea value={workingNeed} onChange={e => setWorkingNeed(e.target.value)} />
          <div className="qvl-scn-hints"><span>Éléments mobilisés pour vous aider à préciser :</span>{formulationItems.filter(i => reformulationRefs.has(i.id)).map(i => <b key={i.id}>{i.title}</b>)}</div>
        </div>}
        <div className="qvl-scn-reflexive"><Icon name="info" size={16}/>À vous de juger : cette notion aide-t-elle réellement à préciser votre besoin, ou risque-t-elle au contraire de l’élargir inutilement ?</div>
        <div className="qvl-scn-next"><button className="qvl-scn-primary" type="button" onClick={() => setStep(2)}>Valider cette sélection et continuer <Icon name="chevron" size={16}/></button></div>
      </>}
    </section>}

    {step === 2 && <section className="qvl-scn-section">
      <div className="qvl-scn-current-need"><strong>Besoin de veille</strong><span>{activeNeed}</span></div>
      <div className="qvl-scn-section-title"><div><h2>Objets de veille proposés par le corpus</h2><p>Retenez uniquement les acteurs, phénomènes, dispositifs ou territoires qui doivent réellement structurer votre veille.</p></div></div>
      <div className="qvl-scn-grid three">{objectItems.map(item => <SelectionCard key={item.id} item={item} retained={retained.has(item.id)} onToggle={toggleRetain}/>)}</div>
      <div className="qvl-scn-reflexive"><Icon name="info" size={16}/>À vous de juger : quels objets sont assez importants pour structurer la veille, et lesquels risquent de disperser l’attention ?</div>
      <div className="qvl-scn-next"><button className="qvl-scn-secondary" type="button" onClick={() => setStep(1)}><Icon name="back" size={16}/>Étape précédente</button><button className="qvl-scn-primary" type="button" onClick={() => setStep(3)}>Valider cette sélection et continuer <Icon name="chevron" size={16}/></button></div>
    </section>}

    {step === 3 && <section className="qvl-scn-section">
      <div className="qvl-scn-current-need"><strong>Besoin de veille</strong><span>{activeNeed}</span></div>
      <div className="qvl-scn-section-title"><div><h2>Tendances, signes de changement et signaux faibles</h2><p>Le corpus propose des éléments d’évolution à examiner. Leur qualification reste soumise à votre appréciation.</p></div></div>
      <div className="qvl-scn-signal-columns">
        <div className="qvl-scn-signal-col trend"><h3>Tendances</h3><p>Évolutions structurantes ou durables déjà documentées.</p>{trendItems.length ? trendItems.map(item => <SelectionCard key={item.id} item={item} retained={retained.has(item.id)} onToggle={toggleRetain}/>) : <span className="qvl-scn-empty-line">Aucune tendance suffisamment pertinente trouvée.</span>}</div>
        <div className="qvl-scn-signal-col change"><h3>Signes de changement</h3><p>Évolutions récentes ou indices d’inflexion présents dans les sources.</p>{changeItems.length ? changeItems.map(item => <SelectionCard key={item.id} item={item} retained={retained.has(item.id)} onToggle={toggleRetain}/>) : <span className="qvl-scn-empty-line">Aucun signe de changement suffisamment pertinent trouvé.</span>}</div>
        <div className="qvl-scn-signal-col weak"><h3>Signaux faibles</h3><p>Éléments déjà qualifiés comme signaux faibles dans le corpus.</p>{weakSignalItems.length ? weakSignalItems.map(item => <SelectionCard key={item.id} item={item} retained={retained.has(item.id)} onToggle={toggleRetain}/>) : <span className="qvl-scn-empty-line">Aucun signal faible explicitement documenté pour ce besoin.</span>}</div>
      </div>
      <div className="qvl-scn-method-note">
        <div><span className="qvl-scn-origin enrich">Enrichissement contrôlé</span><strong>{espasMethodItem.title}</strong></div>
        <p>{espasMethodItem.summary}</p>
        <a href={espasMethodItem.source.url} target="_blank" rel="noreferrer"><Icon name="external" size={14}/> Ouvrir la ressource</a>
      </div>
      <div className="qvl-scn-reflexive"><Icon name="info" size={16}/>À vous de juger : s’agit-il d’une tendance installée, d’un signe de changement ou d’un signal faible encore incertain ?</div>
      <div className="qvl-scn-next"><button className="qvl-scn-secondary" type="button" onClick={() => setStep(2)}><Icon name="back" size={16}/>Étape précédente</button><button className="qvl-scn-primary" type="button" onClick={() => setStep(4)}>Prévisualiser mon scénario <Icon name="chevron" size={16}/></button></div>
    </section>}

    {step === 4 && <section className="qvl-scn-section">
      <div className="qvl-scn-section-title"><div><h2>Prévisualisation du scénario</h2><p>Cette prévisualisation assemble uniquement votre besoin et les éléments que vous avez retenus.</p></div></div>
      <div className="qvl-scn-preview">
        <PreviewBlock n="1" title="Besoin de veille">
          <p>{preview.need_working}</p>
          {preview.need_working !== preview.need_original && <small>Besoin initial : {preview.need_original}</small>}
          {preview.formulation_items.length > 0 && <div className="qvl-scn-preview-notions"><strong>Notions de cadrage retenues</strong><span>{preview.formulation_items.map(item => item.title).join(' · ')}</span></div>}
        </PreviewBlock>
        <PreviewBlock n="2" title="Questions de veille"><ul>{preview.questions.map((q, i) => <li key={i}>{q}</li>)}</ul><small>Propositions de structuration à modifier si nécessaire.</small></PreviewBlock>
        <PreviewItems n="3" title="Objets de veille" items={preview.objects}/>
        <PreviewItems n="4" title="Tendances à suivre" items={preview.trends}/>
        <PreviewItems n="5" title="Signes de changement" items={preview.changes}/>
        <PreviewItems n="6" title="Signaux faibles" items={preview.weak_signals}/>
        <PreviewSources n="7" title="Sources à surveiller" sources={preview.sources}/>
      </div>
      <div className="qvl-scn-reflexive"><Icon name="info" size={16}/>Avant de générer : ce scénario reflète-t-il bien votre besoin initial et les choix que vous avez faits dans les étapes précédentes ?</div>
      <div className="qvl-scn-next"><button className="qvl-scn-secondary" type="button" onClick={() => setStep(3)}><Icon name="back" size={16}/>Étape précédente</button>{!finalized ? <button className="qvl-scn-primary" type="button" onClick={() => setFinalized(true)}><Icon name="spark" size={16}/>Générer le livrable</button> : <><button className="qvl-scn-secondary" type="button" onClick={() => exportScenarioWord(preview)}><Icon name="file" size={16}/>Exporter Word</button><button className="qvl-scn-secondary" type="button" onClick={() => exportScenarioExcel(preview)}><Icon name="layers" size={16}/>Exporter les données</button></>}</div>
      {finalized && <div className="qvl-scn-final">Scénario généré à partir de votre sélection. Vous pouvez revenir aux étapes précédentes pour le modifier puis le générer à nouveau.</div>}
    </section>}
  </main>
}

function PreviewBlock({ n, title, children }) {
  return <article className="qvl-scn-preview-block"><div className="qvl-scn-preview-title"><span>{n}</span><h3>{title}</h3></div>{children}</article>
}

function PreviewItems({ n, title, items }) {
  return <PreviewBlock n={n} title={title}>{items.length ? <ul>{items.map(item => <li key={item.id}><strong>{item.title}</strong><span>{sourceLabel(item.source)}</span></li>)}</ul> : <p>Aucun élément retenu.</p>}</PreviewBlock>
}

function PreviewSources({ n, title, sources }) {
  return <PreviewBlock n={n} title={title}>{sources.length ? <ul>{sources.map((s, i) => <li key={`${s.publication_id || s.url}-${i}`}><strong>{s.title}</strong><span>{[s.organisation, s.year, s.locator ? `repère ${s.locator}` : '', s.origin === 'enrichment' ? 'enrichissement contrôlé' : 'corpus'].filter(Boolean).join(' · ')}</span></li>)}</ul> : <p>Aucune source retenue.</p>}</PreviewBlock>
}
