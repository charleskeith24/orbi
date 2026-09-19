"use client"

import { CircleAlert, DoorClosed, MailCheck, Wrench } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useScreenT } from "@/components/app-shell/device-ui-lang"
import { AuthCard, AuthNotice, EmailSentence } from "@/components/features/auth/auth-card"
import { authLinkClass, fillTemplate, LegalLinks } from "@/components/features/auth/legal-links"
import { authMessages, authValidationMessages } from "@/components/features/auth/messages"
import { normalizeLink, submitAccessRequest } from "@/components/features/auth/request-access-client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ACCESS_REQUEST_LIMITS, accessRequestErrors, accessRequestSchema, type AccessRequestData } from "@/lib/admin/access-request"
import type { AccessRequestState } from "@/lib/admin/types"
import { cn } from "@/lib/utils"

type FieldName = "name" | "email" | "about" | "link" | "consent"
type ValidationKey = keyof (typeof authValidationMessages)["en"]

const FIELDS: FieldName[] = ["name", "email", "about", "link", "consent"]
const untouched = (): Record<FieldName, boolean> => ({ name: false, email: false, about: false, link: false, consent: false })

type Outcome = "sent" | "closed" | null
type FormError = "request_invalid" | "request_rate_limited" | "request_offline" | "request_error" | null

/**
 * The online version's /signup: a waitlist request the admin approves (docs/ADMIN_BRIEF.md §1). Nobody
 * creates an account here. The server answers "thanks" the same way for every email, so this form never
 * says whether someone already asked or has an account. `state` comes from the page (the admin's
 * "Accepting requests" switch); a 403 `closed` on submit shows the same notice.
 */
