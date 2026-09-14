"use client"

import { ChartColumn, Link2, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { PageSection, PlatformIcon } from "@/components/common"
import { Button } from "@/components/ui/button"
import { publishedAtOf, type ExperimentResults, type VariantResult } from "@/lib/analytics"
import { formatDate } from "@/lib/dates"
import { dataActions, uiActions } from "@/lib/store"
import type { ContentExperiment, ExperimentMetric, ID } from "@/lib/types"
import { truncate } from "@/lib/utils"
import { ExperimentItemPicker } from "./experiment-item-picker"
import { formatMetricValue, variantIds, variantPatch, type Variant } from "./experiment-model"
import { VariantMark } from "./experiment-status"

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
  const letter = variant.toUpperCase()
  return (
    <div className="flex min-w-0 flex-col rounded-lg border">
      <div className="flex min-w-0 items-center gap-2 border-b px-3 py-2">
        <VariantMark variant={variant} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{name || `Variant ${letter}`}</span>
        <span className="hidden shrink-0 text-xs text-muted-foreground num sm:inline">
          {result.items.length ? `${result.n} of ${result.items.length} measured` : "No posts"}
        </span>
        <Button type="button" variant="outline" size="xs" onClick={onLink} aria-label={`Link posts to variant ${letter}`}>
          <Link2 aria-hidden />
          Link posts
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
                    {item.title || "Untitled content"}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{date ? formatDate(date, "MMM d, yyyy") : "No date"}</p>
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
                    Add analytics
                  </Button>
                ) : (
                  <span className="shrink-0 text-sm font-medium num">{formatMetricValue(metric, value)}</span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-muted-foreground"
                  aria-label={`Remove “${truncate(item.title || "Untitled content", 40)}” from variant ${letter}`}
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
          No posts linked yet. Link the published posts that used this variant.
        </p>
      )}
    </div>
  )
}

/** Published posts linked to variant A and B, with add/remove and quick analytics logging. */
export function ExperimentVariants({ experiment, results }: { experiment: ContentExperiment; results: ExperimentResults }) {
  const [picker, setPicker] = useState<Variant | null>(null)
  const [pickerVariant, setPickerVariant] = useState<Variant>("a")

  function openPicker(variant: Variant) {
    setPickerVariant(variant)
    setPicker(variant)
  }

  function unlink(variant: Variant, id: ID, title: string) {
    const before = variantIds(experiment, variant)
    dataActions.update("content_experiments", experiment.id, variantPatch(variant, before.filter((x) => x !== id)))
    toast.success(`Removed from variant ${variant.toUpperCase()}`, {
      description: truncate(title || "Untitled content", 80),
      action: { label: "Undo", onClick: () => dataActions.update("content_experiments", experiment.id, variantPatch(variant, before)) },
    })
  }

  return (
    <PageSection
      id="experiment-posts"
      title="Linked posts"
      description="Posts that tested each variant. Only posts with analytics count toward the result."
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
