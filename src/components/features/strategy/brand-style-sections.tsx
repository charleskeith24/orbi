"use client"

import { Plus } from "lucide-react"
import { chipVariants, ChipToggleGroup, FormRow, ListEditor, type ChipOption } from "@/components/common"
import { EXPERTISE_SUGGESTIONS, LANGUAGES, PERSONALITY_TRAITS, TONES } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import type { BrandLanguage, BrandTone, PersonalityTrait } from "@/lib/types"
import { BrandFieldShell, BrandSection, BrandTextField, type BrandSectionProps } from "./brand-fields"
import { brandFieldMessages } from "./brand-messages"
import { fieldId, LIST_LIMITS } from "./brand-model"

const PERSONALITY_OPTIONS: ChipOption<PersonalityTrait>[] = PERSONALITY_TRAITS.map((t) => ({ value: t.id, label: t.label }))
const LANGUAGE_OPTIONS: ChipOption<BrandLanguage>[] = LANGUAGES.map((l) => ({ value: l.id, label: l.label }))
const TONE_OPTIONS: ChipOption<BrandTone>[] = TONES.map((t) => ({ value: t.id, label: t.label }))

function Count({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-muted-foreground num">{children}</span>
}

/** Expertise Areas: chips plus one-click suggestions. */
export function ExpertiseSection({ values, set }: BrandSectionProps) {
  const areas = values.expertise_areas
  const max = LIST_LIMITS.expertise_areas
  const taken = new Set(areas.map((a) => a.toLowerCase()))
  const suggestions = EXPERTISE_SUGGESTIONS.filter((s) => !taken.has(s.toLowerCase()))
  const full = areas.length >= max
  const t = useT(brandFieldMessages)

  return (
    <BrandSection sectionKey="expertise">
      <BrandFieldShell
        label={t("expertise_label")}
        htmlFor={fieldId("expertise_areas")}
        hint={t("expertise_description", { max })}
        labelAction={
          <Count>
            {areas.length} / {max}
          </Count>
        }
      >
        <ListEditor
          id={fieldId("expertise_areas")}
          value={areas}
          maxItems={max}
          placeholder={t("expertise_placeholder")}
          aria-label={t("expertise_label")}
          onChange={(value) => set("expertise_areas", value)}
        />
      </BrandFieldShell>
      {suggestions.length && !full ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">{t("suggestions")}</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className={chipVariants({ size: "xs" })}
                aria-label={t("add_suggestion", { name: suggestion })}
                onClick={() => set("expertise_areas", [...areas, suggestion])}
              >
                <Plus aria-hidden />
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </BrandSection>
  )
}

/** Brand Personality: the ten selectable traits. */
export function PersonalitySection({ values, set }: BrandSectionProps) {
  const count = values.personality_traits.length
  const t = useT(brandFieldMessages)
  return (
    <BrandSection sectionKey="personality">
      <BrandFieldShell
        label={t("traits_label")}
        hint={t("traits_hint")}
        description={count > 5 ? t("traits_too_many") : undefined}
        labelAction={<Count>{t("selected", { count })}</Count>}
      >
        <div id={fieldId("personality_traits")}>
          <ChipToggleGroup
            multiple
            options={PERSONALITY_OPTIONS}
            value={values.personality_traits}
            onChange={(value) => set("personality_traits", value)}
            aria-label={t("traits_label")}
          />
        </div>
      </BrandFieldShell>
    </BrandSection>
  )
}

/** Communication Style: language and tone. */
export function CommunicationSection({ values, set }: BrandSectionProps) {
  const t = useT(brandFieldMessages)
  return (
    <BrandSection sectionKey="communication">
      <BrandFieldShell label={t("language_label")} hint={t("language_hint")}>
        <div id={fieldId("language")}>
          <ChipToggleGroup
            options={LANGUAGE_OPTIONS}
            value={values.language}
            required
            onChange={(value) => {
              if (value) set("language", value)
            }}
            aria-label={t("language_label")}
          />
        </div>
      </BrandFieldShell>
      <BrandFieldShell
        label={t("tone_label")}
        hint={t("tone_hint")}
        labelAction={<Count>{t("selected", { count: values.tones.length })}</Count>}
      >
        <div id={fieldId("tones")}>
          <ChipToggleGroup
            multiple
            options={TONE_OPTIONS}
            value={values.tones}
            onChange={(value) => set("tones", value)}
            aria-label={t("tone_label")}
          />
        </div>
      </BrandFieldShell>
    </BrandSection>
  )
}

/** Brand Rules: guardrails every draft follows. */
export function RulesSection({ values, set }: BrandSectionProps) {
  const t = useT(brandFieldMessages)
  return (
    <BrandSection sectionKey="rules">
      <FormRow>
        <BrandTextField
          field="always_do"
          label={t("always_label")}
          multiline
          value={values.always_do}
          placeholder={t("always_placeholder")}
          onChange={(value) => set("always_do", value)}
        />
        <BrandTextField
          field="never_do"
          label={t("never_label")}
          multiline
          value={values.never_do}
          placeholder={t("never_placeholder")}
          onChange={(value) => set("never_do", value)}
        />
      </FormRow>
      <FormRow>
        <BrandFieldShell
          label={t("phrases_used_label")}
          htmlFor={fieldId("phrases_used")}
          hint={t("phrases_used_description")}
          labelAction={
            <Count>
              {values.phrases_used.length} / {LIST_LIMITS.phrases_used}
            </Count>
          }
        >
          <ListEditor
            id={fieldId("phrases_used")}
            value={values.phrases_used}
            maxItems={LIST_LIMITS.phrases_used}
            placeholder={t("phrase_placeholder")}
            aria-label={t("phrases_used_label")}
            onChange={(value) => set("phrases_used", value)}
          />
        </BrandFieldShell>
        <BrandFieldShell
          label={t("phrases_avoid_label")}
          htmlFor={fieldId("phrases_avoid")}
          hint={t("phrases_avoid_description")}
          labelAction={
            <Count>
              {values.phrases_avoid.length} / {LIST_LIMITS.phrases_avoid}
            </Count>
          }
        >
          <ListEditor
            id={fieldId("phrases_avoid")}
            value={values.phrases_avoid}
            maxItems={LIST_LIMITS.phrases_avoid}
            placeholder={t("phrase_placeholder")}
            aria-label={t("phrases_avoid_label")}
            onChange={(value) => set("phrases_avoid", value)}
          />
        </BrandFieldShell>
      </FormRow>
      <BrandTextField
        field="cta_style"
        label={t("cta_label")}
        multiline
        value={values.cta_style}
        placeholder={t("cta_placeholder")}
        onChange={(value) => set("cta_style", value)}
      />
      <BrandTextField
        field="storytelling_style"
        label={t("storytelling_label")}
        multiline
        value={values.storytelling_style}
        placeholder={t("storytelling_placeholder")}
        onChange={(value) => set("storytelling_style", value)}
      />
    </BrandSection>
  )
}
