import React from 'react'
import '../eclaireur.css'

export default function Eclaireur({
  state,
  content,
  contentKey,
  onAction,
  onDismiss,
  onHelp,
  paused = false,
  onTogglePause,
}) {
  if (!state || !content) {
    return (
      <button
        type="button"
        className="eclaireur-help-button"
        onClick={onHelp}
        aria-label="Ouvrir l’Éclaireur"
      >
        <span aria-hidden="true">✦</span>
        Besoin d’aide ?
      </button>
    )
  }

  const placement = content.placement || 'overview'

  return (
    <aside
      className={`eclaireur-card eclaireur-${placement}`}
      role="status"
      aria-live="polite"
    >
      {placement === 'welcome' && (
        <span className="eclaireur-pointer" aria-hidden="true" />
      )}

      <div className="eclaireur-accent" aria-hidden="true" />

      <div className="eclaireur-heading">
        <span
          className={`eclaireur-radar${placement === 'welcome' ? ' is-intro' : ''}`}
          aria-hidden="true"
        >
          <span className="eclaireur-radar-ring eclaireur-radar-ring-1" />
          <span className="eclaireur-radar-ring eclaireur-radar-ring-2" />
          <span className="eclaireur-radar-sweep" />
          <span className="eclaireur-radar-dot" />
        </span>
        <span className="eclaireur-heading-copy">
          <strong>L’Éclaireur</strong>
          <small>Je vous guide dans la carte</small>
        </span>
      </div>

      <button
        type="button"
        className="eclaireur-close"
        onClick={onDismiss}
        aria-label="Masquer l’Éclaireur"
      >
        ×
      </button>

      {state === 'overview' && onTogglePause && (
        <button
          type="button"
          className={`eclaireur-pause${paused ? ' is-paused' : ''}`}
          onClick={onTogglePause}
          aria-pressed={paused}
        >
          <span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span>
          {paused ? 'Reprendre' : 'Pause'}
        </button>
      )}

      <div className="eclaireur-content" key={contentKey ?? state}>
        <p className="eclaireur-lead">{content.lead}</p>
        {content.body && <p>{content.body}</p>}


        {content.prompt && (
          <p className="eclaireur-prompt">{content.prompt}</p>
        )}

        {content.actionLabel && (
          <button
            type="button"
            className="eclaireur-action"
            onClick={onAction}
          >
            {content.actionLabel}
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </aside>
  )
}
