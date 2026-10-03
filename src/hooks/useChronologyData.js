import { useEffect, useState } from 'react'

export function useChronologyData(enabled = true) {
  const [chronology, setChronology] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    Promise.all([
      fetch('./data/chronology_elements.json').then(r => {
        if (!r.ok) throw new Error('Impossible de charger chronology_elements.json')
        return r.json()
      }),
      fetch('./data/chronology_provenances.json').then(r => {
        if (!r.ok) throw new Error('Impossible de charger chronology_provenances.json')
        return r.json()
      }),
    ])
      .then(([elements, provenances]) => {
        if (alive) setChronology({ elements, provenances })
      })
      .catch(e => alive && setError(e))

    return () => { alive = false }
  }, [enabled])

  return { chronology, error }
}
