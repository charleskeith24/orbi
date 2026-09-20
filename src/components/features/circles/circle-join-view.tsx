"use client"

import { ArrowLeft, ArrowRight, CircleAlert, LogIn, UsersRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { toast } from "sonner"
import { FormField, InfoHint, PageContainer } from "@/components/common"
import { useAdminResource as useResource } from "@/components/features/admin/use-admin-resource"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { isInviteCode } from "@/lib/circles/invite"
import { CIRCLE_LIMITS, type InvitePreview } from "@/lib/circles/types"
import { useT } from "@/lib/i18n"
import { isValidName, useSuggestedDisplayName } from "./circle-dialogs"
import { useCircleAction } from "./circle-errors"
import { CirclesFrame, CirclesLoadError, SampleDataNote, useCircles } from "./circles-client"
import { PrivacySummary } from "./circles-view"
import { circleFormMessages, circlesMessages } from "./messages"

/**
 * `/circles/join/<code>` — what the invite opens (name and size only), your name for this circle, "Join".
 * Signed-out visitors never get here: the proxy sends them through `/login?next=` first.
 */
export function CircleJoinView({ code }: { code: string }) {
  return (
    <CirclesFrame>
      <JoinCircle code={code} />
    </CirclesFrame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer width="narrow">
      <SampleDataNote />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">{children}</div>
    </PageContainer>
  )
}

function Problem({ title, body }: { title: string; body: string }) {
  const t = useT(circleFormMessages)
  return (
    <Frame>
      <section role="alert" className="rounded-lg border bg-card p-5 text-card-foreground">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <CircleAlert className="size-4.5 shrink-0 text-warning-fg" aria-hidden />
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/circles">
            <ArrowLeft aria-hidden />
            {t("back")}
          </Link>
        </Button>
      </section>
    </Frame>
  )
}

function JoinCircle({ code }: { code: string }) {
  const t = useT(circleFormMessages)
  const l = useT(circlesMessages)
  const { api } = useCircles()
  const valid = isInviteCode(code)
  const preview = useResource<InvitePreview | null>(`invite:${api.self}:${code}`, () => (valid ? api.previewInvite(code) : Promise.resolve(null)))

  if (!valid) return <Problem title={t("invalid_title")} body={t("invalid_body")} />
  if (preview.error && !preview.data) {
    return (
      <Frame>
        <CirclesLoadError error={preview.error} onRetry={preview.reload} />
      </Frame>
    )
  }
  if (preview.loading && !preview.data) {
    return (
      <Frame>
        <div role="status" aria-busy="true" aria-label={l("loading")} className="flex flex-col gap-3 rounded-lg border bg-card p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-64 max-w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </Frame>
    )
  }
  const circle = preview.data
  if (!circle) return <Problem title={t("expired_title")} body={t("expired_body")} />

  return (
    <Frame>
      <section className="rounded-lg border bg-card p-5 text-card-foreground">
        <p className="text-xs text-muted-foreground">{t("invited")}</p>
        <h1 className="mt-0.5 flex items-center gap-2 text-lg font-semibold">
          <UsersRound className="size-4.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 break-words">{circle.name}</span>
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground num">{l.plural("members", circle.members)}</p>
        {circle.is_member ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm">{t("already_member", { name: circle.name })}</p>
            <Button asChild className="self-start">
              <Link href={`/circles/${circle.circle_id}`}>
                {t("open_circle")}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        ) : circle.is_full ? (
          <p role="alert" className="mt-4 text-sm text-muted-foreground">
            {t("full", { name: circle.name })}
          </p>
        ) : (
          <JoinForm code={code} name={circle.name} />
        )}
      </section>
      <PrivacySummary />
    </Frame>
  )
}

function JoinForm({ code, name }: { code: string; name: string }) {
  const t = useT(circleFormMessages)
  const id = useId()
  const router = useRouter()
  const { api } = useCircles()
  const { pending, run } = useCircleAction()
  const suggested = useSuggestedDisplayName()
  const [displayName, setDisplayName] = useState(suggested)
  const [touched, setTouched] = useState(false)
  const valid = isValidName(displayName, CIRCLE_LIMITS.displayName)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!valid || pending) return
    const joined: { id: string | null } = { id: null }
    const ok = await run("join", async () => {
      joined.id = (await api.joinCircle({ code, displayName: displayName.trim() })).circleId
    })
    if (ok && joined.id) {
      toast.success(t("joined", { name }))
      router.push(`/circles/${joined.id}`)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-4">
      <FormField
        label={t("display_name")}
        htmlFor={`${id}-display`}
        labelAction={<InfoHint title={t("display_name")}>{t("display_name_help")}</InfoHint>}
        error={touched && !valid ? t("error_display_name") : undefined}
        required
      >
        <Input
          id={`${id}-display`}
          value={displayName}
          autoFocus
          maxLength={CIRCLE_LIMITS.displayName}
          aria-invalid={(touched && !valid) || undefined}
          onChange={(e) => setDisplayName(e.target.value)}
          onBlur={() => setTouched(true)}
        />
      </FormField>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost">
          <Link href="/circles">
            <ArrowLeft aria-hidden />
            {t("back")}
          </Link>
        </Button>
        <Button type="submit" disabled={!valid || pending !== null}>
          {pending ? <Spinner /> : <LogIn aria-hidden />}
          {pending ? t("joining") : t("join_submit")}
        </Button>
      </div>
    </form>
  )
}
