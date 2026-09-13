"use client"

import { CircleAlert, ListChecks, Save } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { AiButton, AiNotice, FormField, PlatformIcon, ProviderBadge, StatusPill } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { buildBriefInput, useAiTask, type AiTaskOutput } from "@/lib/ai"
import { formatDate } from "@/lib/dates"
import { dataActions, ensureBrief } from "@/lib/store"
import type { ContentItem, UpdateRow } from "@/lib/types"
import { pluralize } from "@/lib/utils"
import { plannedPostCount, type PlanPick } from "./planner-model"

/* -------------------------------- Brief draft ------------------------------- */

type BriefOutput = AiTaskOutput<"content_brief">

/** Editable form of an AI brief (lists as one line per entry). */
interface BriefDraft {
  objective: string
  main_message: string
  supporting_points: string
  cta: string
  caption: string
  visual_direction: string
  production_notes: string
  b_roll: string
  on_screen_text: string
  reference_ideas: string
}

const toDraft = (o: BriefOutput): BriefDraft => ({
  objective: o.objective,
  main_message: o.main_message,
  supporting_points: o.supporting_points.join("\n"),
  cta: o.cta,
  caption: o.caption,
  visual_direction: o.visual_direction,
  production_notes: o.production_notes,
  b_roll: o.b_roll.join("\n"),
  on_screen_text: o.on_screen_text.join("\n"),
  reference_ideas: o.reference_ideas,
})

const lines = (text: string) =>
  text
    .split("\n")
    .map((s) => s.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)

function toPatch(d: BriefDraft): UpdateRow<"content_briefs"> {
  return {
    objective: d.objective.trim(),
    main_message: d.main_message.trim(),
    supporting_points: lines(d.supporting_points),
    cta: d.cta.trim(),
    caption: d.caption.trim(),
    visual_direction: d.visual_direction.trim(),
    production_notes: d.production_notes.trim(),
    b_roll: lines(d.b_roll),
    on_screen_text: lines(d.on_screen_text),
    reference: d.reference_ideas.trim(),
  }
}

const FIELDS: { key: keyof BriefDraft; label: string; rows?: number; hint?: string; wide?: boolean }[] = [
  { key: "objective", label: "Objective", rows: 2, wide: true },
  { key: "main_message", label: "Main message", wide: true },
  { key: "supporting_points", label: "Supporting points", rows: 3, hint: "One per line", wide: true },
  { key: "cta", label: "CTA" },
  { key: "visual_direction", label: "Visual direction", rows: 2 },
  { key: "caption", label: "Caption", rows: 3, wide: true },
  { key: "b_roll", label: "B-roll", rows: 2, hint: "One per line" },
  { key: "on_screen_text", label: "On-screen text", rows: 2, hint: "One per line" },
  { key: "production_notes", label: "Production notes", rows: 2 },
  { key: "reference_ideas", label: "References", rows: 2, hint: "Structures to model — never copy" },
]

