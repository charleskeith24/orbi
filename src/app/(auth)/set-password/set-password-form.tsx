"use client"

import { CircleAlert, KeyRound, LogIn, ShieldCheck } from "lucide-react"
import { useState } from "react"
import { AuthCard, AuthNotice } from "@/components/features/auth/auth-card"
import { authPageHref, describeAuthError } from "@/components/features/auth/auth-client"
import { useAuthUser } from "@/components/features/auth/use-auth-user"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useT } from "@/lib/i18n"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { setPasswordMessages } from "./set-password-messages"

/** Supabase hashes passwords with bcrypt, which ignores anything past 72 bytes. */
const MAX_PASSWORD_BYTES = 72

/** Sets (or changes) the signed-in user's password. `next` is already sanitized by the page. */
export function SetPasswordForm({ next }: { next: string }) {
  const t = useT(setPasswordMessages)
  const { user, loading } = useAuthUser()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [touched, setTouched] = useState({ password: false, confirm: false })
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const passwordError =
    password.length < 8 ? t("too_short") : new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES ? t("too_long") : null
  const confirmError = confirm !== password ? t("mismatch") : null
  const valid = !passwordError && !confirmError

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTouched({ password: true, confirm: true })
    if (!valid || pending) return
    setPending(true)
    setFormError(null)
    const { error } = await getSupabaseBrowserClient().auth.updateUser({ password })
    setPending(false)
    if (error) setFormError(error.code === "reauthentication_needed" ? t("reauth") : describeAuthError(error))
    else setDone(true)
  }

  if (done) {
    return (
      <AuthNotice
        icon={ShieldCheck}
        title={t("done_title")}
        actions={
          <Button size="lg" onClick={() => window.location.assign(next)}>
            {t("continue")}
          </Button>
        }
      >
        {t("done_body")}
      </AuthNotice>
    )
  }

  if (!loading && !user) {
    return (
      <AuthNotice
        icon={LogIn}
        title={t("signed_out_title")}
        actions={
          <Button size="lg" onClick={() => window.location.assign(authPageHref("/login", "/set-password"))}>
            {t("sign_in")}
          </Button>
        }
      >
        {t("signed_out_body")}
      </AuthNotice>
    )
  }

  const passwordShown = touched.password ? passwordError : null
  const confirmShown = touched.confirm ? confirmError : null

  return (
    <AuthCard title={t("title")} description={user?.email ? t("description_for", { email: user.email }) : t("description")}>
      {formError ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <form
        onSubmit={submit}
        onKeyDown={(event) => {
          // The submit button is disabled while invalid, so Enter would otherwise do nothing silently.
          if (event.key === "Enter" && !valid) setTouched({ password: true, confirm: true })
        }}
        noValidate
      >
        <FieldGroup className="gap-4">
          <Field data-invalid={passwordShown ? true : undefined}>
            <FieldLabel htmlFor="new-password">{t("password")}</FieldLabel>
            <Input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              aria-invalid={passwordShown ? true : undefined}
              onChange={(event) => setPassword(event.target.value)}
              onBlur={() => setTouched((s) => ({ ...s, password: true }))}
            />
            {passwordShown ? <FieldError>{passwordShown}</FieldError> : <FieldDescription>{t("password_hint")}</FieldDescription>}
          </Field>
          <Field data-invalid={confirmShown ? true : undefined}>
            <FieldLabel htmlFor="confirm-password">{t("confirm")}</FieldLabel>
            <Input
              id="confirm-password"
              name="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              aria-invalid={confirmShown ? true : undefined}
              onChange={(event) => setConfirm(event.target.value)}
              onBlur={() => setTouched((s) => ({ ...s, confirm: true }))}
            />
            {confirmShown ? <FieldError>{confirmShown}</FieldError> : null}
          </Field>
          <Button type="submit" size="lg" disabled={!valid || pending}>
            {pending ? <Spinner /> : <KeyRound aria-hidden />}
            {pending ? t("saving") : t("submit")}
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  )
}
