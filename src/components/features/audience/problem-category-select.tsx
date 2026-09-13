"use client"

import { OptionSelect, type SelectOption } from "@/components/common"
import type { ControlSize } from "@/components/common"
import { PROBLEM_CATEGORIES } from "@/lib/constants"
import type { ProblemCategory } from "@/lib/types"

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
  return (
    <OptionSelect
      id={id}
      size={size}
      options={OPTIONS}
      value={value}
      placeholder="Category"
      onChange={(next) => {
        if (next) onChange(next)
      }}
    />
  )
}
