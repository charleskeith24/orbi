"use client"

import { ClipboardCopy, Sparkles } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import {
  AiButton,
  AiNotice,
  AngleSelect,
  DatePicker,
  FormField,
  FormatSelect,
  FunnelSelect,
  PersonaSelect,
  PillarSelect,
  PlatformSelect,
  ProblemSelect,
  ProviderBadge,
  SectionCard,
  StageSelect,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { buildBriefInput, useAiTask } from "@/lib/ai"
import { useT } from "@/lib/i18n"
import { FUNNEL_STAGES, PLATFORMS, PROBLEM_CATEGORY_MAP, PUBLISHED_STAGES } from "@/lib/constants"
import { dataActions, moveItemToStage, useRow } from "@/lib/store"
import type { AiProviderId, ContentItem, UpdateRow } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { BRIEF_KEYS, isListKey, useBriefAutosave, type BriefDraft, type BriefKey } from "./brief-autosave"
import { BriefListField, BriefTextField, CaptionCounter, SaveIndicator, SuggestionBox } from "./brief-fields"
import { briefMessages } from "./brief-messages"
import { HookField } from "./brief-hook-field"
import { AiErrorNotice } from "./studio-ai"
import { copyText } from "./studio-utils"
import { publishedToast } from "./workspace-chips"
import { useSaveShortcut } from "./workspace-save"

type Suggestions = Partial<Record<BriefKey, string>>

const labelKey = (key: BriefKey) => `label_${key}` as const

const splitLines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)

const asText = (draft: BriefDraft, key: BriefKey) => (isListKey(key) ? draft[key].join("\n") : draft[key])

