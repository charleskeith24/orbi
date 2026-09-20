"use client"

import { CopyButton, InfoHint } from "@/components/common"
import { Textarea } from "@/components/ui/textarea"
import { positioningStatement } from "@/lib/ai"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { cn } from "@/lib/utils"
import { BrandSection, LimitHint, type BrandSectionProps } from "./brand-fields"
import { brandFieldMessages } from "./brand-messages"
import { CONTEXT_LIMITS, fieldId, type BrandTextField } from "./brand-model"

type PartField = Extract<BrandTextField, "positioning_audience" | "positioning_result" | "positioning_method">

// The connectors are part of the statement itself ("I help … to … through …"), so they stay English.
const ROWS: { field: PartField; connector: string; key: "audience" | "result" | "method" }[] = [
  { field: "positioning_audience", connector: "I help", key: "audience" },
  { field: "positioning_result", connector: "to", key: "result" },
  { field: "positioning_method", connector: "through", key: "method" },
]

function Part({ value, placeholder }: { value: string; placeholder: string }) {
  if (!value) return <span className="text-muted-foreground italic">{placeholder}</span>
  return <mark className="rounded-sm bg-brand-soft px-0.5 text-foreground [box-decoration-break:clone]">{value}</mark>
}

/** Positioning Statement builder: "I help [AUDIENCE] achieve [DESIRED RESULT] through [METHOD / EXPERTISE]." */
export function StatementSection({ values, set }: BrandSectionProps) {
  const audience = values.positioning_audience.trim()
  const result = values.positioning_result.trim().replace(/^to\s+/i, "")
  const method = values.positioning_method.trim()
  const statement = positioningStatement(values.positioning_audience, values.positioning_result, values.positioning_method)
  const t = useT(brandFieldMessages)
  const c = useT(commonMessages)

  return (
    <BrandSection sectionKey="statement">
      <div className="flex flex-col gap-3">
        {ROWS.map((row) => {
          const id = fieldId(row.field)
          const value = values[row.field]
          const limit = CONTEXT_LIMITS[row.field]
          return (
            <div key={row.field} className="grid min-w-0 gap-1.5 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-x-3">
              <div className="flex items-center gap-1 sm:items-start sm:pt-1.5">
                <label htmlFor={id} className="flex items-baseline gap-2 sm:flex-col sm:items-start sm:gap-0.5">
                  <span className="text-sm font-medium">{row.connector}</span>
                  <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t(`${row.key}_label`)}</span>
                </label>
                <InfoHint title={t(`${row.key}_label`)}>{t(`${row.key}_hint`)}</InfoHint>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <Textarea
                  id={id}
                  rows={1}
                  value={value}
                  placeholder={t(`${row.key}_placeholder`)}
                  className="min-h-9 leading-relaxed"
                  onChange={(event) => set(row.field, event.target.value)}
                />
                {limit ? (
                  <div className="flex justify-end">
                    <LimitHint length={value.trim().length} limit={limit} />
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      <figure className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4 dark:bg-input/20">
        <figcaption className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{t("live_preview")}</span>
          <CopyButton text={statement} label={c("copy")} variant="outline" successMessage={t("statement_copied")} />
        </figcaption>
        <blockquote className={cn("text-base leading-relaxed text-pretty", !statement && "text-foreground/80")}>
          I help <Part value={audience} placeholder={t("part_audience")} /> <Part value={result} placeholder={t("part_result")} /> through{" "}
          <Part value={method} placeholder={t("part_method")} />.
        </blockquote>
        {!statement ? (
          <p className="text-xs text-muted-foreground">{t("statement_incomplete")}</p>
        ) : !method ? (
          <p className="text-xs text-muted-foreground">{t("statement_no_method")}</p>
        ) : null}
      </figure>
    </BrandSection>
  )
}
