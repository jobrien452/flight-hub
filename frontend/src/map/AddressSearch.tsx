import { useState, type FormEvent } from 'react'
import './AddressSearch.css'

interface AddressSearchProps {
  mapboxToken: string
  onSelect: (lng: number, lat: number) => void
}

// geocodes through mapbox directly, no need for a whole geocoder widget/dependency
export function AddressSearch({ mapboxToken, onSelect }: AddressSearchProps) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setError(null)
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&limit=1`
      const res = await fetch(url)
      const data = await res.json()
      const first = data?.features?.[0]
      if (!first) {
        setError('No results')
        return
      }
      const [lng, lat] = first.center
      onSelect(lng, lat)
    } catch {
      setError('Search failed')
    } finally {
      setSearching(false)
    }
  }

  return (
    <form className="address-search" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Search an address..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button type="submit" disabled={searching}>
        {searching ? '...' : 'Go'}
      </button>
      {error && <span className="address-search-error">{error}</span>}
    </form>
  )
}
