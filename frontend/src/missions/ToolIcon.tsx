// hand drawn glyphs for the toolbar, one per MapTool icon name. small enough set
// that an icon library would be more weight than it is worth
export function ToolIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {glyph(name)}
    </svg>
  )
}

function glyph(name: string) {
  switch (name) {
    // an arrow, the usual "pick something" pointer
    case 'cursor':
      return <path d="M3.5 2 L3.5 13 L6.4 10.2 L8.4 14 L10.2 13.1 L8.3 9.5 L12.4 9.2 Z" />
    // a map pin, one point dropped on the ground
    case 'pin':
      return (
        <>
          <path d="M8 14.5s4.5-5 4.5-8.5a4.5 4.5 0 0 0-9 0C3.5 9.5 8 14.5 8 14.5Z" />
          <circle cx="8" cy="6" r="1.6" />
        </>
      )
    // a boxed area with the sweep lines the survey flies across it
    case 'square':
      return (
        <>
          <rect x="2" y="3.5" width="12" height="9" rx="1" />
          <path d="M4.5 6.5h7M4.5 9.5h7" opacity="0.55" />
        </>
      )
    // a centre line with a pass running either side of it
    case 'line':
      return (
        <>
          <path d="M2 10.5 L14 4.5" />
          <path d="M2 13.2 L14 7.2M2 7.8 L14 1.8" opacity="0.5" />
        </>
      )
    default:
      return <circle cx="8" cy="8" r="5" />
  }
}
