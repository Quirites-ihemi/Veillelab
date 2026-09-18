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
  return postJson('/corpus-search', {
    query,
    limit: options.limit || 12,
    max_per_publication: options.maxPerPublication || 3,
    diversify_by_publication: options.diversifyByPublication !== false,
  })
}
