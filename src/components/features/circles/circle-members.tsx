"use client"

import { Check, LogOut, Pencil, RefreshCw, UserMinus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { toast } from "sonner"
import { CopyButton, FormField, SectionCard, StatusPill, useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { inviteLink } from "@/lib/circles/invite"
import type { CircleWeek } from "@/lib/circles/streak"
import { CIRCLE_LIMITS, type CircleMember, type CircleSnapshot } from "@/lib/circles/types"
import { useT } from "@/lib/i18n"
import type { ID } from "@/lib/types"
import { isValidName } from "./circle-dialogs"
import { useCircleAction } from "./circle-errors"
import { forgetInvite, recallInvite, rememberInvite } from "./circle-memory"
import { MemberAvatar } from "./circle-ui"
import { useCircles } from "./circles-client"
import { circleFormMessages, circleMemberMessages } from "./messages"

interface MembersProps {
  snapshot: CircleSnapshot
  week: CircleWeek
  /** Your own saved contact (undefined while loading). */
  myContact: string | null | undefined
  onChanged: () => void
  onContactSaved: () => void
}

/** Members: names (rename yourself), your contact, the owner's invite link and remove, and "Leave circle". */
export function CircleMembersSection({ snapshot, week, myContact, onChanged, onContactSaved }: MembersProps) {
  const t = useT(circleMemberMessages)
  const router = useRouter()
  const { api } = useCircles()
  const { pending, run } = useCircleAction()
  const [confirm, confirmDialog] = useConfirm()
  const isOwner = week.selfRole === "owner"
  const owner = week.rows.find((r) => r.member.role === "owner")?.member ?? null
  const circleName = snapshot.circle.name

  async function remove(member: CircleMember) {
    const ok = await confirm({
      title: t("remove_title", { name: member.display_name }),
      description: t("remove_body"),
      confirmLabel: t("remove"),
    })
    if (!ok) return
    if (await run(`remove:${member.user_id}`, () => api.removeMember(snapshot.circle.id, member.user_id))) {
      toast.success(t("removed", { name: member.display_name }))
      onChanged()
    }
  }

  async function leave() {
    const others = week.rows.filter((r) => !r.isSelf).map((r) => r.member)
    const heir = [...others].sort((a, b) => a.joined_at.localeCompare(b.joined_at))[0] ?? null
    const detail = !heir ? t("leave_last") : isOwner ? t("leave_owner", { name: heir.display_name }) : null
    const ok = await confirm({
      title: t("leave_title", { name: circleName }),
      description: detail ? `${t("leave_body")} ${detail}` : t("leave_body"),
      confirmLabel: t("leave_confirm"),
    })
    if (!ok) return
    const outcome: { value: "left" | "deleted" } = { value: "left" }
    const done = await run("leave", async () => {
      outcome.value = await api.leaveCircle(snapshot.circle.id)
    })
    if (!done) return
    forgetInvite(snapshot.circle.id)
    toast.success(outcome.value === "deleted" ? t("deleted", { name: circleName }) : t("left", { name: circleName }))
    router.push("/circles")
  }

  return (
    <SectionCard title={t("title")} description={t("count", { count: week.total, max: CIRCLE_LIMITS.members })} contentClassName="flex flex-col gap-4">
      <ul className="divide-y">
        {week.rows.map((row) =>
          row.isSelf ? (
            <SelfRow key={row.member.user_id} member={row.member} onChanged={onChanged} />
          ) : (
            <li key={row.member.user_id} className="flex min-w-0 items-center gap-3 py-2">
              <MemberAvatar name={row.member.display_name} />
              <span className="min-w-0 flex-1 truncate text-sm">{row.member.display_name}</span>
              {row.member.role === "owner" ? <StatusPill icon={null}>{t("owner")}</StatusPill> : null}
              {isOwner ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={t("remove_aria", { name: row.member.display_name })}
                  title={t("remove_aria", { name: row.member.display_name })}
                  disabled={pending !== null}
                  onClick={() => void remove(row.member)}
                >
                  {pending === `remove:${row.member.user_id}` ? <Spinner /> : <UserMinus aria-hidden />}
                </Button>
              ) : null}
            </li>
          )
        )}
      </ul>

      <ContactField circleId={snapshot.circle.id} saved={myContact} onSaved={onContactSaved} />

      {isOwner ? (
        <InviteLink circleId={snapshot.circle.id} full={week.total >= CIRCLE_LIMITS.members} />
      ) : (
        <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{t("invite_member", { name: owner?.display_name ?? "—" })}</p>
      )}

      <Button variant="outline" size="sm" className="self-start text-critical-fg hover:text-critical-fg" disabled={pending !== null} onClick={() => void leave()}>
        {pending === "leave" ? <Spinner /> : <LogOut aria-hidden />}
        {t("leave")}
      </Button>
      {confirmDialog}
    </SectionCard>
  )
}

function SelfRow({ member, onChanged }: { member: CircleMember; onChanged: () => void }) {
  const t = useT(circleMemberMessages)
  const id = useId()
  const { api } = useCircles()
  const { pending, run } = useCircleAction()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(member.display_name)
  const valid = isValidName(name, CIRCLE_LIMITS.displayName)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!valid || pending) return
    if (name.trim() === member.display_name) {
      setEditing(false)
      return
    }
    if (await run("rename", () => api.renameSelf(member.circle_id, name.trim()))) {
      toast.success(t("renamed"))
      setEditing(false)
      onChanged()
    }
  }

  if (editing) {
    return (
      <li className="py-2">
        <form onSubmit={save} noValidate className="flex min-w-0 items-start gap-2">
          <MemberAvatar name={name || member.display_name} className="mt-1" />
          <FormField label={t("rename_label")} htmlFor={`${id}-name`} error={valid ? undefined : t("error_name")} className="min-w-0 flex-1">
            <Input
              id={`${id}-name`}
              value={name}
              autoFocus
              maxLength={CIRCLE_LIMITS.displayName}
              aria-invalid={!valid || undefined}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault()
                  setName(member.display_name)
                  setEditing(false)
                }
              }}
            />
          </FormField>
          <div className="mt-6 flex shrink-0 gap-1">
            <Button type="submit" size="icon-sm" aria-label={t("save")} title={t("save")} disabled={!valid || pending !== null}>
              {pending ? <Spinner /> : <Check aria-hidden />}
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t("cancel")}
              title={t("cancel")}
              onClick={() => {
                setName(member.display_name)
                setEditing(false)
              }}
            >
              <X aria-hidden />
            </Button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex min-w-0 items-center gap-3 py-2">
      <MemberAvatar name={member.display_name} />
      <span className="min-w-0 flex-1 truncate text-sm">
        {member.display_name}
        <span className="text-muted-foreground"> · {t("you")}</span>
      </span>
      {member.role === "owner" ? <StatusPill icon={null}>{t("owner")}</StatusPill> : null}
      <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-foreground" aria-label={t("rename")} title={t("rename")} onClick={() => setEditing(true)}>
        <Pencil aria-hidden />
      </Button>
    </li>
  )
}

