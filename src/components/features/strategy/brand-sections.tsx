"use client"

import Link from "next/link"
import { FormField, FormRow, NumberField, PlatformToggleGroup } from "@/components/common"
import { useT } from "@/lib/i18n"
import { BrandSection, BrandTextField, type BrandSectionProps } from "./brand-fields"
import { brandFieldMessages } from "./brand-messages"
import { fieldId } from "./brand-model"

/** Identity: who you are, what you do and where you publish. */
export function IdentitySection({ values, set, errors }: BrandSectionProps) {
  const t = useT(brandFieldMessages)
  return (
    <BrandSection sectionKey="identity">
      <FormRow>
        <BrandTextField
          field="name"
          label={t("name_label")}
          required
          autoComplete="name"
          value={values.name}
          error={errors.name}
          placeholder={t("name_placeholder")}
          onChange={(value) => set("name", value)}
        />
        <BrandTextField
          field="brand_name"
          label={t("brand_name_label")}
          value={values.brand_name}
          placeholder={t("brand_name_placeholder")}
          onChange={(value) => set("brand_name", value)}
        />
      </FormRow>
      <FormRow>
        <BrandTextField
          field="role"
          label={t("role_label")}
          wrap
          value={values.role}
          placeholder={t("role_placeholder")}
          onChange={(value) => set("role", value)}
        />
        <BrandTextField
          field="industry"
          label={t("industry_label")}
          wrap
          value={values.industry}
          placeholder={t("industry_placeholder")}
          onChange={(value) => set("industry", value)}
        />
      </FormRow>
      <BrandTextField
        field="expertise_summary"
        label={t("expertise_summary_label")}
        multiline
        value={values.expertise_summary}
        placeholder={t("expertise_summary_placeholder")}
        description={t("expertise_summary_description")}
        onChange={(value) => set("expertise_summary", value)}
      />
      <FormRow>
        <FormField label={t("years_label")} htmlFor={fieldId("years_experience")} error={errors.years_experience}>
          <NumberField
            id={fieldId("years_experience")}
            value={values.years_experience}
            min={0}
            max={80}
            suffix={t("years_suffix")}
            placeholder={t("years_placeholder")}
            aria-invalid={Boolean(errors.years_experience) || undefined}
            onChange={(value) => set("years_experience", value)}
          />
        </FormField>
        <BrandTextField
          field="location"
          label={t("location_label")}
          wrap
          autoComplete="address-level2"
          value={values.location}
          placeholder={t("location_placeholder")}
          onChange={(value) => set("location", value)}
        />
      </FormRow>
      <FormField
        label={t("platforms_label")}
        description={
          <>
            {t("platforms_hint_before")}
            <Link href="/strategy/platforms" className="font-medium text-foreground underline-offset-2 hover:underline">
              {t("platforms_hint_link")}
            </Link>
            {t("platforms_hint_after")}
          </>
        }
      >
        <div id={fieldId("main_platforms")}>
          <PlatformToggleGroup
            value={values.main_platforms}
            onChange={(value) => set("main_platforms", value)}
            aria-label={t("platforms_label")}
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
  const t = useT(brandFieldMessages)
  return (
    <BrandSection sectionKey="positioning" action={action}>
      {suggestions}
      <BrandTextField
        field="who_am_i"
        label={t("who_am_i_label")}
        multiline
        value={values.who_am_i}
        placeholder={t("who_am_i_placeholder")}
        description={t("who_am_i_description")}
        onChange={(value) => set("who_am_i", value)}
      />
      <BrandTextField
        field="known_for"
        label={t("known_for_label")}
        multiline
        value={values.known_for}
        placeholder={t("known_for_placeholder")}
        onChange={(value) => set("known_for", value)}
      />
      <BrandTextField
        field="problems_solved"
        label={t("problems_label")}
        multiline
        value={values.problems_solved}
        placeholder={t("problems_placeholder")}
        onChange={(value) => set("problems_solved", value)}
      />
      <BrandTextField
        field="why_listen"
        label={t("why_listen_label")}
        multiline
        value={values.why_listen}
        placeholder={t("why_listen_placeholder")}
        onChange={(value) => set("why_listen", value)}
      />
      <BrandTextField
        field="point_of_view"
        label={t("point_of_view_label")}
        multiline
        value={values.point_of_view}
        placeholder={t("point_of_view_placeholder")}
        onChange={(value) => set("point_of_view", value)}
      />
    </BrandSection>
  )
}
