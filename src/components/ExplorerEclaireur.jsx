import React from 'react'
import { explorerGuideStep } from '../lib/explorerEclaireurRules.js'

function RichLine({ parts }) {
  return <p>{parts.map((part, i) => {
    if (typeof part === 'string') return <React.Fragment key={i}>{part}</React.Fragment>
    if (part?.strong) return <strong key={i}>{part.strong}</strong>
    return null
  })}</p>
}

export default function ExplorerEclaireur({ step, paused, onTogglePause, onCollapse, onReplay, collapsed = false }) {
  const content = explorerGuideStep(step)

  if (collapsed) {
    return (
      <button
        className="explorer-eclaireur-recall"
        onClick={onReplay}
        type="button"
        aria-label="Rouvrir L’Éclaireur"
      >
        <span className="explorer-eclaireur-mini-compass" aria-hidden="true">✦</span>
        <span>L’Éclaireur</span>
      </button>
    )
  }

  return (
    <aside
      className={`explorer-eclaireur explorer-eclaireur-${content.mode}`}
      data-guide-step={step}
      aria-live="polite"
      aria-label={`L’Éclaireur, étape ${step} sur 7`}
    >
      <header className="explorer-eclaireur-head">
        <div className="explorer-eclaireur-brand">
          <span className="explorer-eclaireur-compass" aria-hidden="true">✦</span>
          <div>
            <strong>L’Éclaireur</strong>
            <small>VOTRE GUIDE DANS CET ESPACE</small>
          </div>
        </div>

        <div className="explorer-eclaireur-head-actions">
          <span>{step}/7</span>
          <button
            type="button"
            className="explorer-eclaireur-close"
            onClick={onCollapse}
            aria-label="Fermer L’Éclaireur"
          >
            ×
          </button>
        </div>

        <div className="explorer-eclaireur-lighthouse" aria-hidden="true">
          <span className="explorer-eclaireur-lighthouse-light" />
          <span className="explorer-eclaireur-lighthouse-top" />
          <span className="explorer-eclaireur-lighthouse-body" />
          <span className="explorer-eclaireur-lighthouse-base" />
        </div>
      </header>

      <div className="explorer-eclaireur-copy">
        <h3>{content.title}</h3>
        {content.body.map((line, i) => <RichLine key={i} parts={line} />)}

        {step >= 2 && step <= 6 && (
          <div className="explorer-eclaireur-controls">
            <button type="button" onClick={onTogglePause} className="explorer-eclaireur-pause">
              {paused ? '▶ Reprendre' : 'Ⅱ Pause'}
            </button>
            <span>La démonstration se poursuit automatiquement.</span>
          </div>
        )}

        {step === 7 && (
          <div className="explorer-eclaireur-controls final">
            <button type="button" onClick={onCollapse}>Explorer librement</button>
          </div>
        )}

        <div className="explorer-eclaireur-footer" aria-hidden="true">
          <div className="explorer-eclaireur-dots">
            {[1, 2, 3, 4, 5, 6, 7].map(n => <i key={n} className={n === step ? 'active' : ''} />)}
          </div>
        </div>
      </div>
    </aside>
  )
}
