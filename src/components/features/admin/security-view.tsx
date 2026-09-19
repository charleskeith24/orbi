"use client"

import { CircleAlert, Copy, KeyRound, Plus, ShieldCheck, Smartphone, Trash2 } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"
import { EmptyState, PageHeader, useConfirm } from "@/components/common"
import { useScreenLang, useScreenT } from "@/components/app-shell/device-ui-lang"
import { copyText } from "@/components/features/feedback/feedback-model"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { cleanCode, describeMfaError, isSixDigitCode, type MfaEnrollment, type MfaFactor } from "./api/mfa-client"
import { useAdmin } from "./admin-context"
import { adminDate, AdminLoading, adminRelativeInline } from "./admin-ui"
import { adminMessages, securityMessages } from "./messages"
import { useAdminResource } from "./use-admin-resource"

export type SecurityMode = "enroll" | "challenge" | "manage"

/**
 * /admin/security — 2-step verification (TOTP). `enroll` and `challenge` come from the gate (an admin
 * without AAL2); `manage` lists and removes authenticators. With the dev fixture, `?preview=enroll|challenge`
 * shows the other two screens on sample data.
 */
export function SecurityView({ mode, preview }: { mode: SecurityMode; preview?: string }) {
  const t = useScreenT(securityMessages)
  const { source, self } = useAdmin()
  const router = useRouter()
  const effective: SecurityMode = source === "fixture" && (preview === "enroll" || preview === "challenge") ? preview : mode

  // Live: a full page load, so the server gate reads the upgraded (AAL2) session from fresh cookies.
  const openAdmin = useCallback(() => {
    if (source === "live") window.location.assign(new URL("/admin", window.location.href).href)
    else router.push("/admin")
  }, [router, source])

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {effective !== "manage" && self?.email ? (
        <p className="-mt-3 text-xs text-muted-foreground">
          {t("signed_in_as", { email: self.email })} · {t("restricted_note")}
        </p>
      ) : null}
      {source === "fixture" ? (
        <p role="note" className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {t("sample_note")}
        </p>
      ) : null}
      <div className="max-w-xl">
        {effective === "enroll" ? (
          <EnrollFlow
            intro
            onEnrolled={() => {
              toast.success(t("enrolled_toast"))
              openAdmin()
            }}
          />
        ) : effective === "challenge" ? (
          <ChallengeCard
            onVerified={() => {
              toast.success(t("verified_toast"))
              openAdmin()
            }}
          />
        ) : (
          <ManageFactors />
        )}
      </div>
    </>
  )
}

/* ------------------------------ Code entry -------------------------------- */

function CodeForm({
  submitLabel,
  onSubmit,
  autoFocus = true,
  children,
}: {
  submitLabel?: string
  onSubmit: (code: string) => Promise<void>
  autoFocus?: boolean
  children?: React.ReactNode
}) {
  const t = useScreenT(securityMessages)
  const lang = useScreenLang()
  const id = useId()
  const [code, setCode] = useState("")
  const [touched, setTouched] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const valid = isSixDigitCode(code)
  const fieldError = touched && !valid ? t("code_invalid") : undefined

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!valid || pending) return
    setPending(true)
    setError(null)
    try {
      await onSubmit(code)
    } catch (err) {
      setError(err)
      setCode("")
      setTouched(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {children}
      {error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{describeMfaError(error, lang)}</AlertDescription>
        </Alert>
      ) : null}
      <Field data-invalid={fieldError ? true : undefined}>
        <FieldLabel htmlFor={`${id}-code`}>{t("code_label")}</FieldLabel>
        <div className="flex flex-wrap items-start gap-2">
          <Input
            id={`${id}-code`}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={7}
            placeholder="123456"
            value={code}
            onChange={(event) => {
              setCode(cleanCode(event.target.value))
              setError(null)
            }}
            onBlur={() => setTouched(code.length > 0)}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={`${id}-code-hint`}
            disabled={pending}
            autoFocus={autoFocus}
            className="w-36 text-center font-mono text-base tracking-[0.3em]"
          />
          <Button type="submit" disabled={pending || (touched && !valid)}>
            {pending ? (
              <>
                <Spinner /> {t("verifying")}
              </>
            ) : (
              (submitLabel ?? t("verify"))
            )}
          </Button>
        </div>
        {fieldError ? (
          <FieldError id={`${id}-code-hint`}>{fieldError}</FieldError>
        ) : (
          <FieldDescription id={`${id}-code-hint`} className="text-xs">
            {t("code_hint")}
          </FieldDescription>
        )}
      </Field>
    </form>
  )
}

