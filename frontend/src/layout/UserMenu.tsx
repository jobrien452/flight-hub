import { useEffect, useRef, useState } from 'react'
import { GuardedNavLink } from '../navigation/GuardedNavLink'
import { useUnsavedChanges } from '../navigation/useUnsavedChanges'
import type { LoginResponse } from '../types/auth'

interface UserMenuProps {
  session: LoginResponse
  onSignOut: () => void
}

// the signed in user's own corner of the bar, profile lives in here rather than
// alongside the mission navigation
export function UserMenu({ session, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const { guard } = useUnsavedChanges()

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    function onClickAway(event: MouseEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onClickAway)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onClickAway)
    }
  }, [open])

  return (
    <div className="user-menu" ref={wrapper}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {session.name}
        <span className="role mono">{session.role}</span>
        <span aria-hidden="true" className="user-menu-caret">
          &#9662;
        </span>
      </button>
      {open && (
        <div className="user-menu-items" role="menu">
          <GuardedNavLink role="menuitem" to="/profile" onClick={() => setOpen(false)}>
            Profile
          </GuardedNavLink>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              guard(onSignOut)
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
