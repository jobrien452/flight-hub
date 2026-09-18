import './MapCompass.css'

interface MapCompassProps {
  bearing: number
  onReset: () => void
}

// the map turns under it, so the rose turns the opposite way and north on the
// dial keeps pointing at north on the ground
export function MapCompass({ bearing, onReset }: MapCompassProps) {
  const heading = Math.round(((bearing % 360) + 360) % 360)

  return (
    <button
      type="button"
      className="map-compass"
      aria-label={`Heading ${heading} degrees, face north`}
      onClick={onReset}
    >
      <svg
        data-testid="compass-rose"
        viewBox="0 0 44 44"
        width="44"
        height="44"
        aria-hidden="true"
        style={{ transform: `rotate(${-bearing}deg)` }}
      >
        <circle cx="22" cy="22" r="19" className="compass-face" />
        {/* a tick every 30 degrees, the four cardinals drawn longer */}
        {Array.from({ length: 12 }, (_, i) => {
          const cardinal = i % 3 === 0
          return (
            <line
              key={i}
              x1="22"
              y1={cardinal ? 5 : 6.5}
              x2="22"
              y2={cardinal ? 10 : 9}
              className={cardinal ? 'compass-tick-major' : 'compass-tick'}
              transform={`rotate(${i * 30} 22 22)`}
            />
          )
        })}
        <polygon points="22,10 26,24 22,21 18,24" className="compass-needle-north" />
        <polygon points="22,34 18,20 22,23 26,20" className="compass-needle-south" />
        <text x="22" y="17" className="compass-north-letter" textAnchor="middle">
          N
        </text>
      </svg>
      <span className="map-compass-readout mono">{heading}°</span>
    </button>
  )
}
