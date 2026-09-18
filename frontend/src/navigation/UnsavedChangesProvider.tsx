import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { UnsavedChangesContext } from './context'

// holds whatever navigation was interrupted until the warning is answered
type Pending = { run: () => void } | null

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [unsaved, setUnsaved] = useState(false)
  const [pending, setPending] = useState<Pending>(null)

  // a reload or a closed tab never reaches react router, so the browser has to
  // be asked to do the warning itself
  useEffect(() => {
    if (!unsaved) return
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [unsaved])

  const guard = useCallback(
    (proceed: () => void) => {
      if (!unsaved) {
        proceed()
        return false
      }
      setPending({ run: proceed })
      return true
    },
    [unsaved],
  )

  return (
    <UnsavedChangesContext.Provider value={{ unsaved, setUnsaved, guard }}>
      {children}
      {pending && (
        <ConfirmDialog
          title="Leave without saving?"
          body="This mission has changes that have not been saved yet. They are lost if you leave now."
          confirmLabel="Leave"
          danger
          onConfirm={() => {
            const { run } = pending
            setPending(null)
            setUnsaved(false)
            run()
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </UnsavedChangesContext.Provider>
  )
}
