"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface AutosaveBox {
  dirty: string | null
  value: string
  commit: (value: string) => void
  normalize: (value: string) => string
}

const normalizeLine = (text: string) => text.replace(/\s+/g, " ").trim()
const normalizeText = (text: string) => text.trim()

/**
 * Draft for a text field that saves on blur (Enter for single-line, ⌘/Ctrl+Enter for multi-line) and
 * when it unmounts mid-edit (sheet closed with Esc, idea switched). Changes made elsewhere flow in
 * while the field isn't being edited.
 */
function useAutosave(value: string, onCommit: (value: string) => void, normalize: (value: string) => string) {
  const [draft, setDraft] = useState(value)
  const [base, setBase] = useState(value)
  const box = useRef<AutosaveBox>({ dirty: null, value, commit: onCommit, normalize })

  if (value !== base) {
    setBase(value)
    if (draft === base) setDraft(value)
  }

  useEffect(() => {
    box.current.value = value
    box.current.commit = onCommit
    box.current.normalize = normalize
  })

  useEffect(() => {
    const current = box.current
    return () => {
      if (current.dirty === null) return
      const next = current.normalize(current.dirty)
      if (next !== current.value) current.commit(next)
    }
  }, [])

  function change(next: string) {
    box.current.dirty = next
    setDraft(next)
  }

  function flush() {
    const dirty = box.current.dirty
    if (dirty === null) return
    box.current.dirty = null
    const next = normalize(dirty)
    setDraft(next)
    if (next !== value) onCommit(next)
  }

  return { draft, change, flush }
}

type NativeInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange">
type NativeTextareaProps = Omit<React.ComponentProps<typeof Textarea>, "value" | "defaultValue" | "onChange">

/** Single-line input bound to a stored value; Enter or blur saves. */
export function AutosaveInput({
  value,
  onCommit,
  onBlur,
  onKeyDown,
  ...props
}: NativeInputProps & { value: string; onCommit: (value: string) => void }) {
  const { draft, change, flush } = useAutosave(value, onCommit, normalizeLine)
  return (
    <Input
      {...props}
      value={draft}
      onChange={(event) => change(event.target.value)}
      onBlur={(event) => {
        flush()
        onBlur?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          flush()
        }
        onKeyDown?.(event)
      }}
    />
  )
}

/** Multi-line textarea bound to a stored value; blur or ⌘/Ctrl+Enter saves. */
export function AutosaveTextarea({
  value,
  onCommit,
  onBlur,
  onKeyDown,
  ...props
}: NativeTextareaProps & { value: string; onCommit: (value: string) => void }) {
  const { draft, change, flush } = useAutosave(value, onCommit, normalizeText)
  return (
    <Textarea
      {...props}
      value={draft}
      onChange={(event) => change(event.target.value)}
      onBlur={(event) => {
        flush()
        onBlur?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          flush()
        }
        onKeyDown?.(event)
      }}
    />
  )
}
