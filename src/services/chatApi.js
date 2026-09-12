const DEFAULT_GRAPH_CHAT_URL =
  'https://veillelab-cloud-backend2-633342872265.europe-west9.run.app/graph-chat'

const REQUEST_TIMEOUT_MS = 35000

function graphChatUrl() {
  return import.meta.env.VITE_GRAPH_CHAT_URL?.trim() || DEFAULT_GRAPH_CHAT_URL
}

export async function askGraph(question, publication, nodes, relations) {
  const url = graphChatUrl()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        question: String(question || '').trim(),
        publication_id: publication?.publication_id || '',
        publication_titre: publication?.titre || '',
        graph: {
          nodes: (Array.isArray(nodes) ? nodes : []).map(n => ({
            node_id: n.node_id,
            publication_id: n.publication_id,
            type_noeud: n.type_noeud,
            libelle: n.libelle,
            libelle_normalise: n.libelle_normalise,
            page_source: n.page_source,
          })),
          relations: (Array.isArray(relations) ? relations : []).map(r => ({
            relation_id: r.relation_id,
            source_id: r.source_id,
            cible_id: r.cible_id,
            type_relation: r.type_relation,
            page_source: r.page_source,
          })),
        },
      }),
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Le service de dialogue met trop de temps à répondre. Réessayez dans quelques instants.')
    }
    throw new Error(`Impossible de joindre le service de dialogue. ${error?.message || error}`)
  } finally {
    clearTimeout(timeout)
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    throw new Error(`Le service de dialogue a répondu dans un format inattendu (HTTP ${response.status}).`)
  }

  if (!response.ok || payload?.ok === false) {
    const message = payload?.error || payload?.message
    if (response.status === 429) {
      throw new Error(message || 'Le service reçoit beaucoup de demandes. Réessayez dans quelques minutes.')
    }
    throw new Error(message || `Le service de dialogue a répondu HTTP ${response.status}.`)
  }

  return {
    mode: 'cloud-run',
    request_id: payload?.request_id || payload?.data?.request_id || '',
    ...(payload?.data || payload),
  }
}
