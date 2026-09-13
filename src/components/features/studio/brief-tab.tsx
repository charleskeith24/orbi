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
import { FUNNEL_STAGES, PLATFORMS, PROBLEM_CATEGORY_MAP, PUBLISHED_STAGES } from "@/lib/constants"
import { dataActions, moveItemToStage, useRow } from "@/lib/store"
import type { AiProviderId, ContentItem, UpdateRow } from "@/lib/types"
import { pluralize } from "@/lib/utils"
import { BRIEF_KEYS, isListKey, useBriefAutosave, type BriefDraft, type BriefKey } from "./brief-autosave"
import { BriefListField, BriefTextField, CaptionCounter, SaveIndicator, SuggestionBox } from "./brief-fields"
import { HookField } from "./brief-hook-field"
import { AiErrorNotice } from "./studio-ai"
import { copyText } from "./studio-utils"
import { publishedToast } from "./workspace-chips"
import { useSaveShortcut } from "./workspace-save"

type Suggestions = Partial<Record<BriefKey, string>>

const LABELS: Record<BriefKey, string> = {
  objective: "Objective",
  main_message: "Main message",
  supporting_points: "Supporting points",
  cta: "CTA",
  visual_direction: "Visual direction",
  reference: "Reference",
  caption: "Caption",
  production_notes: "Production notes",
  b_roll: "B-roll",
  on_screen_text: "On-screen text",
}

const splitLines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)

const asText = (draft: BriefDraft, key: BriefKey) => (isListKey(key) ? draft[key].join("\n") : draft[key])

