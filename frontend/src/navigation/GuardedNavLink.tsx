import type { ReactNode } from 'react'
import { NavLink, type NavLinkProps } from 'react-router-dom'
import { useGuardedNavigate } from './useUnsavedChanges'

interface GuardedNavLinkProps extends Omit<NavLinkProps, 'to' | 'children'> {
  to: string
  children: ReactNode
}

// a nav link that checks whether the page it is leaving has unsaved work
export function GuardedNavLink({ to, children, onClick, ...rest }: GuardedNavLinkProps) {
  const guardedNavigate = useGuardedNavigate()

  return (
    <NavLink
      {...rest}
      to={to}
      onClick={(event) => {
        onClick?.(event)
        // a middle click or a modifier click belongs to the browser, leave it alone
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
        if (guardedNavigate(to)) event.preventDefault()
      }}
    >
      {children}
    </NavLink>
  )
}
