"use client"

import { CircleCheck, Pencil } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { toast } from "sonner"
import { FormField, NumberField, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { checkinDraft, checkinErrors } from "@/lib/circles/checkin"
import type { CircleWeek } from "@/lib/circles/streak"
import { CIRCLE_LIMITS, type CircleSnapshot } from "@/lib/circles/types"
import { formatDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { useDb, useSettings } from "@/lib/store"
import { cn } from "@/lib/utils"
import { useCircleAction } from "./circle-errors"
import { MemberAvatar, StreakLabel } from "./circle-ui"
import { useCircles } from "./circles-client"
import { circleWeekMessages } from "./messages"

/** "This week": your check-in (pre-computed from your workspace, editable) and everyone's, sorted by name. */
export function CircleWeekSection({ snapshot, week, now, onChanged }: { snapshot: CircleSnapshot; week: CircleWeek; now: Date; onChanged: () => void }) {
  const t = useT(circleWeekMessages)
  const settings = useSettings()
  const db = useDb()
  // Recomputed when the workspace or the week changes; nothing is sent until "Check in".
  const draft = useMemo(() => checkinDraft(db, now, settings), [db, now, settings])
  const mine = week.self?.checkin ?? null
  const [editing, setEditing] = useState(false)

  return (
    <SectionCard
      title={t("week_title")}
      description={`${t("week_of", { date: formatDate(draft.weekStart, "MMM d") })} · ${t("checked_in_count", { done: week.checkedIn, total: week.total })}`}
      contentClassName="flex flex-col gap-4"
    >
      {mine && !editing ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2.5">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <CircleCheck className="size-4 shrink-0 text-good-fg" aria-hidden />
              {t.plural("checked_in", mine.posts)}
            </p>
            {mine.note ? <p className="mt-0.5 text-xs text-pretty break-words text-muted-foreground">{mine.note}</p> : null}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
            {t("edit")}
          </Button>
        </div>
      ) : (
        <CheckinForm
          key={mine?.id ?? "new"}
          circleId={snapshot.circle.id}
          weekStart={draft.weekStart}
          published={draft.published}
          initial={mine ? { posts: mine.posts, note: mine.note } : { posts: draft.posts, note: "" }}
          isUpdate={Boolean(mine)}
          onCancel={mine ? () => setEditing(false) : undefined}
          onSaved={() => {
            setEditing(false)
            onChanged()
          }}
        />
      )}

      <div className="flex flex-col gap-1">
        <h4 className="text-xs font-medium text-muted-foreground">{t("members_title")}</h4>
        <ul className="divide-y">
          {week.rows.map((row) => (
            <li key={row.member.user_id} className="flex min-w-0 items-start gap-3 py-2">
              <MemberAvatar name={row.member.display_name} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm">
                    {row.member.display_name}
                    {row.isSelf ? <span className="text-muted-foreground"> · {t("you")}</span> : null}
                  </p>
                  <div className="flex shrink-0 items-center gap-3">
                    <StreakLabel weeks={row.streak} compact />
                    <span className={cn("w-16 text-right text-xs num", row.checkin ? "text-foreground" : "text-muted-foreground")}>
                      {row.checkin ? t.plural("posts", row.checkin.posts) : t("not_yet")}
                    </span>
                  </div>
                </div>
                {row.checkin?.note ? <p className="mt-0.5 line-clamp-2 text-xs break-words text-muted-foreground">{row.checkin.note}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  )
}

function CheckinForm({
  circleId,
  weekStart,
  published,
  initial,
  isUpdate,
  onCancel,
  onSaved,
}: {
  circleId: string
  weekStart: string
  published: number
  initial: { posts: number; note: string }
  isUpdate: boolean
  onCancel?: () => void
  onSaved: () => void
}) {
  const t = useT(circleWeekMessages)
  const id = useId()
  const { api } = useCircles()
  const { pending, run } = useCircleAction()
  const [posts, setPosts] = useState<number | null>(initial.posts)
  const [note, setNote] = useState(initial.note)
  const errors = checkinErrors({ posts, note })
  const valid = !errors.posts && !errors.note

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid || pending || posts === null) return
    const ok = await run("checkin", () => api.checkIn({ circleId, weekStart, posts, note: note.trim() }))
    if (ok) {
      toast.success(t("saved"), { description: t.plural("posts", posts) })
      onSaved()
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-label={t("your_checkin")} className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
      <div>
        <p className="text-sm font-medium">{t.plural("published", published)}</p>
        <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{t("published_help")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
        <FormField label={t("posts_label")} htmlFor={`${id}-posts`} error={errors.posts ? t("error_posts") : undefined}>
          <NumberField
            id={`${id}-posts`}
            value={posts}
            min={0}
            max={CIRCLE_LIMITS.posts}
            integer
            aria-invalid={Boolean(errors.posts) || undefined}
            onChange={setPosts}
          />
        </FormField>
        <FormField label={t("note_label")} htmlFor={`${id}-note`} error={errors.note ? t("error_note") : undefined}>
          <Textarea
            id={`${id}-note`}
            rows={2}
            className="min-h-9"
            value={note}
            maxLength={CIRCLE_LIMITS.note + 20}
            placeholder={t("note_placeholder")}
            aria-invalid={Boolean(errors.note) || undefined}
            onChange={(e) => setNote(e.target.value)}
          />
        </FormField>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className={cn("mr-auto text-xs num text-muted-foreground", note.trim().length > CIRCLE_LIMITS.note && "text-critical-fg")}>
          {note.trim().length}/{CIRCLE_LIMITS.note}
        </span>
        {onCancel ? (
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={!valid || pending !== null}>
          {pending ? <Spinner /> : <CircleCheck aria-hidden />}
          {pending ? t("saving") : isUpdate ? t("update") : t("submit")}
        </Button>
      </div>
    </form>
  )
}
