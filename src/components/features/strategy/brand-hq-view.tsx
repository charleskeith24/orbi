"use client"

import { Compass, MessagesSquare } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { AiButton, PageContainer, PageHeader } from "@/components/common"
import { Button } from "@/components/ui/button"
import { positioningStatement, useAiTask } from "@/lib/ai"
import { useT, useUiLang } from "@/lib/i18n"
import { uiActions, updateBrand, useBrand, useDb } from "@/lib/store"
import {
  BRAND_SECTIONS,
  brandCompleteness,
  brandFormValues,
  brandPatch,
  brandSuggestionInput,
  changedFields,
  fieldId,
  sectionOf,
  splitPositioning,
  suggestionExtras,
  validateBrand,
  type BrandField,
  type BrandFormValues,
  type SetBrandValue,
} from "./brand-model"
import { brandHqMessages } from "./brand-messages"
import { BrandSectionNav, CompletenessCard } from "./brand-nav"
import { IdentitySection, PositioningSection } from "./brand-sections"
import { CommunicationSection, ExpertiseSection, PersonalitySection, RulesSection } from "./brand-style-sections"
import { BrandVoicePreview } from "./brand-voice-preview"
import { NicheSection } from "./niche-section"
import { StatementSection } from "./positioning-builder"
import { PositioningSuggestions, type SuggestionField, type SuggestionValues } from "./positioning-suggestions"
import { relativeDayInline } from "./relative-day"
import { SaveBar } from "./save-bar"
import { StrategyTabs } from "./strategy-tabs"
import { useNow } from "./use-now"
import { focusControl, scrollToSection, useScrollSpy } from "./use-scroll-spy"

const SPY_IDS: readonly string[] = [...BRAND_SECTIONS.map((s) => s.key), "voice"]

/** At xl the Brand Voice sits in a sticky side rail, so it never becomes the "current" section. */
function ignoreRail(el: HTMLElement): boolean {
  return el.id === "voice" && window.matchMedia("(min-width: 80rem)").matches
}

// Sent to the Content Strategist as the question, so it stays English (the AI follows Brand HQ's language).
const STRATEGIST_PROMPT =
  "Review my Brand HQ. Is my positioning specific enough, and what would make my point of view more distinctive?"