export function RequestAccessForm({ state = "open" }: { state?: Exclude<AccessRequestState, "local"> }) {
  const t = useScreenT(authMessages)
  const v = useScreenT(authValidationMessages)
  const [values, setValues] = useState({ name: "", email: "", about: "", link: "", consent: false, website: "" })
  const [touched, setTouched] = useState(untouched)
  const [serverFields, setServerFields] = useState<Partial<Record<keyof AccessRequestData, string>>>({})
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState<FormError>(null)
  const [outcome, setOutcome] = useState<Outcome>(state === "closed" ? "closed" : null)
  const [sentTo, setSentTo] = useState("")
  // Set by the first submit: from then on the button stays disabled until the form is valid. (Disabling on
  // blur instead would swallow the click that blurred the field.)
  const [attempted, setAttempted] = useState(false)

  const parsed = accessRequestSchema.safeParse(values)
  const errors = parsed.success ? {} : accessRequestErrors(parsed.error)
  const errorFor = (name: FieldName): string | undefined => {
    const key = (touched[name] ? errors[name] : undefined) ?? serverFields[name]
    return key && key in authValidationMessages.en ? v(key as ValidationKey) : key ? t("request_invalid") : undefined
  }
  const touchAll = () => setTouched({ name: true, email: true, about: true, link: true, consent: true })

  function set<K extends keyof typeof values>(name: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [name]: value }))
    setServerFields((current) => ({ ...current, [name]: undefined }))
    setFormError(null)
  }
  const touch = (name: FieldName) => setTouched((current) => ({ ...current, [name]: true }))
  const describedBy = (name: FieldName, hint?: boolean) =>
    errorFor(name) ? `request-${name}-error` : hint ? `request-${name}-hint` : undefined

  /** Shows every field's error and focuses the first one. */
  function revealErrors() {
    setAttempted(true)
    touchAll()
    const first = FIELDS.find((name) => errors[name])
    if (first) document.getElementById(`request-${first}`)?.focus()
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!parsed.success || pending) {
      revealErrors()
      return
    }
    setPending(true)
    setFormError(null)
    const result = await submitAccessRequest(parsed.data)
    setPending(false)
    switch (result.status) {
      case "ok":
        setSentTo(parsed.data.email)
        setOutcome("sent")
        break
      case "closed":
        setOutcome("closed")
        break
      case "invalid":
        setServerFields(result.fields)
        setFormError("request_invalid")
        break
      case "rate_limited":
        setFormError("request_rate_limited")
        break
      case "offline":
        setFormError("request_offline")
        break
      default:
        setFormError("request_error")
    }
  }

  if (outcome === "sent") {
    return (
      <AuthNotice
        icon={MailCheck}
        title={t("request_sent_title")}
        actions={
          <Button variant="outline" size="lg" asChild>
            <Link href="/login">{t("back_to_sign_in")}</Link>
          </Button>
        }
      >
        <EmailSentence template={t("request_sent_body")} email={sentTo} />
      </AuthNotice>
    )
  }

  if (state === "not_configured") {
    return (
      <AuthNotice icon={Wrench} title={t("unconfigured_title")}>
        {t("unconfigured_body")}
      </AuthNotice>
    )
  }

  if (outcome === "closed") {
    return (
      <AuthNotice
        icon={DoorClosed}
        title={t("closed_title")}
        actions={
          <Button variant="outline" size="lg" asChild>
            <Link href="/login">{t("back_to_sign_in")}</Link>
          </Button>
        }
      >
        {t("closed_body")}
      </AuthNotice>
    )
  }

  const nameError = errorFor("name")
  const emailError = errorFor("email")
  const aboutError = errorFor("about")
  const linkError = errorFor("link")
  const consentError = errorFor("consent")
  const aboutLength = values.about.trim().length

  return (
    <AuthCard
      title={t("request_title")}
      description={t("request_description")}
      footer={
        <>
          <p>
            {t("have_account")}{" "}
            <Link href="/login" className={authLinkClass}>
              {t("sign_in")}
            </Link>
          </p>
          <p className="mt-1.5 text-xs">
            <LegalLinks />
          </p>
        </>
      }
    >
      {formError ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{t(formError)}</AlertDescription>
        </Alert>
      ) : null}

      <form
        onSubmit={submit}
        onKeyDown={(event) => {
          // The submit button is disabled after a failed attempt, so Enter would otherwise do nothing.
          if (event.key === "Enter" && event.target instanceof HTMLInputElement && !parsed.success) {
            event.preventDefault()
            revealErrors()
          }
        }}
        noValidate
        className="relative"
      >
        <FieldGroup className="gap-4">
          <Field data-invalid={nameError ? true : undefined}>
            <FieldLabel htmlFor="request-name">{t("name")}</FieldLabel>
            <Input
              id="request-name"
              name="name"
              autoComplete="name"
              placeholder={t("name_placeholder")}
              maxLength={ACCESS_REQUEST_LIMITS.name + 20}
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              onBlur={() => touch("name")}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={describedBy("name")}
              disabled={pending}
              autoFocus
            />
            <FieldError id="request-name-error">{nameError}</FieldError>
          </Field>

          <Field data-invalid={emailError ? true : undefined}>
            <FieldLabel htmlFor="request-email">{t("email")}</FieldLabel>
            <Input
              id="request-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t("email_placeholder")}
              value={values.email}
              onChange={(event) => set("email", event.target.value)}
              onBlur={() => touch("email")}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={describedBy("email")}
              disabled={pending}
            />
            <FieldError id="request-email-error">{emailError}</FieldError>
          </Field>

          <Field data-invalid={aboutError ? true : undefined}>
            <div className="flex items-baseline justify-between gap-2">
              <FieldLabel htmlFor="request-about">
                {t("about_label")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
              </FieldLabel>
              <span
                className={cn("num text-xs text-muted-foreground", aboutLength > ACCESS_REQUEST_LIMITS.about && "text-destructive")}
                aria-hidden
              >
                {t("about_count", { count: aboutLength, max: ACCESS_REQUEST_LIMITS.about })}
              </span>
            </div>
            <Textarea
              id="request-about"
              name="about"
              rows={2}
              placeholder={t("about_placeholder")}
              value={values.about}
              onChange={(event) => set("about", event.target.value)}
              onBlur={() => touch("about")}
              aria-invalid={aboutError ? true : undefined}
              aria-describedby={describedBy("about")}
              disabled={pending}
              className="max-h-40"
            />
            <FieldError id="request-about-error">{aboutError}</FieldError>
          </Field>

          <Field data-invalid={linkError ? true : undefined}>
            <FieldLabel htmlFor="request-link">
              {t("link_label")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
            </FieldLabel>
            <Input
              id="request-link"
              name="link"
              type="url"
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t("link_placeholder")}
              value={values.link}
              onChange={(event) => set("link", event.target.value)}
              onBlur={() => {
                set("link", normalizeLink(values.link))
                touch("link")
              }}
              aria-invalid={linkError ? true : undefined}
              aria-describedby={describedBy("link", true)}
              disabled={pending}
            />
            {linkError ? (
              <FieldError id="request-link-error">{linkError}</FieldError>
            ) : (
              <FieldDescription id="request-link-hint" className="text-xs">
                {t("link_hint")}
              </FieldDescription>
            )}
          </Field>

          <Field data-invalid={consentError ? true : undefined}>
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="request-consent"
                checked={values.consent}
                onCheckedChange={(checked) => {
                  set("consent", checked === true)
                  touch("consent")
                }}
                aria-invalid={consentError ? true : undefined}
                aria-describedby={describedBy("consent")}
                disabled={pending}
                className="mt-0.5"
              />
              <label htmlFor="request-consent" className="text-sm leading-snug font-normal text-muted-foreground">
                {/* New tab, so the half-filled form stays put. */}
                {fillTemplate(t("consent_label"), {
                  terms: (
                    <Link href="/terms" target="_blank" rel="noopener" className={authLinkClass}>
                      {t("consent_terms")}
                    </Link>
                  ),
                  privacy: (
                    <Link href="/privacy" target="_blank" rel="noopener" className={authLinkClass}>
                      {t("consent_privacy")}
                    </Link>
                  ),
                })}
              </label>
            </div>
            <FieldError id="request-consent-error">{consentError}</FieldError>
          </Field>

          {/* Honeypot: hidden from people and assistive tech; bots fill it and are dropped server-side. */}
          <div aria-hidden className="absolute -left-[10000px] top-auto size-px overflow-hidden">
            <label htmlFor="request-website">{t("honeypot_label")}</label>
            <input
              id="request-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={values.website}
              onChange={(event) => set("website", event.target.value)}
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={pending || (attempted && !parsed.success)}>
            {pending ? (
              <>
                <Spinner /> {t("request_sending")}
              </>
            ) : (
              t("request_submit")
            )}
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  )
}
