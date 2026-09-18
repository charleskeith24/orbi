"use client"

import Link from "next/link"
import { useId } from "react"
import { ColorSwatchPicker, FormField, FormRow, ListEditor, PlatformToggleGroup } from "@/components/common"
import { useT, type Translator } from "@/lib/i18n"
import { dataActions } from "@/lib/store"
import type { AudiencePersona, ID, UpdateRow } from "@/lib/types"
import { AutosaveInput, AutosaveTextarea } from "./autosave-field"
import { personaMessages } from "./persona-messages"

type PersonaKey = keyof (typeof personaMessages)["en"]
type PersonaT = Translator<(typeof personaMessages)["en"]>

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

/** Full-width rows: these values are often a long phrase ("Metro Manila, Cebu, Davao — plus founders across SEA"). */
const TEXT_FIELDS: { key: Exclude<PersonaTextKey, "age_range">; label: PersonaKey; placeholder: PersonaKey }[] = [
  { key: "profession", label: "profession", placeholder: "profession_placeholder" },
  { key: "industry", label: "industry", placeholder: "industry_placeholder" },
  { key: "experience_level", label: "experience_level", placeholder: "experience_placeholder" },
  { key: "location", label: "location", placeholder: "location_placeholder" },
]

const LINK = "underline underline-offset-4 hover:text-foreground"

interface ListFieldSpec {
  key: PersonaListKey
  label: PersonaKey
  placeholder: PersonaKey
  variant: "lines" | "chips"
  description?: (persona: AudiencePersona, t: PersonaT) => React.ReactNode
}

export const GOALS_AND_PAINS: ListFieldSpec[] = [
  { key: "goals", label: "goals", placeholder: "goals_placeholder", variant: "lines" },
  { key: "aspirations", label: "aspirations", placeholder: "aspirations_placeholder", variant: "lines" },
  {
    key: "problems",
    label: "problems",
    placeholder: "problems_placeholder",
    variant: "lines",
    description: (persona, t) => (
      <>
        {t("problems_description")}{" "}
        <Link href={`/audience/problems?persona=${persona.id}`} className={LINK}>
          Problem Bank
        </Link>
        .
      </>
    ),
  },
  { key: "fears", label: "fears", placeholder: "fears_placeholder", variant: "lines" },
  { key: "frustrations", label: "frustrations", placeholder: "frustrations_placeholder", variant: "lines" },
  {
    key: "questions",
    label: "questions",
    placeholder: "questions_placeholder",
    variant: "lines",
    description: (persona, t) => (
      <>
        {t("questions_description")}{" "}
        <Link href={`/audience/questions?persona=${persona.id}`} className={LINK}>
          Question Bank
        </Link>
        .
      </>
    ),
  },
  { key: "objections", label: "objections", placeholder: "objections_placeholder", variant: "lines" },
]

const MEDIA_AND_VOICE: ListFieldSpec[] = [
  { key: "content_consumed", label: "content_consumed", placeholder: "content_consumed_placeholder", variant: "lines" },
  { key: "influencers", label: "influencers", placeholder: "influencers_placeholder", variant: "lines" },
  {
    key: "language_used",
    label: "language_used",
    placeholder: "language_used_placeholder",
    variant: "chips",
    description: (_persona, t) => t("language_used_description"),
  },
]

/** Identity, colour, buying motivation and notes. Text saves on blur / Enter. */
export function PersonaProfileFields({ persona }: { persona: AudiencePersona }) {
  const id = useId()
  const t = useT(personaMessages)
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FormRow className="sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <FormField label={t("name")} htmlFor={`${id}-name`} required>
          <AutosaveInput
            id={`${id}-name`}
            value={persona.name}
            maxLength={120}
            required
            requiredMessage={t("name_required")}
            onCommit={(name) => save(persona.id, { name })}
          />
        </FormField>
        <FormField label={t("age_range")} htmlFor={`${id}-age_range`}>
          <AutosaveInput
            id={`${id}-age_range`}
            value={persona.age_range}
            maxLength={40}
            placeholder={t("age_placeholder")}
            onCommit={(age_range) => save(persona.id, { age_range })}
          />
        </FormField>
      </FormRow>
      {TEXT_FIELDS.map((field) => (
        <FormField key={field.key} label={t(field.label)} htmlFor={`${id}-${field.key}`}>
          <AutosaveInput
            id={`${id}-${field.key}`}
            value={persona[field.key]}
            maxLength={200}
            placeholder={t(field.placeholder)}
            onCommit={(value) => save(persona.id, textPatch(field.key, value))}
          />
        </FormField>
      ))}
      <FormField label={t("colour")} description={t("colour_description")}>
        <ColorSwatchPicker value={persona.color} onChange={(color) => save(persona.id, { color })} aria-label={t("colour_aria")} />
      </FormField>
      <FormField
        label={t("buying_motivation")}
        htmlFor={`${id}-motivation`}
        description={t("buying_motivation_description")}
      >
        <AutosaveTextarea
          id={`${id}-motivation`}
          value={persona.buying_motivation}
          maxLength={2000}
          rows={3}
          placeholder={t("buying_motivation_placeholder")}
          onCommit={(buying_motivation) => save(persona.id, { buying_motivation })}
        />
      </FormField>
      <FormField label={t("notes")} htmlFor={`${id}-notes`}>
        <AutosaveTextarea
          id={`${id}-notes`}
          value={persona.notes}
          maxLength={4000}
          rows={3}
          placeholder={t("notes_placeholder")}
          onCommit={(notes) => save(persona.id, { notes })}
        />
      </FormField>
    </div>
  )
}

/** A stack of list fields; every add, edit, reorder or removal saves immediately. */
export function PersonaListFields({ persona, fields }: { persona: AudiencePersona; fields: ListFieldSpec[] }) {
  const id = useId()
  const t = useT(personaMessages)
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {fields.map((field) => {
        const value = persona[field.key]
        return (
          <FormField
            key={field.key}
            htmlFor={`${id}-${field.key}`}
            description={field.description?.(persona, t)}
            label={
              <>
                {t(field.label)}
                {value.length ? <span className="ml-1.5 font-normal text-muted-foreground num">{value.length}</span> : null}
              </>
            }
          >
            <ListEditor
              id={`${id}-${field.key}`}
              variant={field.variant}
              value={value}
              maxItems={40}
              placeholder={t(field.placeholder)}
              aria-label={t(field.label)}
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
  const t = useT(personaMessages)
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <FormField label={t("platforms")} description={t("platforms_description")}>
        <PlatformToggleGroup
          value={persona.platforms}
          onChange={(platforms) => save(persona.id, { platforms })}
          aria-label={t("platforms_aria")}
        />
      </FormField>
      <PersonaListFields persona={persona} fields={MEDIA_AND_VOICE} />
    </div>
  )
}