/* -------------------------------- Enroll ---------------------------------- */

/** Start → scan QR (or type the key) → verify a code. Drops an abandoned enrollment on cancel/unmount. */
function EnrollFlow({ intro = false, onEnrolled, onCancel }: { intro?: boolean; onEnrolled: () => void; onCancel?: () => void }) {
  const t = useScreenT(securityMessages)
  const a = useScreenT(adminMessages)
  const lang = useScreenLang()
  const { mfa } = useAdmin()
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const pendingFactor = useRef<string | null>(null)

  useEffect(() => {
    const pending = pendingFactor
    return () => {
      // Unfinished setup left behind (navigated away) → remove it so the next attempt starts clean.
      if (pending.current) void mfa.unenroll(pending.current).catch(() => {})
    }
  }, [mfa])

  async function start() {
    setStarting(true)
    setError(null)
    try {
      const started = await mfa.enroll()
      pendingFactor.current = started.factorId
      setEnrollment(started)
    } catch (err) {
      setError(err)
    } finally {
      setStarting(false)
    }
  }

  async function cancel() {
    const factorId = pendingFactor.current
    pendingFactor.current = null
    setEnrollment(null)
    if (factorId) await mfa.unenroll(factorId).catch(() => {})
    onCancel?.()
  }

  if (!enrollment) {
    return (
      <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5">
        {intro ? (
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
              <ShieldCheck className="size-4.5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <h2 className="text-base font-semibold">{t("enroll_title")}</h2>
              <p className="text-sm text-muted-foreground">{t("enroll_intro")}</p>
              <p className="text-sm text-muted-foreground">{t("enroll_apps")}</p>
            </div>
          </div>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>{describeMfaError(error, lang)}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void start()} disabled={starting}>
            {starting ? <Spinner /> : <Smartphone aria-hidden />}
            {starting ? t("starting") : t("enroll_start")}
          </Button>
          {onCancel ? (
            <Button variant="outline" onClick={onCancel} disabled={starting}>
              {a("cancel")}
            </Button>
          ) : null}
        </div>
      </section>
    )
  }

  const groupedSecret = enrollment.secret.replace(/(.{4})/g, "$1 ").trim()

  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{t("scan_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("scan_body")}</p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Image
          src={enrollment.qrCode}
          alt={t("qr_alt")}
          width={176}
          height={176}
          unoptimized
          className="size-44 shrink-0 rounded-md border bg-white p-2"
        />
        <div className="min-w-0 space-y-2">
          <p className="text-sm text-muted-foreground">{t("cant_scan")}</p>
          <p className="rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm break-all text-foreground">{groupedSecret}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              void copyText(enrollment.secret).then((ok) => {
                if (ok) toast.success(t("secret_copied"))
              })
            }
          >
            <Copy aria-hidden />
            {t("copy_secret")}
          </Button>
        </div>
      </div>
      <CodeForm
        autoFocus={false}
        onSubmit={async (code) => {
          await mfa.verify(enrollment.factorId, code)
          pendingFactor.current = null
          onEnrolled()
        }}
      />
      <div>
        <Button type="button" variant="ghost" size="sm" onClick={() => void cancel()}>
          {a("cancel")}
        </Button>
      </div>
    </section>
  )
}

/* ------------------------------- Challenge -------------------------------- */

function ChallengeCard({ onVerified }: { onVerified: () => void }) {
  const t = useScreenT(securityMessages)
  const lang = useScreenLang()
  const { mfa } = useAdmin()
  const id = useId()
  const factors = useAdminResource("mfa-factors", () => mfa.listFactors())
  const [picked, setPicked] = useState<string>("")
  const list = factors.data ?? []
  const factorId = picked || list[0]?.id || ""

  if (!factors.data && factors.loading) return <AdminLoading label={t("loading_label")} rows={2} />
  if (factors.error) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertDescription>{describeMfaError(factors.error, lang)}</AlertDescription>
      </Alert>
    )
  }
  // A factor was expected but none is left (removed elsewhere): set one up instead.
  if (!list.length) return <EnrollFlow intro onEnrolled={onVerified} />

  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
          <KeyRound className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold">{t("challenge_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("challenge_body")}</p>
        </div>
      </div>
      <CodeForm onSubmit={(code) => mfa.verify(factorId, code).then(onVerified)}>
        {list.length > 1 ? (
          <Field>
            <FieldLabel htmlFor={`${id}-factor`}>{t("factor_label")}</FieldLabel>
            <NativeSelect id={`${id}-factor`} value={factorId} onChange={(event) => setPicked(event.target.value)}>
              {list.map((factor) => (
                <NativeSelectOption key={factor.id} value={factor.id}>
                  {factor.name || t("factor_unnamed")}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        ) : null}
      </CodeForm>
    </section>
  )
}

/* -------------------------------- Manage ---------------------------------- */

function ManageFactors() {
  const t = useScreenT(securityMessages)
  const a = useScreenT(adminMessages)
  const lang = useScreenLang()
  const { mfa, source } = useAdmin()
  const [confirm, confirmDialog] = useConfirm()
  const factors = useAdminResource("mfa-factors", () => mfa.listFactors())
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const list = factors.data ?? []

  async function remove(factor: MfaFactor) {
    const name = factor.name || t("factor_unnamed")
    const last = list.length === 1
    const ok = await confirm({
      title: t("remove_title", { name }),
      description: last ? t("remove_last_body") : t("remove_body"),
      confirmLabel: t("remove"),
      cancelLabel: a("cancel"),
    })
    if (!ok) return
    setRemoving(factor.id)
    try {
      await mfa.unenroll(factor.id)
      toast.success(t("removed_toast"), { description: name })
      // Without a factor the session can't stay AAL2: let the gate send this admin to enrollment.
      if (last && source === "live") window.location.reload()
      else factors.reload()
    } catch (error) {
      toast.error(describeMfaError(error, lang))
    } finally {
      setRemoving(null)
    }
  }

  if (!factors.data && factors.loading) return <AdminLoading label={t("loading_label")} rows={2} />

  return (
    <div className="flex flex-col gap-4">
      {factors.error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{describeMfaError(factors.error, lang)}</span>
            <Button size="sm" variant="outline" onClick={factors.reload}>
              {a("retry")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <section className="rounded-lg border bg-card">
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-3.5 pb-3">
          <div className="min-w-0">
            <h2 className="text-sm font-medium">{t("manage_title")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("manage_body")}</p>
          </div>
          {list.length && !adding ? (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus aria-hidden />
              {t("add_another")}
            </Button>
          ) : null}
        </header>
        {list.length ? (
          <ul className="divide-y border-t">
            {list.map((factor) => {
              const name = factor.name || t("factor_unnamed")
              return (
                <li key={factor.id} className="flex items-center gap-3 px-4 py-3">
                  <Smartphone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("factor_added", { date: adminDate(factor.created_at) })}
                      {factor.last_used_at ? ` · ${t("factor_last_used", { date: adminRelativeInline(factor.last_used_at, lang) })}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t("remove_aria", { name })}
                    disabled={removing !== null}
                    onClick={() => void remove(factor)}
                  >
                    {removing === factor.id ? <Spinner /> : <Trash2 aria-hidden />}
                    <span className="hidden sm:inline">{t("remove")}</span>
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : !adding ? (
          <div className="border-t">
            <EmptyState
              compact
              icon={ShieldCheck}
              title={t("none_title")}
              description={t("none_body")}
              action={
                <Button size="sm" onClick={() => setAdding(true)}>
                  <Plus aria-hidden />
                  {t("enroll_start")}
                </Button>
              }
            />
          </div>
        ) : null}
      </section>
      {adding ? (
        <EnrollFlow
          onEnrolled={() => {
            toast.success(t("enrolled_toast"))
            setAdding(false)
            factors.reload()
          }}
          onCancel={() => setAdding(false)}
        />
      ) : null}
      {confirmDialog}
    </div>
  )
}
