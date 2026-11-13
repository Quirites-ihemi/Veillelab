// T06 — Scénario de veille, version 3 (test).
// La version 3 n'est affichée que si l'adresse contient « ?t06=v3 » (mémorisé
// pour l'onglet). « ?t06=v2 » revient à la version en production.
// Le service de test peut être désigné par « ?t06_backend=https://….run.app »
// (adresse d'une révision Cloud Run étiquetée, sans trafic).

const PRODUCTION_URL = 'https://veillelab-cloud-backend2-633342872265.europe-west9.run.app'
const FLAG_KEY = 'qvl_t06_version'
const BACKEND_KEY = 'qvl_t06_backend'

function readParams() {
  try { return new URLSearchParams(window.location.search) } catch { return new URLSearchParams() }
}
function store(key, value) {
  try { value == null ? sessionStorage.removeItem(key) : sessionStorage.setItem(key, value) } catch {}
}
function load(key) {
  try { return sessionStorage.getItem(key) || '' } catch { return '' }
}
// N'accepte qu'une adresse Cloud Run en https.
function safeBackend(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && /\.run\.app$/.test(url.hostname) ? url.origin : ''
  } catch { return '' }
}

export function isScenarioV3Enabled() {
  const params = readParams()
  const flag = params.get('t06')
  if (flag === 'v3') store(FLAG_KEY, 'v3')
  if (flag === 'v2') { store(FLAG_KEY, null); store(BACKEND_KEY, null) }
  const backend = safeBackend(params.get('t06_backend') || '')
  if (backend) store(BACKEND_KEY, backend)
  return load(FLAG_KEY) === 'v3'
}

export function scenarioV3BackendUrl() {
  return safeBackend(load(BACKEND_KEY)) || PRODUCTION_URL
}

export async function analyzeScenarioV3(need) {
  const response = await fetch(`${scenarioV3BackendUrl()}/scenario-v3/axes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ need })
  })
  let payload = null
  try { payload = await response.json() } catch {}
  if (response.status === 404) throw new Error('Le service interrogé ne propose pas encore la version 3 du scénario de veille.')
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `Le service Quiritès a répondu ${response.status}.`)
  return payload
}
