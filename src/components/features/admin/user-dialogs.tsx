"use client"

import { CircleAlert } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import { useScreenLang, useScreenT } from "@/components/app-shell/device-ui-lang"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import type { AdminUserRow } from "@/lib/admin/types"
import { describeAdminError, toAdminError } from "./api/errors"
import { useAdmin } from "./admin-context"
import { adminMessages, usersMessages } from "./messages"

const emailSchema = z.string().trim().min(1).pipe(z.email())

/** "Invite someone": sends a Supabase invite without a waitlist request. */
export function InviteDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvited: (row: AdminUserRow) => void
}) {
  const t = useScreenT(usersMessages)
  const a = useScreenT(adminMessages)
  const lang = useScreenLang()
  const { api } = useAdmin()
  const id = useId()
  const [email, setEmail] = useState("")
  const [touched, setTouched] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const trimmed = email.trim()
  const valid = emailSchema.safeParse(trimmed).success
  const fieldError = touched && !valid ? (trimmed ? t("email_invalid") : t("email_required")) : undefined
  const serverError = error ? (toAdminError(error).code === "conflict" ? t("invite_conflict") : describeAdminError(error, lang)) : null

  function reset(next: boolean) {
    if (pending) return
    if (!next) {
      setEmail("")
      setTouched(false)
      setError(null)
    }
    onOpenChange(next)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!valid || pending) return
    setPending(true)
    setError(null)
    try {
      const row = await api.inviteUser(trimmed.toLowerCase())
      toast.success(t("invited_toast", { email: row.email }))
      setPending(false)
      onInvited(row)
      setEmail("")
      setTouched(false)
      onOpenChange(false)
    } catch (err) {
      setError(err)
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t("invite_title")}</DialogTitle>
            <DialogDescription>{t("invite_description")}</DialogDescription>
          </DialogHeader>
          {serverError ? (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}
          <Field data-invalid={fieldError ? true : undefined}>
            <FieldLabel htmlFor={`${id}-email`}>{t("invite_email")}</FieldLabel>
            <Input
              id={`${id}-email`}
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t("invite_placeholder")}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setError(null)
              }}
              onBlur={() => setTouched(Boolean(trimmed) || touched)}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? `${id}-email-error` : undefined}
              disabled={pending}
              autoFocus
            />
            <FieldError id={`${id}-email-error`}>{fieldError}</FieldError>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => reset(false)} disabled={pending}>
              {a("cancel")}
            </Button>
            <Button type="submit" disabled={pending || (touched && !valid)}>
              {pending ? (
                <>
                  <Spinner /> {t("inviting")}
                </>
              ) : (
                t("invite_send")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Delete with a typed-email confirmation (the API checks it again). */
export function DeleteUserDialog({
  user,
  onOpenChange,
  onDeleted,
}: {
  user: AdminUserRow | null
  onOpenChange: (open: boolean) => void
  onDeleted: (user: AdminUserRow) => void
}) {
  const t = useScreenT(usersMessages)
  const a = useScreenT(adminMessages)
  const lang = useScreenLang()
  const { api } = useAdmin()
  const id = useId()
  const [typed, setTyped] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const email = user?.email ?? ""
  const matches = typed.trim().toLowerCase() === email.toLowerCase() && email !== ""
  const mismatch = typed.trim() !== "" && !matches && !email.toLowerCase().startsWith(typed.trim().toLowerCase())

  function close(next: boolean) {
    if (pending || next) return
    setTyped("")
    setError(null)
    onOpenChange(false)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!user || !matches || pending) return
    setPending(true)
    setError(null)
    try {
      await api.deleteUser(user.id, typed.trim())
      toast.success(t("deleted_toast"), { description: user.email })
      setPending(false)
      setTyped("")
      onDeleted(user)
      onOpenChange(false)
    } catch (err) {
      setError(err)
      setPending(false)
    }
  }

  return (
    <Dialog open={user !== null} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="break-all">{t("delete_title", { email })}</DialogTitle>
            <DialogDescription>{t("delete_body")}</DialogDescription>
          </DialogHeader>
          {error ? (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertDescription>{describeAdminError(error, lang)}</AlertDescription>
            </Alert>
          ) : null}
          <Field data-invalid={mismatch ? true : undefined}>
            <FieldLabel htmlFor={`${id}-confirm`}>{t("delete_type")}</FieldLabel>
            <Input
              id={`${id}-confirm`}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={email}
              value={typed}
              onChange={(event) => {
                setTyped(event.target.value)
                setError(null)
              }}
              aria-invalid={mismatch ? true : undefined}
              aria-describedby={`${id}-confirm-hint`}
              disabled={pending}
              autoFocus
            />
            {mismatch ? (
              <FieldError id={`${id}-confirm-hint`}>{t("delete_mismatch", { email })}</FieldError>
            ) : (
              <FieldDescription id={`${id}-confirm-hint`} className="text-xs break-all">
                {email}
              </FieldDescription>
            )}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={pending}>
              {a("cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={!matches || pending}>
              {pending ? (
                <>
                  <Spinner /> {t("deleting")}
                </>
              ) : (
                t("delete_confirm")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
