"use client"

import { OptionSelect, type ControlSize, type SelectOption } from "@/components/common"
import { PROBLEM_CATEGORIES } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import type { ProblemCategory } from "@/lib/types"
import { problemMessages } from "./problem-messages"

const OPTIONS: SelectOption<ProblemCategory>[] = PROBLEM_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))

/** One of the 8 Problem Bank categories (never empty). */
export function ProblemCategorySelect({
  value,
  onChange,
  id,
  size,
}: {
  value: ProblemCategory
  onChange: (value: ProblemCategory) => void
  id?: string
  size?: ControlSize
}) {
  const t = useT(problemMessages)
  return (
    <OptionSelect
      id={id}
      size={size}
      options={OPTIONS}
      value={value}
      placeholder={t("category")}
      onChange={(next) => {
        if (next) onChange(next)
      }}
    />
  )
}
