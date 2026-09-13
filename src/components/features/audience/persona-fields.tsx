"use client"

import Link from "next/link"
import { useId } from "react"
import { ColorSwatchPicker, FormField, FormRow, ListEditor, PlatformToggleGroup } from "@/components/common"
import { dataActions } from "@/lib/store"
import type { AudiencePersona, ID, UpdateRow } from "@/lib/types"
import { AutosaveInput, AutosaveTextarea } from "./autosave-field"

const save = (id: ID, patch: UpdateRow<"audience_personas">) => dataActions.update("audience_personas", id, patch)

type PersonaTextKey = "age_range" | "profession" | "industry" | "experience_level" | "location"
type PersonaListKey =
  | "goals"
  | "aspirations"
  | "problems"
  | "fears"
  | "frustrations"
  | "questions"
  | "objections"
  | "content_consumed"
  | "influencers"
  | "language_used"

function textPatch(key: PersonaTextKey, value: string): UpdateRow<"audience_personas"> {
  const patch: UpdateRow<"audience_personas"> = {}
  patch[key] = value
  return patch
}

function listPatch(key: PersonaListKey, value: string[]): UpdateRow<"audience_personas"> {
  const patch: UpdateRow<"audience_personas"> = {}
  patch[key] = value
  return patch
}

const TEXT_FIELDS: { key: PersonaTextKey; label: string; placeholder: string }[] = [
  { key: "age_range", label: "Age range", placeholder: "e.g. 28–42" },
  { key: "profession", label: "Profession", placeholder: "e.g. Founder of a DTC brand" },
  { key: "industry", label: "Industry", placeholder: "e.g. E-commerce — beauty, fashion" },
  { key: "experience_level", label: "Experience level", placeholder: "e.g. 3–7 years in business" },
  { key: "location", label: "Location", placeholder: "e.g. Metro Manila" },
]

const LINK = "underline underline-offset-4 hover:text-foreground"

interface ListFieldSpec {
  key: PersonaListKey
  label: string
  placeholder: string
  variant: "lines" | "chips"
  description?: (persona: AudiencePersona) => React.ReactNode
}

export const GOALS_AND_PAINS: ListFieldSpec[] = [
  { key: "goals", label: "Goals", placeholder: "What are they trying to achieve?", variant: "lines" },
  { key: "aspirations", label: "Aspirations", placeholder: "What would success look like for them?", variant: "lines" },
  {
    key: "problems",
    label: "Problems",
    placeholder: "What is getting in their way?",
    variant: "lines",
    description: (persona) => (
      <>
        In their words. Problems you&apos;ll make content about live in the{" "}
        <Link href={`/audience/problems?persona=${persona.id}`} className={LINK}>
          Problem Bank
        </Link>
        .
      </>
    ),
  },
  { key: "fears", label: "Fears", placeholder: "What keeps them up at night?", variant: "lines" },
  { key: "frustrations", label: "Frustrations", placeholder: "What annoys them about the status quo?", variant: "lines" },
  {
    key: "questions",
    label: "Questions",
    placeholder: "What do they keep asking?",
    variant: "lines",
    description: (persona) => (
      <>
        Questions people actually asked you are counted in the{" "}
        <Link href={`/audience/questions?persona=${persona.id}`} className={LINK}>
          Question Bank
        </Link>
        .
      </>
    ),
  },
  { key: "objections", label: "Objections", placeholder: "Why might they say no?", variant: "lines" },
]

const MEDIA_AND_VOICE: ListFieldSpec[] = [
  { key: "content_consumed", label: "Content they consume", placeholder: "Podcasts, groups, newsletters…", variant: "lines" },
  { key: "influencers", label: "Influencers they follow", placeholder: "A creator, author or community", variant: "lines" },
  {
    key: "language_used",
    label: "Language they use",
    placeholder: "Type a word or phrase and press Enter",
    variant: "chips",
    description: () => "Their exact words and phrases — hooks and captions should sound like this.",
  },
]

/** Identity, colour, buying motivation and notes. Text saves on blur / Enter. */
export function PersonaProfileFields({ persona }: { persona: AudiencePersona }) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FormRow>
        <FormField label="Name" htmlFor={`${id}-name`} required>
          <AutosaveInput
            id={`${id}-name`}
            value={persona.name}
            maxLength={120}
            required
            requiredMessage="Give this persona a name."
            onCommit={(name) => save(persona.id, { name })}
          />
        </FormField>
        {TEXT_FIELDS.map((field) => (
          <FormField key={field.key} label={field.label} htmlFor={`${id}-${field.key}`}>
            <AutosaveInput
              id={`${id}-${field.key}`}
              value={persona[field.key]}
              maxLength={200}
              placeholder={field.placeholder}
              onCommit={(value) => save(persona.id, textPatch(field.key, value))}
            />
          </FormField>
        ))}
      </FormRow>
      <FormField label="Colour" description="Identifies this persona in badges, filters and charts.">
        <ColorSwatchPicker value={persona.color} onChange={(color) => save(persona.id, { color })} aria-label="Persona colour" />
      </FormField>
      <FormField
        label="Buying motivation"
        htmlFor={`${id}-motivation`}
        description="What finally makes them act — and what they need to see first."
      >
        <AutosaveTextarea
          id={`${id}-motivation`}
          value={persona.buying_motivation}
          maxLength={2000}
          rows={3}
          placeholder="e.g. Buys when a plateau starts hurting cash flow and someone shows real numbers."
          onCommit={(buying_motivation) => save(persona.id, { buying_motivation })}
        />
      </FormField>
      <FormField label="Notes" htmlFor={`${id}-notes`}>
        <AutosaveTextarea
          id={`${id}-notes`}
          value={persona.notes}
          maxLength={4000}
          rows={3}
          placeholder="Anything else worth remembering when you create for them"
          onCommit={(notes) => save(persona.id, { notes })}
        />
      </FormField>
    </div>
  )
}

/** A stack of list fields; every add, edit, reorder or removal saves immediately. */
export function PersonaListFields({ persona, fields }: { persona: AudiencePersona; fields: ListFieldSpec[] }) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {fields.map((field) => {
        const value = persona[field.key]
        return (
          <FormField
            key={field.key}
            htmlFor={`${id}-${field.key}`}
            description={field.description?.(persona)}
            label={
              <>
                {field.label}
                {value.length ? <span className="ml-1.5 font-normal text-muted-foreground num">{value.length}</span> : null}
              </>
            }
          >
            <ListEditor
              id={`${id}-${field.key}`}
              variant={field.variant}
              value={value}
              maxItems={40}
              placeholder={field.placeholder}
              aria-label={field.label}
              onChange={(next) => save(persona.id, listPatch(field.key, next))}
            />
          </FormField>
        )
      })}
    </div>
  )
}

/** Platforms they use, what they consume, who they follow and the words they use. */
export function PersonaMediaFields({ persona }: { persona: AudiencePersona }) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <FormField label="Platforms" description="Where they spend their attention.">
        <PlatformToggleGroup
          value={persona.platforms}
          onChange={(platforms) => save(persona.id, { platforms })}
          aria-label="Persona platforms"
        />
      </FormField>
      <PersonaListFields persona={persona} fields={MEDIA_AND_VOICE} />
    </div>
  )
}
