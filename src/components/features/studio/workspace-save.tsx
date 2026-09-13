"use client"

import { createContext, useContext, useEffect, useEffectEvent } from "react"

type SaveHandler = () => void
type Register = (tab: string, handler: SaveHandler | null) => void

const SaveContext = createContext<Register | null>(null)

export const SaveShortcutProvider = SaveContext.Provider

/**
 * Registers what ⌘/Ctrl+S does while `tab` is the active workspace tab. The workspace owns the
 * key listener; tabs only describe how to save themselves.
 */
export function useSaveShortcut(tab: string, handler: SaveHandler) {
  const register = useContext(SaveContext)
  const onSave = useEffectEvent(handler)
  useEffect(() => {
    if (!register) return
    register(tab, () => onSave())
    return () => register(tab, null)
  }, [register, tab])
}
