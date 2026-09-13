"use client"

import { Lightbulb, Repeat2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { DetailSheet, PageSection, PlatformIcon, StageBadge, StatusPill, TierBadge } from "@/components/common"
import { RepurposePanel } from "@/components/features/repurpose/repurpose-panel"
import { Button } from "@/components/ui/button"
import { computeTiers, isPublishedItem } from "@/lib/analytics"
import { PLATFORMS, REPURPOSE_TYPES } from "@/lib/constants"
import { useDb, useSettings } from "@/lib/store"
import type { ContentItem } from "@/lib/types"
import { pluralize } from "@/lib/utils"

/** Repurposed versions that already exist (and open suggestions), plus the Repurposing Engine in a sheet. */
export function WinnerRepurpose({ item, now }: { item: ContentItem; now: Date }) {
  const db = useDb()
  const settings = useSettings()
  const [open, setOpen] = useState(false)

  const { children, suggestions, tiers } = useMemo(() => {
    const children = db.content_items
      .filter((i) => i.parent_id === item.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    const suggestions = db.content_repurposing.filter(
      (r) => r.source_item_id === item.id && !r.target_item_id && (r.status === "suggested" || r.status === "drafted")
    )
    const tiers = children.some(isPublishedItem) ? computeTiers(db, settings, now) : null
    return { children, suggestions, tiers }
  }, [db, settings, now, item.id])

  const summary = children.length
    ? `${pluralize(children.length, "version")} created${suggestions.length ? ` · ${suggestions.length} suggested` : ""}`
    : suggestions.length
      ? `${pluralize(suggestions.length, "suggestion")} waiting — nothing created yet.`
      : "Not repurposed yet — winners are the safest pieces to turn into carousels, threads and follow-ups."

  return (
    <PageSection
      id="winner-repurpose"
      title="Repurposed versions"
      description={summary}
      action={
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          <Repeat2 aria-hidden />
          Repurpose
        </Button>
      }
    >
      {children.length || suggestions.length ? (
        <ul className="divide-y rounded-lg border" aria-label="Repurposed versions">
          {children.map((child) => (
            <li key={child.id} className="flex min-w-0 items-center gap-3 px-3 py-2">
              <PlatformIcon platform={child.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/studio/${child.id}`}
                  className="block truncate text-sm outline-none hover:underline focus-visible:underline"
                  title={child.title}
                >
                  {child.title || "Untitled content"}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {child.repurpose_type ? REPURPOSE_TYPES[child.repurpose_type].label : "Repurposed version"} ·{" "}
                  {PLATFORMS[child.platform].label}
                </p>
              </div>
              {isPublishedItem(child) ? <TierBadge tier={tiers?.get(child.id)?.tier} /> : null}
              <StageBadge stage={child.stage} className="hidden sm:inline-flex" />
            </li>
          ))}
          {suggestions.map((suggestion) => (
            <li key={suggestion.id} className="flex min-w-0 items-center gap-3 px-3 py-2">
              <span className="size-3.5 shrink-0 rounded-sm border border-dashed border-muted-foreground/60" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-muted-foreground">
                  {suggestion.title || REPURPOSE_TYPES[suggestion.type].label}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {REPURPOSE_TYPES[suggestion.type].label}
                  {suggestion.platform ? ` · ${PLATFORMS[suggestion.platform].label}` : ""}
                </p>
              </div>
              <StatusPill icon={Lightbulb}>{suggestion.status === "drafted" ? "Drafted" : "Suggested"}</StatusPill>
            </li>
          ))}
        </ul>
      ) : null}

      <DetailSheet
        open={open}
        onOpenChange={setOpen}
        title="Repurpose this winner"
        description={item.title || "Untitled content"}
        width="xl"
      >
        <RepurposePanel itemId={item.id} />
      </DetailSheet>
    </PageSection>
  )
}
