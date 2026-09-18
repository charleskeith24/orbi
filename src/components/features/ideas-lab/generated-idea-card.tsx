"use client"

import { BookmarkPlus, Check, CircleCheck, ExternalLink, Pencil, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useId, useState } from "react"
import {
  AiButton,
  AngleSelect,
  CopyButton,
  FormatSelect,
  FormField,
  FunnelSelect,
  HookCategorySelect,
  ListEditor,
  PersonaBadge,
  PersonaSelect,
  PillarBadge,
  PillarSelect,
  PlatformIcon,
  PlatformSelect,
  StatusPill,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FUNNEL_STAGES, HOOK_CATEGORIES, PLATFORMS } from "@/lib/constants"
import { useT, useUiLang } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import type { AudiencePersona, AudienceProblem, ContentAngle, ContentFormat, ContentIdea, ContentPillar, ID } from "@/lib/types"
import { cn, truncate } from "@/lib/utils"
import { generatorMessages } from "./generator-messages"
import { draftToText, type GeneratedDraft } from "./generator-model"
import { labMessages } from "./messages"

export interface DraftLookups {
  pillars: Map<ID, ContentPillar>
  personas: Map<ID, AudiencePersona>
  problems: Map<ID, AudienceProblem>
  formats: Map<ID, ContentFormat>
  angles: Map<ID, ContentAngle>
}

const LABEL = "text-[11px] leading-4 font-medium tracking-wide text-muted-foreground uppercase"
const PAIR = "grid min-w-0 grid-cols-2 gap-3"

function Section({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={LABEL}>{label}</span>
      {children}
    </div>
  )
}

