import React, { useState } from 'react'
import { analyzeScenarioV3, scenarioV3BackendUrl } from '../services/scenarioV3Api.js'
import { exportScenarioV3Word } from '../utils/scenarioExportV3.js'
import './scenario-v3.css'

// T06 — Scénario de veille, version 3 (test).
// Une phrase de besoin → l'IA range les éléments de la base en axes ; chaque
// axe donne accès à tous les types d'information disponibles et aux acteurs
// à suivre. Les éléments sont affichés tels quels, avec leur publication et
// leur repère. Rien n'est rédigé par l'IA hormis le titre et la question de
// chaque axe, signalés comme tels.

const EXAMPLES = [
  'Le narcotrafic et ses effets sur l’État de droit',
  'Les feux de forêt et les primo-intervenants',
  'La cybercriminalité et les usages criminels de l’IA',
]

const STATUS_MESSAGES = {
  aucun_element: 'Les publications du bulletin ne contiennent aucun élément sur ce sujet pour le moment.',
  aucun_axe_fonde: 'Des éléments ont été trouvés, mais ils ne permettent pas de former des axes de veille sur ce sujet.',
  recherche_indisponible: 'La recherche a rencontré une erreur technique : ce résultat ne dit rien du contenu des publications.',
}

function repere(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^[\d;\s–-]+$/.test(raw)) {
    const pages = raw.split(';').map(s => s.trim()).filter(Boolean)
    return `p. ${pages.slice(0, 4).join(', ')}${pages.length > 4 ? '…' : ''}`
  }
  if (/^\d{1,2}:\d{2}/.test(raw)) return raw.split(';')[0]
  return raw
}

