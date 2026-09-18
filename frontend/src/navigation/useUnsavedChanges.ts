import { useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UnsavedChangesContext, type UnsavedChangesValue } from './context'

export function useUnsavedChanges(): UnsavedChangesValue {
  return useContext(UnsavedChangesContext)
}

// an editor says whether it is holding work, and stops saying so once it is gone
export function useUnsavedWork(unsaved: boolean): void {
  const { setUnsaved } = useUnsavedChanges()

  useEffect(() => {
    setUnsaved(unsaved)
    return () => setUnsaved(false)
  }, [unsaved, setUnsaved])
}

// navigation that asks first, for links and buttons that leave the editor
export function useGuardedNavigate(): (to: string) => boolean {
  const navigate = useNavigate()
  const { guard } = useUnsavedChanges()
  return (to: string) => guard(() => navigate(to))
}