/** Brand HQ (spec §3, §4, §29): the sectioned brand editor every AI generation reads. */
export function BrandHqView() {
  const brand = useBrand()
  const db = useDb()
  const now = useNow()
  const formRef = useRef<HTMLFormElement>(null)
  const lang = useUiLang()
  const t = useT(brandHqMessages)

  const saved = useMemo(() => brandFormValues(brand), [brand])
  const [edits, setEdits] = useState<Partial<BrandFormValues>>({})
  const values = useMemo(() => ({ ...saved, ...edits }) as BrandFormValues, [saved, edits])
  const changed = useMemo(() => changedFields(values, saved), [values, saved])
  const dirty = changed.length > 0
  const errors = useMemo(() => validateBrand(values, lang), [values, lang])
  const errorFields = Object.keys(errors) as BrandField[]
  const completeness = useMemo(() => brandCompleteness(values), [values])
  const dirtySections = useMemo(() => new Set(changed.map(sectionOf)), [changed])
  const active = useScrollSpy(SPY_IDS, 96, ignoreRail)

  const set = useCallback<SetBrandValue>((key, value) => setEdits((current) => ({ ...current, [key]: value })), [])

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!dirty) return
    if (errorFields.length) {
      focusControl(fieldId(errorFields[0]))
      return
    }
    updateBrand(brandPatch(values))
    setEdits({})
    toast.success(t("saved_toast"), { description: t("saved_toast_description") })
  }

  function discard() {
    setEdits({})
    toast(t("discarded_toast"))
  }

  // ⌘S / Ctrl+S saves; unsaved edits survive an accidental reload prompt.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault()
        formRef.current?.requestSubmit()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])

  // Deep links like /strategy#rules land on the section once the workspace has rendered.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id) return
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }))
    return () => cancelAnimationFrame(frame)
  }, [])

  /* ------------------------------ Suggest with AI ----------------------------- */

  const ai = useAiTask("onboarding_strategy")
  const [panel, setPanel] = useState({ open: false, run: 0 })

  async function suggest() {
    setPanel((p) => ({ ...p, open: true }))
    const result = await ai.run(brandSuggestionInput(values, suggestionExtras(db, values)), {
      entityType: "brand_profiles",
      entityId: brand.id,
    })
    if (result) setPanel((p) => ({ open: true, run: p.run + 1 }))
  }

  function dismissSuggestions() {
    setPanel((p) => ({ ...p, open: false }))
    ai.reset()
  }

  function applySuggestion(field: SuggestionField, value: string) {
    if (field === "statement") {
      const parts = splitPositioning(value, {
        audience: values.positioning_audience,
        result: values.positioning_result,
        method: values.positioning_method,
      })
      setEdits((current) => ({
        ...current,
        positioning_audience: parts.audience,
        positioning_result: parts.result,
        positioning_method: parts.method,
      }))
      toast.success(t("statement_applied"), { description: t("statement_applied_description") })
      return
    }
    set(field, value)
    toast.success(field === "known_for" ? t("known_for_applied") : t("point_of_view_applied"), {
      description: t("applied_description"),
    })
  }

  const suggestion: SuggestionValues | null = ai.data
    ? { statement: ai.data.positioning_statement, known_for: ai.data.known_for, point_of_view: ai.data.point_of_view }
    : null
  const current: SuggestionValues = {
    statement: positioningStatement(values.positioning_audience, values.positioning_result, values.positioning_method),
    known_for: values.known_for,
    point_of_view: values.point_of_view,
  }

  const savedLabel = t("saved_label", { when: relativeDayInline(brand.updated_at, now, lang) })
  const sectionProps = { values, set, errors: dirty ? errors : {} }

  return (
    <PageContainer>
      <PageHeader
        title="Brand HQ"
        icon={Compass}
        description={t("description")}
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => uiActions.askStrategist(STRATEGIST_PROMPT)}>
            <MessagesSquare aria-hidden />
            {t("review_with_strategist")}
          </Button>
        }
      >
        <StrategyTabs />
      </PageHeader>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[11rem_minmax(0,1fr)] xl:grid-cols-[11rem_minmax(0,1fr)_19rem]">
        <aside aria-label={t("progress_label")} className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-16 lg:self-start">
          <CompletenessCard completeness={completeness} onNext={(item) => focusControl(fieldId(item.field))} />
          <BrandSectionNav active={active} completeness={completeness} dirtySections={dirtySections} onJump={scrollToSection} />
        </aside>

        <form ref={formRef} onSubmit={save} noValidate aria-label="Brand HQ" className="flex min-w-0 flex-col gap-4">
          <NicheSection {...sectionProps} dirty={dirty} now={now} />
          <IdentitySection {...sectionProps} />
          <PositioningSection
            {...sectionProps}
            action={
              <AiButton type="button" size="sm" pending={ai.isPending} onClick={() => void suggest()}>
                {t("suggest")}
              </AiButton>
            }
            suggestions={
              panel.open ? (
                <PositioningSuggestions
                  key={panel.run}
                  suggestion={suggestion}
                  current={current}
                  provider={ai.provider}
                  model={ai.model}
                  pending={ai.isPending}
                  error={ai.error?.message ?? null}
                  onApply={applySuggestion}
                  onRegenerate={() => void suggest()}
                  onDismiss={dismissSuggestions}
                />
              ) : null
            }
          />
          <StatementSection {...sectionProps} />
          <ExpertiseSection {...sectionProps} />
          <PersonalitySection {...sectionProps} />
          <CommunicationSection {...sectionProps} />
          <RulesSection {...sectionProps} />
          <SaveBar
            dirty={dirty}
            changes={changed.length}
            errorCount={errorFields.length}
            savedLabel={savedLabel}
            onDiscard={discard}
            onShowErrors={() => errorFields[0] && focusControl(fieldId(errorFields[0]))}
          />
        </form>

        <aside
          aria-label={t("voice_label")}
          className="min-w-0 scrollbar-thin lg:col-start-2 xl:sticky xl:top-16 xl:col-start-3 xl:row-start-1 xl:max-h-[calc(100svh-5rem)] xl:self-start xl:overflow-y-auto"
        >
          <BrandVoicePreview values={values} dirty={dirty} now={now} />
        </aside>
      </div>
    </PageContainer>
  )
}
