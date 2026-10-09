import { useEffect, useState } from 'react'

const FILES = ['publications','nodes','relations','contents','treatments','expertise_nodes','expertise_edges','manifest']

function normalizePublicationImages(publications = []) {
  return publications.map((publication) => {
    const id = String(publication?.publication_id || '').trim()
    const declaredFile = String(publication?.image_publication || '').trim()
    const declaredPath = String(publication?.image_path || '').trim()

    // Respecte explicitement l'absence d'image déclarée dans les données.
    // Cela évite de fabriquer un chemin PUBxxx.png inexistant pour les nouvelles publications.
    if (publication?.has_image === false) {
      return { ...publication, image_path: '', has_image: false }
    }

    // Convention unique pour tout le site :
    // public/images/publications/PUBxxx.png
    // Si image_path n'a pas été régénéré dans publications.json,
    // on le reconstruit automatiquement depuis image_publication,
    // puis depuis publication_id en dernier recours.
    let imagePath = declaredPath

    if (!imagePath && declaredFile) {
      const fileName = declaredFile.split(/[\\/]/).pop()
      imagePath = `/images/publications/${fileName}`
    }

    if (!imagePath && id) {
      imagePath = `/images/publications/${id}.png`
    }

    return {
      ...publication,
      image_path: imagePath,
      has_image: Boolean(imagePath),
    }
  })
}

export function useData() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true

    Promise.all(FILES.map(async (name) => {
      const r = await fetch(`./data/${name}.json`)
      if (!r.ok) throw new Error(`Impossible de charger ${name}.json`)
      return [name, await r.json()]
    }))
      .then(entries => {
        if (!alive) return

        const loaded = Object.fromEntries(entries)
        loaded.publications = normalizePublicationImages(loaded.publications)
        setData(loaded)
      })
      .catch(e => alive && setError(e))

    return () => { alive = false }
  }, [])

  return { data, error }
}