function pdfLink(url, rep) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  const first = (String(rep || '').match(/^\d+/) || [])[0]
  return /\.pdf(?:$|[?#])/i.test(raw) && first ? `${raw.split('#')[0]}#page=${first}` : raw
}

const capitalize = s => { const v = String(s || '').trim(); return v ? v.charAt(0).toUpperCase() + v.slice(1) : v }

export default function ScenarioWorkspaceV3({ onBack }) {
  const [need, setNeed] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [kept, setKept] = useState([])
  const [tabs, setTabs] = useState({})

  const run = async event => {
    event?.preventDefault()
    const clean = need.trim()
    if (!clean || loading) return
    setLoading(true); setError(''); setResult(null)
    try {
      const payload = await analyzeScenarioV3(clean)
      setResult(payload)
      setKept((payload.axes || []).map(a => a.axis_id))
      setTabs({})
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  const toggle = id => setKept(list => list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  const axes = result?.axes || []
  const testBackend = scenarioV3BackendUrl()

  return <main className="t06v3">
    <div className="t06v3-top">
      <button type="button" className="t06v3-back" onClick={onBack}>‹ Atelier de veille</button>
      <span>Scénario de veille</span>
      <em className="t06v3-test" title={testBackend}>Version de test</em>
    </div>

    <section className="t06v3-start">
      <h1>{result ? `${axes.length} axe${axes.length > 1 ? 's' : ''} de veille proposé${axes.length > 1 ? 's' : ''}` : 'Quels axes de veille sur votre sujet ?'}</h1>
      {!result && <p className="t06v3-lead">Décrivez votre besoin en une phrase. L’IA range en quelques axes ce que contiennent les publications du bulletin : problèmes, tendances, signaux faibles, actions, recommandations… Chaque élément est repris tel quel, avec sa source.</p>}
      <form className="t06v3-form" onSubmit={run}>
        <label htmlFor="t06v3-need">Votre besoin de veille</label>
        <textarea id="t06v3-need" value={need} onChange={e => setNeed(e.target.value)} rows={result ? 2 : 3} maxLength={600}
          placeholder="Ex. : Je veux suivre l’évolution de la cybercriminalité, notamment les usages criminels de l’IA."/>
        <div className="t06v3-form-row">
          {!result && <div className="t06v3-examples"><span>Exemples :</span>{EXAMPLES.map(x => <button key={x} type="button" onClick={() => setNeed(x)}>{x}</button>)}</div>}
          <button type="submit" className="t06v3-go" disabled={!need.trim() || loading}>{loading ? 'Recherche en cours…' : result ? 'Relancer' : 'Proposer des axes de veille →'}</button>
        </div>
      </form>
      {!result && <p className="t06v3-note">L’outil ne s’appuie que sur les publications du bulletin. S’il en trouve peu sur le sujet, il le dit au lieu de compléter.</p>}
    </section>

    {loading && <div className="t06v3-loading"><span/>Recherche dans les publications, puis rangement des éléments en axes…</div>}
    {error && <div className="t06v3-alert">{error}</div>}

    {result && !axes.length && <div className="t06v3-empty">
      <strong>{STATUS_MESSAGES[result.statut] || result.message || 'Aucun axe proposé.'}</strong>
      <p>Essayez une formulation plus courte ou plus générale.</p>
    </div>}

    {axes.length > 0 && <>
      <div className="t06v3-axes">
        {axes.map(axis => {
          const active = tabs[axis.axis_id] || axis.groupes[0]?.id
          const group = axis.groupes.find(g => g.id === active) || axis.groupes[0]
          const on = kept.includes(axis.axis_id)
          return <article key={axis.axis_id} className={`t06v3-axis ${on ? '' : 'off'}`}>
            <header>
              <label className="t06v3-keep"><input type="checkbox" checked={on} onChange={() => toggle(axis.axis_id)}/> Garder</label>
              <h2>{axis.titre}</h2>
              {axis.question_veille && <p className="t06v3-question">{axis.question_veille}</p>}
              <p className="t06v3-meta">{axis.publication_count} publication{axis.publication_count > 1 ? 's' : ''}</p>
            </header>
            <div className="t06v3-tabs" role="tablist">
              {axis.groupes.map(g => <button key={g.id} type="button" role="tab" aria-selected={g.id === group?.id} className={g.id === group?.id ? 'on' : ''}
                onClick={() => setTabs(t => ({ ...t, [axis.axis_id]: g.id }))}>{g.label} <em>{g.elements.length}</em></button>)}
            </div>
            <div className="t06v3-items" role="tabpanel">
              {(group?.elements || []).map(el => {
                const href = pdfLink(el.url, el.repere)
                return <div key={`${el.publication_id}-${el.node_id}`} className={`t06v3-item g-${el.groupe}`}>
                  <p>{el.libelle}</p>
                  <small>
                    {[capitalize(el.titre) || el.publication_id, el.organisme_producteur, repere(el.repere)].filter(Boolean).join(' · ')}
                    {href && <> · <a href={href} target="_blank" rel="noreferrer">Ouvrir</a></>}
                  </small>
                </div>
              })}
            </div>
            {axis.acteurs_a_suivre?.length > 0 && <div className="t06v3-actors">
              <h3>Acteurs à suivre <em>{axis.acteurs_a_suivre.length}</em></h3>
              <div>{axis.acteurs_a_suivre.map(a => <span key={a.libelle} title={a.appuis.map(p => `${p.publication_id} · ${p.type_relation} · ${p.element_lie}`).join('\n')}>{a.libelle}</span>)}</div>
            </div>}
            {axis.statut_documentaire === 'publication_unique' && <p className="t06v3-limit">Axe appuyé sur une seule publication.</p>}
          </article>
        })}
      </div>
      <div className="t06v3-bottom">
        <p className="t06v3-ai">Titres et questions des axes proposés par l’IA. Les éléments sont repris tels quels des publications, avec leur repère.</p>
        <button type="button" className="t06v3-go" disabled={!kept.length} onClick={() => exportScenarioV3Word(result, kept)}>Télécharger ({kept.length} axe{kept.length > 1 ? 's' : ''}, .docx)</button>
      </div>
    </>}
  </main>
}
