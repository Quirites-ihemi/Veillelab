const CLOUD_URL = 'https://veillelab-cloud-backend2-633342872265.europe-west9.run.app'

async function postJson(path, body) {
  const response = await fetch(`${CLOUD_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  let payload = null
  try { payload = await response.json() } catch {}

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Le service Quiritès a répondu ${response.status}.`)
  }
  return payload
}

export function runReflectionAction(actionId, payload = {}) {
  return postJson('/reflection-assist', { action_id: actionId, ...payload })
}

export function searchCorpus(query, options = {}) {
  const body = {
    query,
    limit: options.limit || 12,
    max_per_publication: options.maxPerPublication || 3,
    diversify_by_publication: options.diversifyByPublication !== false,
  }
  if (Array.isArray(options.kinds) && options.kinds.length) body.kinds = options.kinds
  if (Array.isArray(options.publicationIds) && options.publicationIds.length) body.publication_ids = options.publicationIds
  if (Array.isArray(options.provenanceLevels) && options.provenanceLevels.length) body.provenance_levels = options.provenanceLevels
  if (options.domaine) body.domaine = options.domaine
  if (options.organisme) body.organisme = options.organisme
  return postJson('/corpus-search', body)
}



export function searchReflectionCorpus(query, options = {}) {
  const body = {
    query,
    need_id: options.needId || 'overview',
    limit: options.limit || 12,
    max_per_publication: options.maxPerPublication || 3,
    diversify_by_publication: options.diversifyByPublication !== false,
  }
  if (Array.isArray(options.kinds) && options.kinds.length) body.kinds = options.kinds
  if (Array.isArray(options.publicationIds) && options.publicationIds.length) body.publication_ids = options.publicationIds
  if (Array.isArray(options.provenanceLevels) && options.provenanceLevels.length) body.provenance_levels = options.provenanceLevels
  if (options.domaine) body.domaine = options.domaine
  if (options.organisme) body.organisme = options.organisme
  if (options.contextSubject) body.context_subject = options.contextSubject
  if (Array.isArray(options.canvasContext) && options.canvasContext.length) body.canvas_context = options.canvasContext
  return postJson('/reflection-search', body)
}

export function searchExperts(query, options = {}) {
  const body = { query }
  if (options.organisme) body.organisme = options.organisme
  if (options.domaine) body.domaine = options.domaine
  return postJson('/expert-search', body)
}

export function analyzeScenarioFraming(need) {
  return postJson('/scenario-framing', { need })
}

export function analyzeScenarioAxes(need, framing = {}, answers = []) {
  return postJson('/scenario-axes', { need, cadrage: framing, reponses: answers })
}


export function analyzeScenarioAxisSupport(need, framing = {}, answers = [], axes = []) {
  return postJson('/scenario-axis-support', { need, cadrage: framing, reponses: answers, axes })
}

export function analyzeScenarioDynamics(need, framing = {}, answers = [], axes = []) {
  return postJson('/scenario-dynamics', { need, cadrage: framing, reponses: answers, axes })
}

export function analyzeScenarioV2Axes(need) {
  return postJson('/scenario-v2/axes', { need })
}

export function analyzeScenarioV2AxisObjects(need, subjectQuery, axis) {
  return postJson('/scenario-v2/axis-objects', { need, subject_query: subjectQuery, axis })
}
