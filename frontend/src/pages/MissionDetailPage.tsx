import { useParams } from 'react-router-dom'

export function MissionDetailPage() {
  const { id } = useParams()
  return (
    <div>
      <h1>Mission</h1>
      <p className="text-dim mono">{id}</p>
    </div>
  )
}
