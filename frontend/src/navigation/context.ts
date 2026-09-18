import { createContext } from 'react'

export interface UnsavedChangesValue {
  unsaved: boolean
  setUnsaved: (unsaved: boolean) => void
  // runs the navigation now if nothing is at risk, otherwise asks first and
  // returns true so the caller knows to hold its own default
  guard: (proceed: () => void) => boolean
}

// the default lets anything outside the provider navigate as it always did
export const UnsavedChangesContext = createContext<UnsavedChangesValue>({
  unsaved: false,
  setUnsaved: () => {},
  guard: (proceed) => {
    proceed()
    return false
  },
})
