import React from 'react'
import '../eclaireur.css'

export default function Eclaireur({
  state,
  content,
  onAction,
  onDismiss,
  onHelp,
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
        <span className="eclaireur-mark" aria-hidden="true">✦</span>
        <span>L’Éclaireur</span>
      </div>

      <button
        type="button"
        className="eclaireur-close"
        onClick={onDismiss}
        aria-label="Masquer l’Éclaireur"
      >
        ×
      </button>

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
    </aside>
  )
}