function BriefEditor({
  idBase,
  draft,
  saved,
  onChange,
  onApply,
  onDiscard,
}: {
  idBase: string
  draft: BriefDraft
  saved: boolean
  onChange: (draft: BriefDraft) => void
  onApply: () => void
  onDiscard: () => void
}) {
  const missing = !draft.main_message.trim()
  return (
    <div className="grid min-w-0 gap-3 border-t px-3 py-3">
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        {FIELDS.map((field) => {
          const id = `${idBase}-${field.key}`
          const value = draft[field.key]
          const set = (next: string) => onChange({ ...draft, [field.key]: next })
          return (
            <FormField
              key={field.key}
              label={field.label}
              htmlFor={id}
              description={field.hint}
              error={field.key === "main_message" && missing ? "A brief needs its main message." : null}
              className={field.wide ? "md:col-span-2" : undefined}
            >
              {field.rows ? (
                <Textarea id={id} rows={field.rows} value={value} onChange={(event) => set(event.target.value)} />
              ) : (
                <Input id={id} value={value} onChange={(event) => set(event.target.value)} aria-invalid={field.key === "main_message" && missing} />
              )}
            </FormField>
          )
        })}
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <AiNotice />
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onDiscard}>
            Discard
          </Button>
          <Button type="button" size="sm" disabled={missing} onClick={onApply}>
            {saved ? "Save again" : "Save to brief"}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** One created item: generate its full Content Brief with AI, review and edit it, then save it to the item's brief. */
function BriefAiRow({ item }: { item: ContentItem }) {
  const router = useRouter()
  const task = useAiTask("content_brief")
  const [draft, setDraft] = useState<BriefDraft | null>(null)
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const title = item.title.trim() || "Untitled content"

  async function generate() {
    const input = buildBriefInput(dataActions.getDb(), item.id)
    if (!input) {
      toast.error("That content item no longer exists.")
      return
    }
    const result = await task.run(input, { entityType: "content_items", entityId: item.id })
    if (!result) return
    setDraft(toDraft(result.output))
    setSaved(false)
    setOpen(true)
  }

  function apply() {
    if (!draft) return
    const brief = ensureBrief(item.id)
    dataActions.update("content_briefs", brief.id, toPatch(draft))
    setSaved(true)
    setOpen(false)
    toast.success("Brief saved", { description: title, action: { label: "Open", onClick: () => router.push(`/studio/${item.id}?tab=brief`) } })
  }

  return (
    <li className="min-w-0 rounded-md border bg-card">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2 px-3 py-2">
        <PlatformIcon platform={item.platform} label className="size-4 shrink-0 text-muted-foreground" />
        <Link href={`/studio/${item.id}`} className="min-w-0 flex-1 basis-40 truncate text-sm font-medium underline-offset-4 hover:underline">
          {title}
        </Link>
        <span className="shrink-0 text-xs text-muted-foreground num">{item.scheduled_at ? formatDate(item.scheduled_at, "EEE, MMM d · h:mm a") : "No publish time"}</span>
        {task.provider && draft ? <ProviderBadge provider={task.provider} model={task.model ?? undefined} /> : null}
        {saved ? <StatusPill tone="good">Brief saved</StatusPill> : null}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {draft ? (
            <Button type="button" size="xs" variant="ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? "Hide" : "Review"}
            </Button>
          ) : null}
          <AiButton type="button" size="xs" pending={task.isPending} onClick={() => void generate()}>
            {draft ? "Regenerate" : "Generate brief"}
          </AiButton>
        </div>
      </div>
      {task.error ? (
        <div role="alert" className="flex min-w-0 flex-wrap items-center gap-2 border-t px-3 py-2 text-xs text-destructive">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{task.error.message}</span>
          <Button type="button" size="xs" variant="outline" onClick={() => void generate()}>
            Retry
          </Button>
        </div>
      ) : null}
      {draft && open ? (
        <BriefEditor
          idBase={`brief-${item.id}`}
          draft={draft}
          saved={saved}
          onChange={setDraft}
          onApply={apply}
          onDiscard={() => {
            setDraft(null)
            setOpen(false)
            task.reset()
          }}
        />
      ) : null}
    </li>
  )
}

/* ---------------------------- Step 7 · Briefs ------------------------------- */

/** Step 7: create the planned content (+ save the plan), then optional AI briefs per created item. */
export function BriefsStep({
  picks,
  createdItems,
  blockers,
  weekText,
  saved,
  calendarHref,
  onCreate,
}: {
  picks: PlanPick[]
  createdItems: ContentItem[]
  blockers: string[]
  weekText: string
  /** A plan is already saved for this week. */
  saved: boolean
  calendarHref: string
  onCreate: () => void
}) {
  const posts = plannedPostCount(picks)
  return (
    <div className="grid min-w-0 gap-5">
      {picks.length ? (
        <div className="grid min-w-0 gap-3">
          <p className="text-sm text-pretty">
            Creates {pluralize(posts, "content item")} from {pluralize(picks.length, "pick")} — each with a brief pre-filled from its idea — scheduled into{" "}
            {weekText}, and saves the plan with your focus.
          </p>
          <ul className="grid min-w-0 gap-1.5">
            {picks.map((pick) => (
              <li key={pick.key} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 basis-48 truncate font-medium">{pick.title.trim() || "Untitled"}</span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {pick.entries.map((e) => (
                    <span key={e.platform} className="inline-flex items-center gap-1 num">
                      <PlatformIcon platform={e.platform} label className="size-3.5" />
                      {e.publishAt ? formatDate(e.publishAt, "EEE h:mm a") : "No time"}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          {blockers.length ? (
            <ul className="grid gap-1 text-xs text-destructive">
              {blockers.map((b) => (
                <li key={b} className="flex items-center gap-1.5">
                  <CircleAlert className="size-3.5 shrink-0" aria-hidden />
                  {b}
                </li>
              ))}
            </ul>
          ) : null}
          <div>
            <Button type="button" onClick={onCreate} disabled={blockers.length > 0}>
              <ListChecks aria-hidden />
              Create {pluralize(posts, "content item")} &amp; save plan
            </Button>
          </div>
        </div>
      ) : createdItems.length ? null : (
        <div className="grid min-w-0 gap-3 rounded-lg border border-dashed p-4">
          <p className="text-sm text-pretty">
            Nothing new to create. Saving keeps what&apos;s already scheduled for {weekText} as the plan, with your focus.
          </p>
          {blockers.length ? <p className="text-xs text-destructive">{blockers[0]}</p> : null}
          <div>
            <Button type="button" variant="outline" onClick={onCreate} disabled={blockers.length > 0}>
              <Save aria-hidden />
              {saved ? "Update saved plan" : "Save plan"}
            </Button>
          </div>
        </div>
      )}

      {createdItems.length ? (
        <div className="grid min-w-0 gap-3">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <StatusPill tone="good">{pluralize(createdItems.length, "content item")} created · plan saved</StatusPill>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={calendarHref}>Open the Calendar week</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/pipeline">Pipeline</Link>
              </Button>
            </div>
          </div>
          <p className="text-xs text-pretty text-muted-foreground">
            Each item already has a brief from its idea. Generate the full Content Brief with AI — objective, message, points, visual direction, caption, B-roll —
            then review and edit it before saving.
          </p>
          <ul className="grid min-w-0 gap-2">
            {createdItems.map((item) => (
              <BriefAiRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
