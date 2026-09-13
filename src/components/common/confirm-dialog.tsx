"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export interface ConfirmOptions {
  title: React.ReactNode
  description?: React.ReactNode
  /** Defaults to "Delete" when destructive, otherwise "Confirm". */
  confirmLabel?: string
  cancelLabel?: string
  /** Destructive styling for the confirm button. Default true. */
  destructive?: boolean
}

export interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** May return a promise — the dialog shows a pending state and stays open if it throws. */
  onConfirm: () => void | Promise<unknown>
}

/** Controlled confirmation dialog. Focus starts on Cancel; Esc cancels. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false)

  async function handleConfirm() {
    setPending(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (error) {
      toast.error("Something went wrong", { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() => void handleConfirm()}
          >
            {pending ? <Spinner /> : null}
            {confirmLabel ?? (destructive ? "Delete" : "Confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Promise-based confirmation.
 *
 *   const [confirm, confirmDialog] = useConfirm()
 *   async function onDelete() {
 *     if (!(await confirm({ title: "Delete this idea?", description: "This can't be undone." }))) return
 *     dataActions.remove("content_ideas", id)
 *     toast.success("Idea deleted")
 *   }
 *   return <>{…}{confirmDialog}</>   // render the element once, anywhere in the tree
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, React.ReactElement] {
  const [state, setState] = useState<{ options: ConfirmOptions; open: boolean }>({ options: { title: "" }, open: false })
  const resolver = useRef<((value: boolean) => void) | null>(null)

  // An unmount while a confirmation is open counts as "cancel", so awaiting callers never hang.
  useEffect(() => {
    const pending = resolver
    return () => {
      pending.current?.(false)
      pending.current = null
    }
  }, [])

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false)
        resolver.current = resolve
        setState({ options, open: true })
      }),
    []
  )

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result)
    resolver.current = null
    setState((s) => ({ ...s, open: false }))
  }, [])

  const element = (
    <ConfirmDialog
      {...state.options}
      open={state.open}
      onOpenChange={(open) => {
        if (!open) settle(false)
      }}
      onConfirm={() => settle(true)}
    />
  )
  return [confirm, element]
}
