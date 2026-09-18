"use client"

import { Check, CircleAlert, MailCheck } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { useScreenLang, useScreenT } from "@/components/app-shell/device-ui-lang"
import { AuthCard, AuthNotice, EmailSentence } from "@/components/features/auth/auth-card"
import { authPageHref, describeAuthError, emailRedirectUrl, type AuthErrorLike } from "@/components/features/auth/auth-client"
import { authSchemas, fieldErrors, type SignUpValues } from "@/components/features/auth/auth-schemas"
import { authMessages } from "@/components/features/auth/messages"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type FieldName = keyof SignUpValues

const linkClass = "font-medium text-foreground underline-offset-4 hover:underline"

/** Email + password sign-up. Shows "Check your email to confirm" when the project requires confirmation. */
export function SignupForm({ next }: { next: string }) {
  const t = useScreenT(authMessages)
  const lang = useScreenLang()
  const { signUpSchema } = useMemo(() => authSchemas(lang), [lang])
  const [values, setValues] = useState<SignUpValues>({ full_name: "", email: "", password: "" })
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({ full_name: false, email: false, password: false })
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState<AuthErrorLike | null>(null)
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)
  const [resend, setResend] = useState<"idle" | "sending" | "sent">("idle")

  const parsed = signUpSchema.safeParse(values)
  const errors = parsed.success ? {} : fieldErrors(parsed.error)
  const errorFor = (name: FieldName) => (touched[name] ? errors[name] : undefined)
  const touchAll = () => setTouched({ full_name: true, email: true, password: true })

  const inputProps = (name: FieldName) => ({
    id: `signup-${name}`,
    name,
    value: values[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [name]: event.target.value })),
    onBlur: () => setTouched((t) => ({ ...t, [name]: true })),
    "aria-invalid": errorFor(name) ? true : undefined,
    "aria-describedby": errorFor(name) ? `signup-${name}-error` : undefined,
    disabled: pending,
  })

  async function signUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    touchAll()
    if (!parsed.success || pending) return
    setPending(true)
    setFormError(null)
    const { email, password, full_name } = parsed.data
    const { data, error } = await getSupabaseBrowserClient().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: emailRedirectUrl(next), data: full_name ? { full_name } : undefined },
    })
    if (error) {
      setFormError(error)
      setPending(false)
      return
    }
    if (data.session) {
      // Email confirmation is off: the account is live, go straight in.
      window.location.assign(next)
      return
    }
    setPending(false)
    // Supabase doesn't reveal existing accounts, but returns no identities for them.
    if (data.user && data.user.identities?.length === 0) {
      setFormError({ code: "user_already_exists" })
      return
    }
    setConfirmEmail(email)
  }

  async function resendConfirmation() {
    if (!confirmEmail || resend !== "idle") return
    setResend("sending")
    setFormError(null)
    const { error } = await getSupabaseBrowserClient().auth.resend({
      type: "signup",
      email: confirmEmail,
      options: { emailRedirectTo: emailRedirectUrl(next) },
    })
    if (error) {
      setFormError(error)
      setResend("idle")
    } else setResend("sent")
  }

  if (confirmEmail) {
    return (
      <AuthNotice
        icon={MailCheck}
        title={t("confirm_title")}
        actions={
          <>
            <Button variant="outline" size="lg" onClick={() => void resendConfirmation()} disabled={resend !== "idle"}>
              {resend === "sending" ? (
                <>
                  <Spinner /> {t("sending")}
                </>
              ) : resend === "sent" ? (
                <>
                  <Check aria-hidden /> {t("confirmation_resent")}
                </>
              ) : (
                t("resend_confirmation")
              )}
            </Button>
            <Button variant="ghost" size="lg" asChild>
              <Link href={authPageHref("/login", next)}>{t("back_to_sign_in")}</Link>
            </Button>
            {formError ? <p className="text-sm text-destructive">{describeAuthError(formError, lang)}</p> : null}
          </>
        }
      >
        <EmailSentence template={t("confirm_sent")} email={confirmEmail} />
      </AuthNotice>
    )
  }

  const nameError = errorFor("full_name")
  const emailError = errorFor("email")
  const passwordError = errorFor("password")

  return (
    <AuthCard
      title={t("signup_title")}
      description={t("signup_description")}
      footer={
        <>
          {t("have_account")}{" "}
          <Link href={authPageHref("/login", next)} className={linkClass}>
            {t("sign_in")}
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
        onSubmit={signUp}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !parsed.success) touchAll()
        }}
        noValidate
      >
        <FieldGroup className="gap-4">
          <Field data-invalid={nameError ? true : undefined}>
            <FieldLabel htmlFor="signup-full_name">
              {t("name")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
            </FieldLabel>
            <Input {...inputProps("full_name")} autoComplete="name" placeholder={t("name_placeholder")} autoFocus />
            <FieldError id="signup-full_name-error">{nameError}</FieldError>
          </Field>
          <Field data-invalid={emailError ? true : undefined}>
            <FieldLabel htmlFor="signup-email">{t("email")}</FieldLabel>
            <Input
              {...inputProps("email")}
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t("email_placeholder")}
            />
            <FieldError id="signup-email-error">{emailError}</FieldError>
          </Field>
          <Field data-invalid={passwordError ? true : undefined}>
            <FieldLabel htmlFor="signup-password">{t("password")}</FieldLabel>
            <Input {...inputProps("password")} type="password" autoComplete="new-password" />
            {passwordError ? (
              <FieldError id="signup-password-error">{passwordError}</FieldError>
            ) : (
              <FieldDescription className="text-xs">{t("password_hint")}</FieldDescription>
            )}
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={pending || !parsed.success}>
            {pending ? (
              <>
                <Spinner /> {t("creating_account")}
              </>
            ) : (
              t("create_account")
            )}
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  )
}
