"use client"

import Link from "next/link"
import { FormField, FormRow, NumberField, PlatformToggleGroup } from "@/components/common"
import { BrandSection, BrandTextField, type BrandSectionProps } from "./brand-fields"
import { fieldId } from "./brand-model"

/** Identity: who you are, what you do and where you publish. */
export function IdentitySection({ values, set, errors }: BrandSectionProps) {
  return (
    <BrandSection sectionKey="identity">
      <FormRow>
        <BrandTextField
          field="name"
          label="Your name"
          required
          autoComplete="name"
          value={values.name}
          error={errors.name}
          placeholder="e.g. Rafael “Raf” Mendoza"
          onChange={(value) => set("name", value)}
        />
        <BrandTextField
          field="brand_name"
          label="Brand name"
          value={values.brand_name}
          placeholder="e.g. Northbound Commerce"
          onChange={(value) => set("brand_name", value)}
        />
      </FormRow>
      <FormRow>
        <BrandTextField
          field="role"
          label="Role / profession"
          wrap
          value={values.role}
          placeholder="e.g. Founder & CEO"
          onChange={(value) => set("role", value)}
        />
        <BrandTextField
          field="industry"
          label="Industry"
          wrap
          value={values.industry}
          placeholder="e.g. E-commerce growth & performance advertising"
          onChange={(value) => set("industry", value)}
        />
      </FormRow>
      <BrandTextField
        field="expertise_summary"
        label="Expertise summary"
        multiline
        value={values.expertise_summary}
        placeholder="What you've done, for whom and at what scale."
        description="Two or three sentences the AI uses to introduce you and back up your claims."
        onChange={(value) => set("expertise_summary", value)}
      />
      <FormRow>
        <FormField label="Years of experience" htmlFor={fieldId("years_experience")} error={errors.years_experience}>
          <NumberField
            id={fieldId("years_experience")}
            value={values.years_experience}
            min={0}
            max={80}
            suffix="years"
            placeholder="e.g. 11"
            aria-invalid={Boolean(errors.years_experience) || undefined}
            onChange={(value) => set("years_experience", value)}
          />
        </FormField>
        <BrandTextField
          field="location"
          label="Location"
          wrap
          autoComplete="address-level2"
          value={values.location}
          placeholder="e.g. Pasig City, Metro Manila"
          onChange={(value) => set("location", value)}
        />
      </FormRow>
      <FormField
        label="Main platforms"
        description={
          <>
            Where you publish. Posting frequency and goals per platform live in{" "}
            <Link href="/strategy/platforms" className="font-medium text-foreground underline-offset-2 hover:underline">
              Platforms
            </Link>
            .
          </>
        }
      >
        <div id={fieldId("main_platforms")}>
          <PlatformToggleGroup
            value={values.main_platforms}
            onChange={(value) => set("main_platforms", value)}
            aria-label="Main platforms"
          />
        </div>
      </FormField>
    </BrandSection>
  )
}

/** Brand Positioning: the five questions the AI leans on. `suggestions` renders above the fields. */
export function PositioningSection({
  values,
  set,
  action,
  suggestions,
}: BrandSectionProps & { action?: React.ReactNode; suggestions?: React.ReactNode }) {
  return (
    <BrandSection sectionKey="positioning" action={action}>
      {suggestions}
      <BrandTextField
        field="who_am_i"
        label="Who am I?"
        multiline
        value={values.who_am_i}
        placeholder="I'm … I started … Today I …"
        description="Your story in a few sentences, in first person — the AI writes as this person."
        onChange={(value) => set("who_am_i", value)}
      />
      <BrandTextField
        field="known_for"
        label="What do I want to be known for?"
        multiline
        value={values.known_for}
        placeholder="The one or two things people should think of when they hear your name."
        onChange={(value) => set("known_for", value)}
      />
      <BrandTextField
        field="problems_solved"
        label="What problems do I help solve?"
        multiline
        value={values.problems_solved}
        placeholder="The situations your audience is stuck in."
        onChange={(value) => set("problems_solved", value)}
      />
      <BrandTextField
        field="why_listen"
        label="Why should people listen to me?"
        multiline
        value={values.why_listen}
        placeholder="Proof: results, years, numbers, lived experience."
        onChange={(value) => set("why_listen", value)}
      />
      <BrandTextField
        field="point_of_view"
        label="What makes my point of view different?"
        multiline
        value={values.point_of_view}
        placeholder="Opinionated beliefs you can defend from experience — one per sentence."
        onChange={(value) => set("point_of_view", value)}
      />
    </BrandSection>
  )
}