/** The Content Brief (spec §17): every field autosaves; "Generate brief with AI" proposes per-field suggestions. */
export function BriefTab({ item }: { item: ContentItem }) {
  const t = useT(briefMessages)
  const { draft, set, flush, state, markSaved } = useBriefAutosave(item.id)
  const ai = useAiTask("content_brief")
  const [suggestions, setSuggestions] = useState<Suggestions>({})
  const [engine, setEngine] = useState<{ provider: AiProviderId; model: string } | null>(null)
  const persona = useRow("audience_personas", item.persona_id)
  const problem = useRow("audience_problems", item.problem_id)
  const pending = BRIEF_KEYS.filter((key) => suggestions[key] !== undefined)

  useSaveShortcut("brief", () => {
    const saved = flush()
    toast.success(saved ? t("brief_saved") : t("brief_up_to_date"), {
      description: saved ? undefined : t("brief_autosaves"),
    })
  })

  const updateItem = (patch: UpdateRow<"content_items">) => {
    dataActions.update("content_items", item.id, patch)
    markSaved()
  }

  async function generate() {
    const input = buildBriefInput(dataActions.getDb(), item.id)
    if (!input) return
    const result = await ai.run(input, { entityType: "content_items", entityId: item.id })
    if (!result) return
    const out = result.output
    const proposed: Record<BriefKey, string> = {
      objective: out.objective,
      main_message: out.main_message,
      supporting_points: out.supporting_points.join("\n"),
      cta: out.cta,
      visual_direction: out.visual_direction,
      reference: out.reference_ideas,
      caption: out.caption,
      production_notes: out.production_notes,
      b_roll: out.b_roll.join("\n"),
      on_screen_text: out.on_screen_text.join("\n"),
    }
    const next: Suggestions = {}
    for (const key of BRIEF_KEYS) {
      const text = proposed[key].trim()
      if (text && text !== asText(draft, key).trim()) next[key] = text
    }
    setSuggestions(next)
    setEngine({ provider: result.provider, model: result.model })
    if (!Object.keys(next).length) toast.info(t("nothing_new"), { description: t("nothing_new_description") })
  }

  function write(key: BriefKey, text: string) {
    if (isListKey(key)) set(key, splitLines(text))
    else set(key, text.trim())
  }

  function dismiss(key: BriefKey) {
    setSuggestions((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function apply(key: BriefKey) {
    const text = suggestions[key]
    if (text === undefined) return
    write(key, text)
    flush()
    dismiss(key)
  }

  function applyAll() {
    for (const key of pending) write(key, suggestions[key] ?? "")
    flush()
    setSuggestions({})
    toast.success(t("brief_updated"), { description: t.plural("fields_applied", pending.length, { count: formatNumber(pending.length) }) })
  }

  function suggestionFor(key: BriefKey) {
    const value = suggestions[key]
    if (value === undefined) return null
    return (
      <SuggestionBox
        label={t(labelKey(key))}
        value={value}
        list={isListKey(key)}
        onChange={(text) => setSuggestions((current) => ({ ...current, [key]: text }))}
        onApply={() => apply(key)}
        onDismiss={() => dismiss(key)}
      />
    )
  }

  async function copyBrief() {
    const lines = [
      `# ${item.title}`,
      `${t("copy_platform")}: ${PLATFORMS[item.platform].label}${item.funnel_stage ? ` · ${FUNNEL_STAGES[item.funnel_stage].label}` : ""}`,
      persona ? `${t("copy_audience")}: ${persona.name}` : "",
      problem ? `${t("copy_problem")}: ${problem.problem}` : "",
      item.hook ? `${t("copy_hook")}: ${item.hook}` : "",
      ...BRIEF_KEYS.map((key) => {
        const value = draft[key]
        const label = t(labelKey(key))
        if (Array.isArray(value)) return value.length ? `${label}:\n${value.map((v) => `- ${v}`).join("\n")}` : ""
        return value.trim() ? `${label}: ${value.trim()}` : ""
      }),
    ].filter(Boolean)
    if (await copyText(lines.join("\n\n"))) toast.success(t("brief_copied"), { description: t("brief_copied_description") })
    else toast.error(t("brief_copy_failed"))
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-sm font-semibold">{t("content_brief")}</h2>
        <SaveIndicator state={state} />
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => void copyBrief()}>
            <ClipboardCopy aria-hidden />
            {t("copy_brief")}
          </Button>
          <AiButton type="button" size="sm" pending={ai.isPending} onClick={() => void generate()}>
            {engine ? t("regenerate_brief") : t("generate_brief")}
          </AiButton>
        </div>
      </div>

      <AiErrorNotice error={ai.error} onRetry={() => void generate()} />

      {pending.length ? (
        <div className="flex flex-col gap-2 rounded-lg border border-brand/30 bg-brand-soft px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Sparkles className="size-4 shrink-0 text-brand" aria-hidden />
            <p className="min-w-0 flex-1 text-sm text-pretty">
              <span className="font-medium">{t("ai_brief_ready")}</span>{" "}
              <span className="text-muted-foreground">
                {t.plural("suggestions_below", pending.length, { count: formatNumber(pending.length) })}
              </span>
            </p>
            {engine ? <ProviderBadge provider={engine.provider} model={engine.model} /> : null}
            <div className="flex items-center gap-1.5">
              <Button type="button" variant="ghost" size="sm" onClick={() => setSuggestions({})}>
                {t("discard")}
              </Button>
              <Button type="button" size="sm" onClick={applyAll}>
                {t("apply_all")}
              </Button>
            </div>
          </div>
          <AiNotice>{t("ai_notice")}</AiNotice>
        </div>
      ) : null}

      <SectionCard title={t("strategy")} info={t("strategy_description")} contentClassName="flex flex-col gap-4">
        <TitleField item={item} onSaved={markSaved} />
        <BriefTextField
          label={t("label_objective")}
          value={draft.objective}
          onChange={(v) => set("objective", v)}
          placeholder={t("objective_placeholder")}
          suggestion={suggestionFor("objective")}
        />
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <FormField label={t("target_audience")} description={persona ? [persona.profession, persona.experience_level].filter(Boolean).join(" · ") : undefined}>
            <PersonaSelect value={item.persona_id} onChange={(persona_id) => updateItem({ persona_id })} allowNone aria-label={t("target_audience")} />
          </FormField>
          <FormField
            label={t("audience_problem")}
            description={
              problem
                ? t("severity", { category: PROBLEM_CATEGORY_MAP[problem.category]?.label ?? problem.category, severity: problem.severity })
                : undefined
            }
          >
            <ProblemSelect
              value={item.problem_id}
              personaId={item.persona_id}
              onChange={(problem_id) => updateItem({ problem_id })}
              allowNone
              noneLabel={t("no_problem")}
              aria-label={t("audience_problem")}
            />
          </FormField>
          <FormField label={t("content_pillar")}>
            <PillarSelect value={item.pillar_id} onChange={(pillar_id) => updateItem({ pillar_id })} allowNone aria-label={t("content_pillar")} />
          </FormField>
          <FormField label={t("funnel_stage")}>
            <FunnelSelect value={item.funnel_stage} onChange={(funnel_stage) => updateItem({ funnel_stage })} allowNone aria-label={t("funnel_stage")} />
          </FormField>
          <FormField label={t("platform")}>
            <PlatformSelect value={item.platform} onChange={(platform) => platform && updateItem({ platform })} aria-label={t("platform")} />
          </FormField>
          <FormField label={t("format")}>
            <FormatSelect value={item.format_id} onChange={(format_id) => updateItem({ format_id })} allowNone aria-label={t("format")} />
          </FormField>
          <FormField label={t("angle")}>
            <AngleSelect value={item.angle_id} onChange={(angle_id) => updateItem({ angle_id })} allowNone aria-label={t("angle")} />
          </FormField>
          <FormField label={t("deadline")}>
            <DatePicker value={item.due_date} onChange={(due_date) => updateItem({ due_date })} placeholder={t("no_deadline")} aria-label={t("deadline")} />
          </FormField>
          <FormField label={t("status")}>
            <StageSelect
              value={item.stage}
              onChange={(stage) => {
                if (!stage || stage === item.stage) return
                const wasLive = PUBLISHED_STAGES.includes(item.stage)
                moveItemToStage(item.id, stage)
                markSaved()
                if (PUBLISHED_STAGES.includes(stage) && !wasLive) publishedToast(item.id)
              }}
              aria-label={t("status")}
            />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title={t("message")} info={t("message_description")} contentClassName="flex flex-col gap-4">
        <HookField item={item} mainMessage={draft.main_message} onSaved={markSaved} />
        <BriefTextField
          label={t("label_main_message")}
          value={draft.main_message}
          onChange={(v) => set("main_message", v)}
          placeholder={t("main_message_placeholder")}
          suggestion={suggestionFor("main_message")}
        />
        <BriefListField
          label={t("label_supporting_points")}
          value={draft.supporting_points}
          onChange={(v) => set("supporting_points", v)}
          placeholder={t("supporting_placeholder")}
          addLabel={t("add_point")}
          suggestion={suggestionFor("supporting_points")}
        />
        <BriefTextField
          label={t("label_cta")}
          value={draft.cta}
          onChange={(v) => set("cta", v)}
          rows={1}
          placeholder={t("cta_placeholder")}
          suggestion={suggestionFor("cta")}
        />
      </SectionCard>

      <SectionCard title={t("production")} info={t("production_description")} contentClassName="flex flex-col gap-4">
        <BriefTextField
          label={t("label_visual_direction")}
          value={draft.visual_direction}
          onChange={(v) => set("visual_direction", v)}
          placeholder={t("visual_placeholder")}
          suggestion={suggestionFor("visual_direction")}
        />
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <BriefListField
            label={t("label_b_roll")}
            value={draft.b_roll}
            onChange={(v) => set("b_roll", v)}
            placeholder={t("b_roll_placeholder")}
            addLabel={t("add_shot")}
            suggestion={suggestionFor("b_roll")}
          />
          <BriefListField
            label={t("label_on_screen_text")}
            value={draft.on_screen_text}
            onChange={(v) => set("on_screen_text", v)}
            placeholder={t("on_screen_placeholder")}
            addLabel={t("add_text")}
            suggestion={suggestionFor("on_screen_text")}
          />
        </div>
        <BriefTextField
          label={t("label_production_notes")}
          value={draft.production_notes}
          onChange={(v) => set("production_notes", v)}
          placeholder={t("notes_placeholder")}
          suggestion={suggestionFor("production_notes")}
        />
        <BriefTextField
          label={t("label_reference")}
          value={draft.reference}
          onChange={(v) => set("reference", v)}
          placeholder={t("reference_placeholder")}
          suggestion={suggestionFor("reference")}
        />
      </SectionCard>

      <SectionCard title={t("caption")} info={t("caption_description", { platform: PLATFORMS[item.platform].label })} contentClassName="flex flex-col gap-4">
        <BriefTextField
          label={t("label_caption")}
          value={draft.caption}
          onChange={(v) => set("caption", v)}
          rows={4}
          placeholder={t("caption_placeholder")}
          footer={<CaptionCounter text={draft.caption} platform={item.platform} />}
          suggestion={suggestionFor("caption")}
        />
      </SectionCard>
    </div>
  )
}

function TitleField({ item, onSaved }: { item: ContentItem; onSaved: () => void }) {
  const t = useT(briefMessages)
  const id = useId()
  const [draft, setDraft] = useState(item.title)
  const [source, setSource] = useState(item.title)
  if (source !== item.title) {
    setSource(item.title)
    setDraft(item.title)
  }
  const empty = !draft.trim()

  function commit() {
    const next = draft.replace(/\s+/g, " ").trim()
    if (!next) {
      setDraft(item.title)
      return
    }
    if (next !== item.title) {
      dataActions.update("content_items", item.id, { title: next })
      onSaved()
    }
  }

  return (
    <FormField label={t("content_title")} htmlFor={id} required error={empty ? t("title_required") : undefined}>
      <Input
        id={id}
        value={draft}
        maxLength={300}
        aria-invalid={empty || undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commit()
          }
        }}
      />
    </FormField>
  )
}