function Meta({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <dt className={LABEL}>{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-xs text-foreground/90">{children}</dd>
    </div>
  )
}

/** One generated idea: every field the brief asks for, selectable for saving, editable before it's saved. */
export function GeneratedIdeaCard({
  draft,
  lookups,
  selected,
  onSelectedChange,
  onSave,
  onEdit,
  onMore,
  morePending,
  aiBusy,
  duplicate,
}: {
  draft: GeneratedDraft
  lookups: DraftLookups
  selected: boolean
  onSelectedChange: (key: string, selected: boolean) => void
  onSave: (draft: GeneratedDraft) => void
  onEdit: (key: string, patch: Partial<GeneratedDraft>) => void
  onMore: (draft: GeneratedDraft) => void
  morePending: boolean
  aiBusy: boolean
  /** An Idea Bank idea with the same title. */
  duplicate?: ContentIdea
}) {
  const titleId = useId()
  const t = useT(generatorMessages)
  const l = useT(labMessages)
  const c = useT(commonMessages)
  const lang = useUiLang()
  const [editing, setEditing] = useState(false)
  const title = draft.title.trim() || l("untitled_idea")
  const saved = Boolean(draft.saved_idea_id)
  const pillar = draft.pillar_id ? lookups.pillars.get(draft.pillar_id) : undefined
  const persona = draft.persona_id ? lookups.personas.get(draft.persona_id) : undefined
  const problem = draft.problem_id ? lookups.problems.get(draft.problem_id) : undefined
  const formatName = (draft.format_id ? lookups.formats.get(draft.format_id)?.name : undefined) || draft.format_name || "—"
  const angleName = (draft.angle_id ? lookups.angles.get(draft.angle_id)?.name : undefined) || draft.angle_name || "—"
  const funnel = FUNNEL_STAGES[draft.funnel_stage]

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "flex min-w-0 flex-col rounded-lg border bg-card text-card-foreground shadow-xs transition-[border-color,box-shadow]",
        selected && "border-brand/50 ring-1 ring-brand/30"
      )}
    >
      <header className="flex items-start gap-3 px-4 pt-3.5">
        <Checkbox
          checked={selected}
          disabled={saved || editing || !draft.title.trim()}
          onCheckedChange={(value) => onSelectedChange(draft.key, value === true)}
          aria-label={saved ? t("saved_label", { title }) : t("select_label", { title })}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-sm leading-snug font-medium text-pretty break-words">
            {title}
          </h3>
          {pillar || persona || saved || duplicate ? (
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1">
              {pillar ? <PillarBadge pillar={pillar} /> : null}
              {persona ? <PersonaBadge persona={persona} /> : null}
              {saved ? (
                <StatusPill tone="good" icon={CircleCheck}>
                  {c("saved")}
                </StatusPill>
              ) : duplicate ? (
                <StatusPill tone="warning" icon={TriangleAlert} title={t("duplicate_title", { title: duplicate.title })}>
                  {t("already_in_bank")}
                </StatusPill>
              ) : null}
            </div>
          ) : null}
        </div>
        <CopyButton
          text={draftToText(draft, { format: formatName, angle: angleName }, lang)}
          successMessage={t("idea_copied")}
          className="-mt-1 -mr-1.5"
        />
      </header>

      {editing ? (
        <DraftEditor
          draft={draft}
          lookups={lookups}
          onCancel={() => setEditing(false)}
          onDone={(patch) => {
            onEdit(draft.key, patch)
            setEditing(false)
          }}
        />
      ) : (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-3 px-4 pt-3 pb-4 text-sm">
            {draft.core_idea ? (
              <Section label={t("core_idea")}>
                <p className="text-pretty">{draft.core_idea}</p>
              </Section>
            ) : null}
            {draft.hook ? (
              <Section
                label={
                  <>
                    {t("hook")}
                    <span className="font-normal tracking-normal normal-case"> · {HOOK_CATEGORIES[draft.hook_category]?.label ?? "Custom"}</span>
                  </>
                }
              >
                <p className="text-pretty">“{draft.hook}”</p>
              </Section>
            ) : null}
            {draft.why_it_matters ? (
              <Section label={t("why")}>
                <p className="text-pretty text-muted-foreground">{draft.why_it_matters}</p>
              </Section>
            ) : null}
            {draft.talking_points.length ? (
              <Section label={t("key_points")}>
                <ul className="flex list-disc flex-col gap-1 pl-4 marker:text-muted-foreground">
                  {draft.talking_points.map((point, index) => (
                    <li key={index} className="text-pretty">
                      {point}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
            {draft.cta ? (
              <Section label={t("cta")}>
                <p className="text-pretty">{draft.cta}</p>
              </Section>
            ) : null}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border bg-muted/30 px-3 py-2.5 dark:bg-muted/15">
              <Meta label={t("format")}>
                <span className="min-w-0 truncate">{formatName}</span>
              </Meta>
              <Meta label={t("angle")}>
                <span className="min-w-0 truncate">{angleName}</span>
              </Meta>
              <Meta label={t("platform")}>
                <PlatformIcon platform={draft.platform} className="size-3.5 text-muted-foreground" />
                <span className="min-w-0 truncate">{PLATFORMS[draft.platform]?.label ?? draft.platform}</span>
              </Meta>
              <Meta label={t("funnel_stage")}>
                <span className="min-w-0 truncate">
                  {funnel.label} · {funnel.name}
                </span>
              </Meta>
              {problem ? (
                <Meta label={t("audience_problem")} className="col-span-2">
                  <span className="min-w-0 text-pretty">{truncate(problem.problem, 140)}</span>
                </Meta>
              ) : null}
            </dl>
          </div>
          <footer className="mt-auto flex flex-wrap items-center gap-1.5 border-t px-4 py-2.5">
            {saved ? (
              <Button type="button" size="sm" variant="outline" asChild>
                <Link href={`/ideas?open=${draft.saved_idea_id}`}>
                  <ExternalLink aria-hidden />
                  {t("open_in_bank")}
                </Link>
              </Button>
            ) : (
              <Button type="button" size="sm" variant="outline" disabled={!draft.title.trim()} onClick={() => onSave(draft)}>
                <BookmarkPlus aria-hidden />
                {t("save_to_bank")}
              </Button>
            )}
            <AiButton type="button" size="sm" variant="ghost" pending={morePending} pendingLabel={t("finding_more_short")} disabled={aiBusy} onClick={() => onMore(draft)}>
              {t("more_like_this")}
            </AiButton>
            {saved ? null : (
              <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => setEditing(true)}>
                <Pencil aria-hidden />
                {c("edit")}
              </Button>
            )}
          </footer>
        </>
      )}
    </article>
  )
}

function DraftEditor({
  draft,
  lookups,
  onDone,
  onCancel,
}: {
  draft: GeneratedDraft
  lookups: DraftLookups
  onDone: (patch: Partial<GeneratedDraft>) => void
  onCancel: () => void
}) {
  const id = useId()
  const t = useT(generatorMessages)
  const c = useT(commonMessages)
  const field = (name: string) => `${id}-${name}`
  const [form, setForm] = useState(draft)
  const set = (patch: Partial<GeneratedDraft>) => setForm((current) => ({ ...current, ...patch }))
  const titleError = form.title.trim() ? undefined : t("title_error")

  function done() {
    if (titleError) return
    onDone({
      title: form.title.replace(/\s+/g, " ").trim(),
      hook: form.hook.replace(/\s+/g, " ").trim(),
      hook_category: form.hook_category,
      core_idea: form.core_idea.trim(),
      why_it_matters: form.why_it_matters.trim(),
      talking_points: form.talking_points.map((point) => point.trim()).filter(Boolean),
      cta: form.cta.trim(),
      platform: form.platform,
      funnel_stage: form.funnel_stage,
      format_id: form.format_id,
      format_name: form.format_name,
      angle_id: form.angle_id,
      angle_name: form.angle_name,
      pillar_id: form.pillar_id,
      persona_id: form.persona_id,
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 px-4 pt-3 pb-4">
      <FormField label={t("title")} htmlFor={field("title")} required error={titleError}>
        <Input
          id={field("title")}
          autoFocus
          value={form.title}
          maxLength={200}
          aria-invalid={Boolean(titleError) || undefined}
          onChange={(event) => set({ title: event.target.value })}
        />
      </FormField>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
        <FormField label={t("hook")} htmlFor={field("hook")}>
          <Textarea id={field("hook")} rows={2} className="min-h-14" value={form.hook} onChange={(event) => set({ hook: event.target.value })} />
        </FormField>
        <FormField label={t("hook_type")} htmlFor={field("hook-type")}>
          <HookCategorySelect
            id={field("hook-type")}
            value={form.hook_category}
            onChange={(hook_category) => {
              if (hook_category) set({ hook_category })
            }}
          />
        </FormField>
      </div>
      <FormField label={t("core_idea")} htmlFor={field("core")}>
        <Textarea id={field("core")} rows={3} value={form.core_idea} onChange={(event) => set({ core_idea: event.target.value })} />
      </FormField>
      <FormField label={t("why")} htmlFor={field("why")}>
        <Textarea id={field("why")} rows={2} className="min-h-14" value={form.why_it_matters} onChange={(event) => set({ why_it_matters: event.target.value })} />
      </FormField>
      <FormField label={t("key_points")}>
        <ListEditor
          variant="lines"
          value={form.talking_points}
          onChange={(talking_points) => set({ talking_points })}
          addLabel={t("add_point")}
          placeholder={t("point_placeholder")}
          maxItems={8}
          aria-label={t("key_points")}
        />
      </FormField>
      <FormField label={t("cta")} htmlFor={field("cta")}>
        <Input id={field("cta")} value={form.cta} maxLength={300} onChange={(event) => set({ cta: event.target.value })} />
      </FormField>
      <div className={PAIR}>
        <FormField label={t("platform")} htmlFor={field("platform")}>
          <PlatformSelect
            id={field("platform")}
            value={form.platform}
            onChange={(platform) => {
              if (platform) set({ platform })
            }}
          />
        </FormField>
        <FormField label={t("funnel_stage")} htmlFor={field("funnel")}>
          <FunnelSelect
            id={field("funnel")}
            value={form.funnel_stage}
            onChange={(funnel_stage) => {
              if (funnel_stage) set({ funnel_stage })
            }}
          />
        </FormField>
        <FormField label={t("format")} htmlFor={field("format")}>
          <FormatSelect
            id={field("format")}
            allowNone
            value={form.format_id}
            onChange={(format_id) => set({ format_id, format_name: format_id ? (lookups.formats.get(format_id)?.name ?? "") : "" })}
          />
        </FormField>
        <FormField label={t("angle")} htmlFor={field("angle")}>
          <AngleSelect
            id={field("angle")}
            allowNone
            value={form.angle_id}
            onChange={(angle_id) => set({ angle_id, angle_name: angle_id ? (lookups.angles.get(angle_id)?.name ?? "") : "" })}
          />
        </FormField>
        <FormField label={t("content_pillar")} htmlFor={field("pillar")}>
          <PillarSelect id={field("pillar")} allowNone value={form.pillar_id} onChange={(pillar_id) => set({ pillar_id })} />
        </FormField>
        <FormField label={t("persona")} htmlFor={field("persona")}>
          <PersonaSelect id={field("persona")} allowNone value={form.persona_id} onChange={(persona_id) => set({ persona_id })} />
        </FormField>
      </div>
      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {c("cancel")}
        </Button>
        <Button type="button" size="sm" disabled={Boolean(titleError)} onClick={done}>
          <Check aria-hidden />
          {c("done")}
        </Button>
      </div>
    </div>
  )
}
