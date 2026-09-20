"use client"

import { Blend, Check, ChevronDown, Hand, Megaphone, Plus, Undo2, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useMemo, useState } from "react"
import { toast } from "sonner"
import { CopyButton, EmptyState, FormField, OptionSelect, SectionCard, StatusPill } from "@/components/common"
import { COLLAB_TYPE_ICONS, useCollabTypeOptions } from "@/components/features/collabs/collab-ui"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { CIRCLE_LIMITS, type CircleAsk, type CircleAskInterest, type CircleMember, type CircleSnapshot } from "@/lib/circles/types"
import { formatRelativeDay } from "@/lib/dates"
import { useT, useUiLang } from "@/lib/i18n"
import { collabTypeMessages } from "@/lib/i18n/messages/collabs"
import { useTable } from "@/lib/store"
import type { CollabType, ID } from "@/lib/types"
import { cn } from "@/lib/utils"
import { addAskToCollabs } from "./circle-actions"
import { useCircleAction } from "./circle-errors"
import { recallAddedCollab } from "./circle-memory"
import { MemberAvatar } from "./circle-ui"
import { useCircles } from "./circles-client"
import { circleAskMessages } from "./messages"

interface AsksProps {
  snapshot: CircleSnapshot
  /** Contacts you may see (yourself and members linked to you by an accepted interest); absent = not loaded. */
  contacts: Record<ID, string | null>
  now: Date
  onChanged: () => void
}

