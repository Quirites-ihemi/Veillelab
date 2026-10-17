import { useCallback, useRef, useState } from 'react'

// L'Éclaireur peut être déplacé à la main (en-tête de la carte ou bandeau).
// Une fois déplacé, il reste où l'utilisateur l'a posé : le placement
// automatique ne le reprend plus tant qu'il n'est pas réduit.
export function useGuideDrag(cardRef, screenRef) {
  const [manual, setManualState] = useState(null)
  const manualRef = useRef(null)
  const setManual = useCallback(v => { manualRef.current = v; setManualState(v) }, [])

  const onPointerDown = useCallback(e => {
    if (e.button !== 0) return
    if (e.target.closest('button, a, input, textarea, select, summary, .atlas-guide-body')) return
    const card = cardRef.current
    const screen = screenRef.current
    if (!card || !screen) return
    const S = screen.getBoundingClientRect()
    const C = card.getBoundingClientRect()
    const start = { px: e.clientX, py: e.clientY, x: C.left - S.left, y: C.top - S.top }
    let moved = false
    const move = ev => {
      const dx = ev.clientX - start.px
      const dy = ev.clientY - start.py
      if (!moved && Math.hypot(dx, dy) < 4) return
      moved = true
      const S2 = screen.getBoundingClientRect()
      const w = card.offsetWidth
      const h = Math.min(card.offsetHeight, S2.height - 16)
      setManual({
        x: Math.max(8, Math.min(start.x + dx, S2.width - w - 8)),
        y: Math.max(8, Math.min(start.y + dy, S2.height - h - 8)),
      })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.userSelect = ''
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [cardRef, screenRef, setManual])

  const reset = useCallback(() => setManual(null), [setManual])
  return { manual, manualRef, onPointerDown, reset }
}