/** The Content Brief (spec §17): every field autosaves; "Generate brief with AI" proposes per-field suggestions. */
export function BriefTab({ item }: { item: ContentItem }) {
  const { draft, set, flush, state, markSaved } = useBriefAutosave(item.id)
  const ai = useAiTask("content_brief")
  const [suggestions, setSuggestions] = useState<Suggestions>({})
  const [engine, setEngine] = useState<{ provider: AiProviderId; model: string } | null>(null)
  const persona = useRow("audience_personas", item.persona_id)
  const problem = useRow("audience_problems", item.problem_id)
  const pending = BRIEF_KEYS.filter((key) => suggestions[key] !== undefined)

  useSaveShortcut("brief", () => {
    const saved = flush()
    toast.success(saved ? "Brief saved" : "Brief is up to date", {
      description: saved ? undefined : "The brief saves automatically as you type.",
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
    if (!Object.keys(next).length) toast.info("Nothing new to suggest", { description: "The AI draft matches your current brief." })
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
    toast.success("Brief updated from the AI draft", { description: `${pluralize(pending.length, "field")} applied — edit anything that doesn't sound like you.` })
  }

  function suggestionFor(key: BriefKey) {
    const value = suggestions[key]
    if (value === undefined) return null
    return (
      <SuggestionBox
        label={LABELS[key]}
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
      `Platform: ${PLATFORMS[item.platform].label}${item.funnel_stage ? ` · ${FUNNEL_STAGES[item.funnel_stage].label}` : ""}`,
      persona ? `Audience: ${persona.name}` : "",
      problem ? `Problem: ${problem.problem}` : "",
      item.hook ? `Hook: ${item.hook}` : "",
      ...BRIEF_KEYS.map((key) => {
        const value = draft[key]
        if (Array.isArray(value)) return value.length ? `${LABELS[key]}:\n${value.map((v) => `- ${v}`).join("\n")}` : ""
        return value.trim() ? `${LABELS[key]}: ${value.trim()}` : ""
      }),
    ].filter(Boolean)
    if (await copyText(lines.join("\n\n"))) toast.success("Brief copied", { description: "Paste it into a message to your editor or designer." })
    else toast.error("Couldn't copy the brief")
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-sm font-semibold">Content Brief</h2>
        <SaveIndicator state={state} />
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => void copyBrief()}>
            <ClipboardCopy aria-hidden />
            Copy brief
          </Button>
          <AiButton type="button" size="sm" pending={ai.isPending} onClick={() => void generate()}>
            {engine ? "Regenerate brief" : "Generate brief with AI"}
          </AiButton>
        </div>
      </div>

      <AiErrorNotice error={ai.error} onRetry={() => void generate()} />

      {pending.length ? (
        <div className="flex flex-col gap-2 rounded-lg border border-brand/30 bg-brand-soft px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Sparkles className="size-4 shrink-0 text-brand" aria-hidden />
            <p className="min-w-0 flex-1 text-sm text-pretty">
              <span className="font-medium">AI brief ready</span>{" "}
              <span className="text-muted-foreground">
                — {pluralize(pending.length, "suggestion")} below. Edit them, then apply field by field or all at once.
              </span>
            </p>
            {engine ? <ProviderBadge provider={engine.provider} model={engine.model} /> : null}
            <div className="flex items-center gap-1.5">
              <Button type="button" variant="ghost" size="sm" onClick={() => setSuggestions({})}>
                Discard
              </Button>
              <Button type="button" size="sm" onClick={applyAll}>
                Apply all
              </Button>
            </div>
          </div>
          <AiNotice>Built from your Brand HQ, audience, pillars and winners. It&apos;s a first draft — make it sound like you.</AiNotice>
        </div>
      ) : null}

      <SectionCard title="Strategy" description="Who it's for, why it exists and where it sits in your system." contentClassName="flex flex-col gap-4">
        <TitleField item={item} onSaved={markSaved} />
        <BriefTextField
          label="Objective"
          value={draft.objective}
          onChange={(v) => set("objective", v)}
          placeholder="What this piece must achieve, for whom, at which funnel stage"
          suggestion={suggestionFor("objective")}
        />
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <FormField label="Target audience" description={persona ? [persona.profession, persona.experience_level].filter(Boolean).join(" · ") : undefined}>
            <PersonaSelect value={item.persona_id} onChange={(persona_id) => updateItem({ persona_id })} allowNone aria-label="Target audience" />
          </FormField>
          <FormField
            label="Audience problem"
            description={problem ? `${PROBLEM_CATEGORY_MAP[problem.category]?.label ?? problem.category} · severity ${problem.severity}/5` : undefined}
          >
            <ProblemSelect
              value={item.problem_id}
              personaId={item.persona_id}
              onChange={(problem_id) => updateItem({ problem_id })}
              allowNone
              noneLabel="Not linked to a problem"
              aria-label="Audience problem"
            />
          </FormField>
          <FormField label="Content pillar">
            <PillarSelect value={item.pillar_id} onChange={(pillar_id) => updateItem({ pillar_id })} allowNone aria-label="Content pillar" />
          </FormField>
          <FormField label="Funnel stage">
            <FunnelSelect value={item.funnel_stage} onChange={(funnel_stage) => updateItem({ funnel_stage })} allowNone aria-label="Funnel stage" />
          </FormField>
          <FormField label="Platform">
            <PlatformSelect value={item.platform} onChange={(platform) => platform && updateItem({ platform })} aria-label="Platform" />
          </FormField>
          <FormField label="Format">
            <FormatSelect value={item.format_id} onChange={(format_id) => updateItem({ format_id })} allowNone aria-label="Format" />
          </FormField>
          <FormField label="Angle">
            <AngleSelect value={item.angle_id} onChange={(angle_id) => updateItem({ angle_id })} allowNone aria-label="Angle" />
          </FormField>
          <FormField label="Deadline">
            <DatePicker value={item.due_date} onChange={(due_date) => updateItem({ due_date })} placeholder="No deadline" aria-label="Deadline" />
          </FormField>
          <FormField label="Status">
            <StageSelect
              value={item.stage}
              onChange={(stage) => {
                if (!stage || stage === item.stage) return
                const wasLive = PUBLISHED_STAGES.includes(item.stage)
                moveItemToStage(item.id, stage)
                markSaved()
                if (PUBLISHED_STAGES.includes(stage) && !wasLive) publishedToast(item.id)
              }}
              aria-label="Status"
            />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Message" description="The hook, the one idea and the proof behind it." contentClassName="flex flex-col gap-4">
        <HookField item={item} mainMessage={draft.main_message} onSaved={markSaved} />
        <BriefTextField
          label="Main message"
          value={draft.main_message}
          onChange={(v) => set("main_message", v)}
          placeholder="The one sentence the audience should remember"
          suggestion={suggestionFor("main_message")}
        />
        <BriefListField
          label="Supporting points"
          value={draft.supporting_points}
          onChange={(v) => set("supporting_points", v)}
          placeholder="A point that proves or unpacks the message"
          addLabel="Add point"
          suggestion={suggestionFor("supporting_points")}
        />
        <BriefTextField
          label="CTA"
          value={draft.cta}
          onChange={(v) => set("cta", v)}
          rows={1}
          placeholder="What should they do next?"
          suggestion={suggestionFor("cta")}
        />
      </SectionCard>

      <SectionCard title="Production" description="Everything a creator or editor needs to produce it." contentClassName="flex flex-col gap-4">
        <BriefTextField
          label="Visual direction"
          value={draft.visual_direction}
          onChange={(v) => set("visual_direction", v)}
          placeholder="Setting, framing, style, pacing"
          suggestion={suggestionFor("visual_direction")}
        />
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <BriefListField
            label="B-roll"
            value={draft.b_roll}
            onChange={(v) => set("b_roll", v)}
            placeholder="A cutaway or supporting shot"
            addLabel="Add shot"
            suggestion={suggestionFor("b_roll")}
          />
          <BriefListField
            label="On-screen text"
            value={draft.on_screen_text}
            onChange={(v) => set("on_screen_text", v)}
            placeholder="A caption or callout"
            addLabel="Add text"
            suggestion={suggestionFor("on_screen_text")}
          />
        </div>
        <BriefTextField
          label="Production notes"
          value={draft.production_notes}
          onChange={(v) => set("production_notes", v)}
          placeholder="Takes, props, numbers to have ready, batching"
          suggestion={suggestionFor("production_notes")}
        />
        <BriefTextField
          label="Reference"
          value={draft.reference}
          onChange={(v) => set("reference", v)}
          placeholder="Past winners or structures to model — structure only, never copy"
          suggestion={suggestionFor("reference")}
        />
      </SectionCard>

      <SectionCard title="Caption" description={`What goes with the post on ${PLATFORMS[item.platform].label}.`} contentClassName="flex flex-col gap-4">
        <BriefTextField
          label="Caption"
          value={draft.caption}
          onChange={(v) => set("caption", v)}
          rows={4}
          placeholder="Caption copy, in your voice"
          footer={<CaptionCounter text={draft.caption} platform={item.platform} />}
          suggestion={suggestionFor("caption")}
        />
      </SectionCard>
    </div>
  )
}

function TitleField({ item, onSaved }: { item: ContentItem; onSaved: () => void }) {
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
    <FormField label="Content title" htmlFor={id} required error={empty ? "A title is required — the previous one is kept." : undefined}>
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