/** "Collab asks": post an ask, say you're interested, accept, see contacts, add to Collabs, close. */
export function CircleAsksSection({ snapshot, contacts, now, onChanged }: AsksProps) {
  const t = useT(circleAskMessages)
  const [composing, setComposing] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const open = snapshot.asks.filter((a) => a.status === "open")
  const closed = snapshot.asks.filter((a) => a.status === "closed")

  return (
    <SectionCard
      title={t("title")}
      info={t("description")}
      action={
        composing ? null : (
          <Button size="sm" variant="outline" onClick={() => setComposing(true)}>
            <Plus aria-hidden />
            {t("post")}
          </Button>
        )
      }
      contentClassName="flex flex-col gap-3"
    >
      {composing ? (
        <AskForm
          circleId={snapshot.circle.id}
          onCancel={() => setComposing(false)}
          onPosted={() => {
            setComposing(false)
            onChanged()
          }}
        />
      ) : null}

      {open.length ? (
        <ul className="flex flex-col gap-3">
          {open.map((ask) => (
            <li key={ask.id}>
              <AskItem ask={ask} snapshot={snapshot} contacts={contacts} now={now} onChanged={onChanged} />
            </li>
          ))}
        </ul>
      ) : composing ? null : (
        <EmptyState
          compact
          icon={Megaphone}
          title={t("empty_title")}
          description={t("empty_body")}
          action={
            <Button size="sm" onClick={() => setComposing(true)}>
              <Plus aria-hidden />
              {t("post")}
            </Button>
          }
        />
      )}

      {closed.length ? (
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            aria-expanded={showClosed}
            onClick={() => setShowClosed((v) => !v)}
          >
            <ChevronDown className={cn("transition-transform", showClosed && "rotate-180")} aria-hidden />
            {showClosed ? t("hide_closed") : t.plural("show_closed", closed.length)}
          </Button>
          {showClosed ? (
            <ul className="flex flex-col gap-3">
              {closed.map((ask) => (
                <li key={ask.id}>
                  <AskItem ask={ask} snapshot={snapshot} contacts={contacts} now={now} onChanged={onChanged} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  )
}

function AskForm({ circleId, onCancel, onPosted }: { circleId: ID; onCancel: () => void; onPosted: () => void }) {
  const t = useT(circleAskMessages)
  const id = useId()
  const { api } = useCircles()
  const { pending, run } = useCircleAction()
  const typeOptions = useCollabTypeOptions()
  const [type, setType] = useState<CollabType>("joint_live")
  const [text, setText] = useState("")
  const [touched, setTouched] = useState(false)
  const length = text.trim().length
  const error = length === 0 || length > CIRCLE_LIMITS.askText ? t("error_text") : undefined

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (error || pending) return
    const ok = await run("post", () => api.postAsk({ circleId, type, text: text.trim() }))
    if (ok) {
      toast.success(t("posted"))
      onPosted()
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
      <FormField label={t("type")} htmlFor={`${id}-type`} className="sm:max-w-64">
        <OptionSelect id={`${id}-type`} options={typeOptions} value={type} onChange={(next) => next && setType(next)} />
      </FormField>
      <FormField label={t("text")} htmlFor={`${id}-text`} error={touched ? error : undefined}>
        <Textarea
          id={`${id}-text`}
          rows={3}
          autoFocus
          value={text}
          maxLength={CIRCLE_LIMITS.askText + 20}
          placeholder={t("text_placeholder")}
          aria-invalid={Boolean(touched && error) || undefined}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => setTouched(Boolean(text))}
        />
      </FormField>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className={cn("mr-auto text-xs num text-muted-foreground", length > CIRCLE_LIMITS.askText && "text-critical-fg")}>
          {length}/{CIRCLE_LIMITS.askText}
        </span>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" size="sm" disabled={Boolean(error) || pending !== null}>
          {pending ? <Spinner /> : null}
          {pending ? t("posting") : t("submit")}
        </Button>
      </div>
    </form>
  )
}

function AskItem({ ask, snapshot, contacts, now, onChanged }: { ask: CircleAsk } & AsksProps) {
  const t = useT(circleAskMessages)
  const typeLabel = useT(collabTypeMessages)
  const lang = useUiLang()
  const { api } = useCircles()
  const { pending, run } = useCircleAction()
  const members = useMemo(() => new Map(snapshot.members.map((m) => [m.user_id, m])), [snapshot.members])
  const author = members.get(ask.user_id)
  const mine = ask.user_id === api.self
  const interests = snapshot.interests.filter((i) => i.ask_id === ask.id)
  const myInterest = interests.find((i) => i.user_id === api.self) ?? null
  const authorName = author?.display_name ?? "—"
  const closed = ask.status === "closed"

  const act = async (key: string, action: () => Promise<unknown>, success: string) => {
    if (await run(key, action)) {
      toast.success(success)
      onChanged()
    }
  }

  return (
    <article className={cn("flex flex-col gap-2.5 rounded-md border p-3", closed && "bg-muted/30")}>
      <header className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <MemberAvatar userId={ask.user_id} name={authorName} className="size-6" />
        <span className="min-w-0 truncate font-medium text-foreground">{mine ? t("you") : authorName}</span>
        <span aria-hidden>·</span>
        <time dateTime={ask.created_at}>{formatRelativeDay(ask.created_at, now, lang)}</time>
        <StatusPill icon={COLLAB_TYPE_ICONS[ask.type]} className="ml-auto">
          {typeLabel(ask.type)}
        </StatusPill>
        {closed ? <StatusPill icon={Check}>{t("closed")}</StatusPill> : null}
      </header>
      <p className="text-sm whitespace-pre-line text-pretty break-words">{ask.text}</p>

      {mine ? (
        <AuthorFooter ask={ask} interests={interests} members={members} contacts={contacts} snapshot={snapshot} pending={pending} act={act} />
      ) : myInterest?.status === "accepted" ? (
        <ContactReveal name={authorName} contact={contacts[ask.user_id]} lead={t("accepted_you", { name: authorName })} />
      ) : myInterest ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
          <span className="text-xs text-muted-foreground">{t("waiting", { name: authorName })}</span>
          {!closed ? (
            <Button size="sm" variant="ghost" disabled={pending !== null} onClick={() => act("withdraw", () => api.withdrawInterest(ask.id), t("withdrawn"))}>
              {pending === "withdraw" ? <Spinner /> : <Undo2 aria-hidden />}
              {t("withdraw")}
            </Button>
          ) : null}
        </div>
      ) : !closed ? (
        <div className="flex justify-end border-t pt-2.5">
          <Button
            size="sm"
            variant="outline"
            disabled={pending !== null}
            onClick={() => act("interest", () => api.showInterest(snapshot.circle.id, ask.id), t("interest_sent", { name: authorName }))}
          >
            {pending === "interest" ? <Spinner /> : <Hand aria-hidden />}
            {t("interested")}
          </Button>
        </div>
      ) : null}
    </article>
  )
}

function AuthorFooter({
  ask,
  interests,
  members,
  contacts,
  snapshot,
  pending,
  act,
}: {
  ask: CircleAsk
  interests: CircleAskInterest[]
  members: Map<ID, CircleMember>
  contacts: Record<ID, string | null>
  snapshot: CircleSnapshot
  pending: string | null
  act: (key: string, action: () => Promise<unknown>, success: string) => Promise<void>
}) {
  const t = useT(circleAskMessages)
  const { api } = useCircles()
  const accepted = interests.some((i) => i.status === "accepted")
  const noOwnContact = accepted && api.self in contacts && !contacts[api.self]

  return (
    <div className="flex flex-col gap-2 border-t pt-2.5">
      {interests.length ? (
        <>
          <p className="text-xs font-medium text-muted-foreground">{t.plural("interested", interests.length)}</p>
          <ul className="flex flex-col gap-2">
            {interests.map((interest) => {
              const member = members.get(interest.user_id)
              const name = member?.display_name ?? "—"
              return (
                <li key={interest.user_id} className="flex min-w-0 flex-col gap-1.5 rounded-md bg-muted/40 px-2.5 py-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <MemberAvatar userId={interest.user_id} name={name} className="size-6" />
                    <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                    {interest.status === "accepted" ? (
                      <StatusPill tone="good">{t("accepted")}</StatusPill>
                    ) : (
                      <Button
                        size="sm"
                        disabled={pending !== null}
                        aria-label={`${t("accept")} — ${name}`}
                        onClick={() => act(`accept:${interest.user_id}`, () => api.acceptInterest(ask.id, interest.user_id), t("accepted_toast", { name }))}
                      >
                        {pending === `accept:${interest.user_id}` ? <Spinner /> : <Check aria-hidden />}
                        {t("accept")}
                      </Button>
                    )}
                  </div>
                  {interest.status === "accepted" ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 pl-8">
                      <ContactLine name={name} contact={contacts[interest.user_id]} />
                      <AddToCollabsButton ask={ask} circleName={snapshot.circle.name} partnerId={interest.user_id} partnerName={name} contact={contacts[interest.user_id] ?? null} />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{t("nobody_yet")}</p>
      )}
      {noOwnContact ? <p className="text-xs text-muted-foreground">{t("add_contact_hint")}</p> : null}
      {ask.status === "open" ? (
        <Button
          size="sm"
          variant="ghost"
          className="self-end text-muted-foreground"
          disabled={pending !== null}
          onClick={() => act("close", () => api.closeAsk(ask.id), t("closed_toast"))}
        >
          {pending === "close" ? <Spinner /> : <X aria-hidden />}
          {t("close")}
        </Button>
      ) : null}
    </div>
  )
}

/** A revealed contact (with Copy), or an honest "hasn't added one yet". */
function ContactLine({ name, contact }: { name: string; contact: string | null | undefined }) {
  const t = useT(circleAskMessages)
  if (contact === undefined) return <Spinner className="size-3.5 text-muted-foreground" />
  if (!contact) return <span className="text-xs text-muted-foreground">{t("no_contact", { name })}</span>
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="min-w-0 truncate text-sm font-medium text-foreground">{contact}</span>
      <CopyButton text={contact} />
    </span>
  )
}

function ContactReveal({ name, contact, lead }: { name: string; contact: string | null | undefined; lead: string }) {
  return (
    <div className="flex flex-col gap-1 border-t pt-2.5">
      <p className="flex items-center gap-1.5 text-xs text-good-fg">
        <Check className="size-3.5 shrink-0" aria-hidden />
        {lead}
      </p>
      <ContactLine name={name} contact={contact} />
    </div>
  )
}

function AddToCollabsButton({ ask, circleName, partnerId, partnerName, contact }: { ask: CircleAsk; circleName: string; partnerId: ID; partnerName: string; contact: string | null }) {
  const t = useT(circleAskMessages)
  const router = useRouter()
  const collabs = useTable("collabs")
  const [addedId, setAddedId] = useState<string | null>(() => recallAddedCollab(ask.id, partnerId))
  const existing = addedId && collabs.some((c) => c.id === addedId) ? addedId : null

  if (existing) {
    return (
      <Button size="sm" variant="outline" onClick={() => router.push(`/collabs?open=${existing}`)}>
        <Blend aria-hidden />
        {t("open_in_collabs")}
      </Button>
    )
  }
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        const row = addAskToCollabs({ ask, circleName, partnerId, partnerName, contact })
        setAddedId(row.id)
        toast.success(t("added"), {
          description: row.title || partnerName,
          action: { label: t("open"), onClick: () => router.push(`/collabs?open=${row.id}`) },
        })
      }}
    >
      <Plus aria-hidden />
      {t("add_to_collabs")}
    </Button>
  )
}
