"use client"

import { CircleAlert, Mail, MailCheck } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { useScreenLang, useScreenT } from "@/components/app-shell/device-ui-lang"
import { AuthCard, AuthDivider, AuthNotice, EmailSentence } from "@/components/features/auth/auth-card"
import { authPageHref, describeAuthError, emailRedirectUrl, type AuthErrorLike } from "@/components/features/auth/auth-client"
import { authSchemas, fieldErrors } from "@/components/features/auth/auth-schemas"
import { authMessages } from "@/components/features/auth/messages"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type Pending = "password" | "magic" | null

/** Email + password sign-in with a magic-link alternative. `next` is already sanitized by the page. */
export function LoginForm({ next, errorCode }: { next: string; errorCode?: string }) {
  const t = useScreenT(authMessages)
  const lang = useScreenLang()
  const { signInSchema, magicLinkSchema } = useMemo(() => authSchemas(lang), [lang])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [touched, setTouched] = useState({ email: false, password: false })
  const [pending, setPending] = useState<Pending>(null)
  // Kept as the error itself so the message follows the language.
  const [formError, setFormError] = useState<AuthErrorLike | null>(errorCode ? { code: errorCode } : null)
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null)

  const parsed = signInSchema.safeParse({ email, password })
  const errors = parsed.success ? {} : fieldErrors(parsed.error)
  const emailError = touched.email ? errors.email : undefined
  const passwordError = touched.password ? errors.password : undefined
  const busy = pending !== null

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTouched({ email: true, password: true })
    if (!parsed.success || busy) return
    setPending("password")
    setFormError(null)
    const { error } = await getSupabaseBrowserClient().auth.signInWithPassword(parsed.data)
    if (error) {
      setFormError(error)
      setPending(null)
      return
    }
    // Full navigation so the proxy sees the new session and the workspace loads fresh for this account.
    window.location.assign(next)
  }

  async function sendMagicLink() {
    setTouched((t) => ({ ...t, email: true }))
    const result = magicLinkSchema.safeParse({ email })
    if (!result.success || busy) return
    setPending("magic")
    setFormError(null)
    const { error } = await getSupabaseBrowserClient().auth.signInWithOtp({
      email: result.data.email,
      options: { emailRedirectTo: emailRedirectUrl(next) },
    })
    setPending(null)
    if (error) setFormError(error)
    else setLinkSentTo(result.data.email)
  }

  if (linkSentTo) {
    return (
      <AuthNotice
        icon={MailCheck}
        title={t("check_inbox")}
        actions={
          <Button variant="outline" size="lg" onClick={() => setLinkSentTo(null)}>
            {t("different_email")}
          </Button>
        }
      >
        <EmailSentence template={t("link_sent")} email={linkSentTo} />
      </AuthNotice>
    )
  }

  return (
    <AuthCard
      title={t("sign_in")}
      description={t("sign_in_description")}
      footer={
        <>
          {t("new_here")}{" "}
          <Link
            href={authPageHref("/signup", next)}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("create_account_link")}
          </Link>
        </>
      }
    >
      {formError ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{describeAuthError(formError, lang)}</AlertDescription>
        </Alert>
      ) : null}

      <form
        onSubmit={signIn}
        onKeyDown={(event) => {
          // The submit button is disabled while invalid, so Enter would otherwise do nothing silently.
          if (event.key === "Enter" && !parsed.success) setTouched({ email: true, password: true })
        }}
        noValidate
      >
        <FieldGroup className="gap-4">
          <Field data-invalid={emailError ? true : undefined}>
            <FieldLabel htmlFor="login-email">{t("email")}</FieldLabel>
            <Input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t("email_placeholder")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? "login-email-error" : undefined}
              disabled={busy}
              autoFocus
            />
            <FieldError id="login-email-error">{emailError}</FieldError>
          </Field>
          <Field data-invalid={passwordError ? true : undefined}>
            <FieldLabel htmlFor="login-password">{t("password")}</FieldLabel>
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? "login-password-error" : undefined}
              disabled={busy}
            />
            <FieldError id="login-password-error">{passwordError}</FieldError>
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={busy || !parsed.success}>
            {pending === "password" ? (
              <>
                <Spinner /> {t("signing_in")}
              </>
            ) : (
              t("sign_in")
            )}
          </Button>
        </FieldGroup>
      </form>

      <AuthDivider />

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => void sendMagicLink()}
        disabled={busy || Boolean(errors.email)}
      >
        {pending === "magic" ? (
          <>
            <Spinner /> {t("sending_link")}
          </>
        ) : (
          <>
            <Mail aria-hidden /> {t("magic_link")}
          </>
        )}
      </Button>
    </AuthCard>
  )
}
