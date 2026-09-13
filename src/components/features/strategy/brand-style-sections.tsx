"use client"

import { Plus } from "lucide-react"
import { chipVariants, ChipToggleGroup, FormField, FormRow, ListEditor, type ChipOption } from "@/components/common"
import { EXPERTISE_SUGGESTIONS, LANGUAGES, PERSONALITY_TRAITS, TONES } from "@/lib/constants"
import type { BrandLanguage, BrandTone, PersonalityTrait } from "@/lib/types"
import { BrandSection, BrandTextField, type BrandSectionProps } from "./brand-fields"
import { fieldId, LIST_LIMITS } from "./brand-model"

const PERSONALITY_OPTIONS: ChipOption<PersonalityTrait>[] = PERSONALITY_TRAITS.map((t) => ({ value: t.id, label: t.label }))
const LANGUAGE_OPTIONS: ChipOption<BrandLanguage>[] = LANGUAGES.map((l) => ({ value: l.id, label: l.label }))
const TONE_OPTIONS: ChipOption<BrandTone>[] = TONES.map((t) => ({ value: t.id, label: t.label }))

const LANGUAGE_HINTS: Record<BrandLanguage, string> = {
  english: "Drafts are written in English.",
  tagalog: "Drafts are written in Tagalog.",
  taglish: "Drafts mix English and Tagalog naturally — the way you talk on camera.",
}

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

  return (
    <BrandSection sectionKey="expertise">
      <FormField
        label="Expertise areas"
        htmlFor={fieldId("expertise_areas")}
        description={`3–8 topics you can speak on with authority. The AI reads up to ${max}.`}
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
          placeholder="Type an area and press Enter"
          aria-label="Expertise areas"
          onChange={(value) => set("expertise_areas", value)}
        />
      </FormField>
      {suggestions.length && !full ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">Suggestions</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className={chipVariants({ size: "xs" })}
                aria-label={`Add ${suggestion}`}
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
  return (
    <BrandSection sectionKey="personality">
      <FormField
        label="Personality traits"
        description={
          count > 5
            ? "More than five traits blurs the voice — keep the ones that are most you."
            : "Pick three to five traits that describe how you show up."
        }
        labelAction={<Count>{count} selected</Count>}
      >
        <div id={fieldId("personality_traits")}>
          <ChipToggleGroup
            multiple
            options={PERSONALITY_OPTIONS}
            value={values.personality_traits}
            onChange={(value) => set("personality_traits", value)}
            aria-label="Personality traits"
          />
        </div>
      </FormField>
    </BrandSection>
  )
}

/** Communication Style: language and tone. */
export function CommunicationSection({ values, set }: BrandSectionProps) {
  return (
    <BrandSection sectionKey="communication">
      <FormField label="Language" description={LANGUAGE_HINTS[values.language]}>
        <div id={fieldId("language")}>
          <ChipToggleGroup
            options={LANGUAGE_OPTIONS}
            value={values.language}
            required
            onChange={(value) => {
              if (value) set("language", value)
            }}
            aria-label="Language"
          />
        </div>
      </FormField>
      <FormField
        label="Tone"
        description="Pick one or more — a base tone plus one that adds edge works well."
        labelAction={<Count>{values.tones.length} selected</Count>}
      >
        <div id={fieldId("tones")}>
          <ChipToggleGroup
            multiple
            options={TONE_OPTIONS}
            value={values.tones}
            onChange={(value) => set("tones", value)}
            aria-label="Tone"
          />
        </div>
      </FormField>
    </BrandSection>
  )
}

/** Brand Rules: guardrails every draft follows. */
export function RulesSection({ values, set }: BrandSectionProps) {
  return (
    <BrandSection sectionKey="rules">
      <FormRow>
        <BrandTextField
          field="always_do"
          label="Always do"
          multiline
          value={values.always_do}
          placeholder="e.g. Use real numbers. Admit what I got wrong. Give one clear action."
          onChange={(value) => set("always_do", value)}
        />
        <BrandTextField
          field="never_do"
          label="Never do"
          multiline
          value={values.never_do}
          placeholder="e.g. Promise overnight results. Name or shame clients."
          onChange={(value) => set("never_do", value)}
        />
      </FormRow>
      <FormRow>
        <FormField
          label="Frequently used phrases"
          htmlFor={fieldId("phrases_used")}
          description="Signature lines the AI can weave in."
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
            placeholder="Type a phrase and press Enter"
            aria-label="Frequently used phrases"
            onChange={(value) => set("phrases_used", value)}
          />
        </FormField>
        <FormField
          label="Phrases to avoid"
          htmlFor={fieldId("phrases_avoid")}
          description="Words and clichés the AI must never use."
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
            placeholder="Type a phrase and press Enter"
            aria-label="Phrases to avoid"
            onChange={(value) => set("phrases_avoid", value)}
          />
        </FormField>
      </FormRow>
      <BrandTextField
        field="cta_style"
        label="Preferred CTA style"
        multiline
        value={values.cta_style}
        placeholder="e.g. Soft by default — comment a keyword or DM me. Direct only on BOFU posts."
        onChange={(value) => set("cta_style", value)}
      />
      <BrandTextField
        field="storytelling_style"
        label="Storytelling style"
        multiline
        value={values.storytelling_style}
        placeholder="e.g. Start in the middle of the moment, name the stakes, admit my part, end with one lesson."
        onChange={(value) => set("storytelling_style", value)}
      />
    </BrandSection>
  )
}