function ContactField({ circleId, saved, onSaved }: { circleId: ID; saved: string | null | undefined; onSaved: () => void }) {
  const t = useT(circleMemberMessages)
  const id = useId()
  const { api } = useCircles()
  const { pending, run } = useCircleAction()
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? saved ?? ""
  const tooLong = value.trim().length > CIRCLE_LIMITS.contact
  const dirty = draft !== null && draft.trim() !== (saved ?? "")

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!dirty || tooLong || pending) return
    const next = value.trim()
    if (await run("contact", () => api.setMyContact(circleId, next))) {
      toast.success(next ? t("contact_saved") : t("contact_cleared"))
      setDraft(null)
      onSaved()
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <FormField label={t("contact_label")} htmlFor={`${id}-contact`} description={t("contact_help")} error={tooLong ? t("error_contact") : undefined}>
        <div className="flex min-w-0 gap-2">
          <Input
            id={`${id}-contact`}
            value={value}
            disabled={saved === undefined}
            maxLength={CIRCLE_LIMITS.contact + 20}
            placeholder={t("contact_placeholder")}
            aria-invalid={tooLong || undefined}
            className="min-w-0"
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button type="submit" size="sm" variant="outline" className="h-9" disabled={!dirty || tooLong || pending !== null}>
            {pending ? <Spinner /> : null}
            {t("save")}
          </Button>
        </div>
      </FormField>
    </form>
  )
}

function InviteLink({ circleId, full }: { circleId: ID; full: boolean }) {
  const t = useT(circleMemberMessages)
  const f = useT(circleFormMessages)
  const id = useId()
  const { api } = useCircles()
  const { pending, run } = useCircleAction()
  const [confirm, confirmDialog] = useConfirm()
  const [code, setCode] = useState<string | null>(() => recallInvite(circleId))
  const link = code ? inviteLink(window.location.origin, code) : null

  async function rotate() {
    if (code) {
      const ok = await confirm({ title: t("rotate_title"), description: t("rotate_body"), confirmLabel: t("rotate_confirm"), destructive: false })
      if (!ok) return
    }
    let next = ""
    if (
      await run("rotate", async () => {
        next = await api.rotateInvite(circleId)
      })
    ) {
      rememberInvite(circleId, next)
      setCode(next)
      toast.success(t("rotated"))
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-medium">{t("invite_title")}</h4>
          <p className="text-xs text-muted-foreground">{full ? t("full_note") : t("invite_help")}</p>
        </div>
        {link ? (
          <Button size="sm" variant="ghost" className="shrink-0" disabled={pending !== null} onClick={() => void rotate()}>
            {pending ? <Spinner /> : <RefreshCw aria-hidden />}
            {t("new_link")}
          </Button>
        ) : null}
      </div>
      {link ? (
        <div className="flex min-w-0 items-center gap-2">
          <Input
            id={`${id}-link`}
            readOnly
            value={link}
            aria-label={t("invite_title")}
            className="min-w-0 font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <CopyButton text={link} label={f("copy_link")} successMessage={f("link_copied")} variant="outline" />
        </div>
      ) : (
        <>
          <p className="text-xs text-pretty text-muted-foreground">{t("invite_unknown")}</p>
          <Button size="sm" variant="outline" className="self-start" disabled={pending !== null} onClick={() => void rotate()}>
            {pending ? <Spinner /> : <RefreshCw aria-hidden />}
            {t("make_link")}
          </Button>
        </>
      )}
      {confirmDialog}
    </div>
  )
}
