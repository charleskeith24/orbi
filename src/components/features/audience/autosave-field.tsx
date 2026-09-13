"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface AutosaveBox {
  dirty: string | null
  value: string
  required: boolean
  commit: (value: string) => void
  normalize: (value: string) => string
}

const normalizeLine = (text: string) => text.replace(/\s+/g, " ").trim()
const normalizeText = (text: string) => text.trim()

/**
 * Draft for a text field that saves on blur (Enter for single-line, ⌘/Ctrl+Enter for multi-line)
 * and when it unmounts mid-edit (sheet closed with Esc). `required` refuses to save an empty value
 * and shows an inline error instead. Changes made elsewhere flow in while the field isn't edited.
 */
function useAutosave(value: string, onCommit: (value: string) => void, normalize: (value: string) => string, required: boolean) {
  const [draft, setDraft] = useState(value)
  const [base, setBase] = useState(value)
  const [invalid, setInvalid] = useState(false)
  const box = useRef<AutosaveBox>({ dirty: null, value, required, commit: onCommit, normalize })

  if (value !== base) {
    setBase(value)
    if (draft === base) setDraft(value)
  }

  useEffect(() => {
    box.current.value = value
    box.current.required = required
    box.current.commit = onCommit
    box.current.normalize = normalize
  })

  useEffect(() => {
    const current = box.current
    return () => {
      if (current.dirty === null) return
      const next = current.normalize(current.dirty)
      if (current.required && !next) return
      if (next !== current.value) current.commit(next)
    }
  }, [])

  function change(next: string) {
    box.current.dirty = next
    setDraft(next)
    if (invalid && normalize(next)) setInvalid(false)
  }

  function flush() {
    const dirty = box.current.dirty
    if (dirty === null) return
    const next = normalize(dirty)
    if (required && !next) {
      setInvalid(true)
      return
    }
    box.current.dirty = null
    setDraft(next)
    if (next !== value) onCommit(next)
  }

  return { draft, change, flush, invalid }
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  )
}

type NativeInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange" | "required">
type NativeTextareaProps = Omit<React.ComponentProps<typeof Textarea>, "value" | "defaultValue" | "onChange" | "required">

interface AutosaveProps {
  value: string
  onCommit: (value: string) => void
  required?: boolean
  requiredMessage?: string
}

/** Single-line input bound to a stored value; Enter or blur saves. */
export function AutosaveInput({
  value,
  onCommit,
  required = false,
  requiredMessage = "This field can't be empty.",
  onBlur,
  onKeyDown,
  ...props
}: NativeInputProps & AutosaveProps) {
  const errorId = useId()
  const { draft, change, flush, invalid } = useAutosave(value, onCommit, normalizeLine, required)
  return (
    <>
      <Input
        {...props}
        value={draft}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
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
      {invalid ? <FieldError id={errorId} message={requiredMessage} /> : null}
    </>
  )
}

/** Multi-line textarea bound to a stored value; blur or ⌘/Ctrl+Enter saves. */
export function AutosaveTextarea({
  value,
  onCommit,
  required = false,
  requiredMessage = "This field can't be empty.",
  onBlur,
  onKeyDown,
  ...props
}: NativeTextareaProps & AutosaveProps) {
  const errorId = useId()
  const { draft, change, flush, invalid } = useAutosave(value, onCommit, normalizeText, required)
  return (
    <>
      <Textarea
        {...props}
        value={draft}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
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
      {invalid ? <FieldError id={errorId} message={requiredMessage} /> : null}
    </>
  )
}
