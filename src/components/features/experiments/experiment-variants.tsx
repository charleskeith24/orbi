"use client"

import { ChartColumn, Link2, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { PageSection, PlatformIcon } from "@/components/common"
import { Button } from "@/components/ui/button"
import { publishedAtOf, type ExperimentResults, type VariantResult } from "@/lib/analytics"
import { formatDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { dataActions, uiActions } from "@/lib/store"
import type { ContentExperiment, ExperimentMetric, ID } from "@/lib/types"
import { truncate } from "@/lib/utils"
import { experimentSheetMessages } from "./detail-messages"
import { ExperimentItemPicker } from "./experiment-item-picker"
import { formatMetricValue, variantIds, variantPatch, type Variant } from "./experiment-model"
import { VariantMark } from "./experiment-status"
import { experimentsMessages } from "./messages"

function VariantPosts({
  variant,
  name,
  result,
  metric,
  onLink,
  onRemove,
}: {
  variant: Variant
  name: string
  result: VariantResult
  metric: ExperimentMetric
  onLink: () => void
  onRemove: (id: ID, title: string) => void
}) {
  const t = useT(experimentSheetMessages)
  const tx = useT(experimentsMessages)
  const letter = variant.toUpperCase()
  return (
    <div className="flex min-w-0 flex-col rounded-lg border">
      <div className="flex min-w-0 items-center gap-2 border-b px-3 py-2">
        <VariantMark variant={variant} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{name || tx("variant", { letter })}</span>
        <span className="hidden shrink-0 text-xs text-muted-foreground num sm:inline">
          {result.items.length ? t("measured_of", { n: result.n, total: result.items.length }) : t("no_posts")}
        </span>
        <Button type="button" variant="outline" size="xs" onClick={onLink} aria-label={t("link_to_variant", { letter })}>
          <Link2 aria-hidden />
          {t("link_posts")}
        </Button>
      </div>
      {result.items.length ? (
        <ul className="divide-y">
          {result.items.map(({ item, value }) => {
            const date = publishedAtOf(item)
            return (
              <li key={item.id} className="flex min-w-0 items-center gap-2.5 py-1.5 pr-1.5 pl-3">
                <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/studio/${item.id}`}
                    className="block truncate text-sm outline-none hover:underline focus-visible:underline"
                    title={item.title}
                  >
                    {item.title || t("untitled_content")}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{date ? formatDate(date, "MMM d, yyyy") : t("no_date")}</p>
                </div>
                {value === null ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="shrink-0 text-muted-foreground"
                    onClick={() => uiActions.openDialog({ type: "add-metrics", itemId: item.id })}
                  >
                    <ChartColumn aria-hidden />
                    {t("add_analytics")}
                  </Button>
                ) : (
                  <span className="shrink-0 text-sm font-medium num">{formatMetricValue(metric, value)}</span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-muted-foreground"
                  aria-label={t("remove_from_variant", { title: truncate(item.title || t("untitled_content"), 40), letter })}
                  onClick={() => onRemove(item.id, item.title)}
                >
                  <X aria-hidden />
                </Button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="px-3 py-4 text-center text-xs text-pretty text-muted-foreground">
          {t("no_linked")}
        </p>
      )}
    </div>
  )
}

/** Published posts linked to variant A and B, with add/remove and quick analytics logging. */
export function ExperimentVariants({ experiment, results }: { experiment: ContentExperiment; results: ExperimentResults }) {
  const t = useT(experimentSheetMessages)
  const [picker, setPicker] = useState<Variant | null>(null)
  const [pickerVariant, setPickerVariant] = useState<Variant>("a")

  function openPicker(variant: Variant) {
    setPickerVariant(variant)
    setPicker(variant)
  }

  function unlink(variant: Variant, id: ID, title: string) {
    const before = variantIds(experiment, variant)
    dataActions.update("content_experiments", experiment.id, variantPatch(variant, before.filter((x) => x !== id)))
    toast.success(t("removed", { letter: variant.toUpperCase() }), {
      description: truncate(title || t("untitled_content"), 80),
      action: { label: t("undo"), onClick: () => dataActions.update("content_experiments", experiment.id, variantPatch(variant, before)) },
    })
  }

  return (
    <PageSection
      id="experiment-posts"
      title={t("linked_posts")}
      info={t("linked_info")}
    >
      <div className="flex flex-col gap-3">
        <VariantPosts
          variant="a"
          name={experiment.variant_a}
          result={results.a}
          metric={experiment.metric}
          onLink={() => openPicker("a")}
          onRemove={(id, title) => unlink("a", id, title)}
        />
        <VariantPosts
          variant="b"
          name={experiment.variant_b}
          result={results.b}
          metric={experiment.metric}
          onLink={() => openPicker("b")}
          onRemove={(id, title) => unlink("b", id, title)}
        />
      </div>
      <ExperimentItemPicker
        open={picker !== null}
        onOpenChange={(open) => {
          if (!open) setPicker(null)
        }}
        experiment={experiment}
        variant={pickerVariant}
      />
    </PageSection>
  )
}
