"use client"

import { useRouter } from "next/navigation"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PLATFORMS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { useTable } from "@/lib/store"
import type { ContentItem, ID, InsertRow } from "@/lib/types"
import { truncate } from "@/lib/utils"
import { CaptureDialog, CaptureHeader } from "./capture-dialog"
import { newContentMessages } from "./capture-messages"
import { FromIdeaForm } from "./new-content-from-idea"
import { FromScratchForm } from "./new-content-from-scratch"
import type { ContentDefaults } from "./new-content-shared"

type Tab = "idea" | "scratch"

/**
 * New content: from an idea in the Idea Bank (converted into one item per platform) or from scratch.
 * `ideaId` preselects an idea; `defaults` prefill the from-scratch form and carry through to every item.
 */
export function NewContentDialog({
  open,
  onOpenChange,
  ideaId,
  defaults,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ideaId?: ID
  defaults?: InsertRow<"content_items">
}) {
  return (
    <CaptureDialog open={open} onOpenChange={onOpenChange} size="lg">
      <NewContentForm key={ideaId ?? "new"} ideaId={ideaId} defaults={defaults} onClose={() => onOpenChange(false)} />
    </CaptureDialog>
  )
}

function NewContentForm({ ideaId, defaults, onClose }: { ideaId?: ID; defaults?: ContentDefaults; onClose: () => void }) {
  const router = useRouter()
  const t = useT(newContentMessages)
  const ideas = useTable("content_ideas")
  const choosable = useMemo(() => ideas.filter((idea) => idea.status !== "archived"), [ideas])
  const [tab, setTab] = useState<Tab>(() =>
    ideaId ? "idea" : defaults ? "scratch" : choosable.some((idea) => idea.status !== "converted") ? "idea" : "scratch"
  )
  const [initialTab] = useState(tab)
  const panels = useRef<Record<Tab, HTMLDivElement | null>>({ idea: null, scratch: null })

  function switchTab(next: string) {
    const value: Tab = next === "scratch" ? "scratch" : "idea"
    setTab(value)
    requestAnimationFrame(() => panels.current[value]?.querySelector<HTMLElement>("input:not([type=hidden])")?.focus())
  }

  function created(items: ContentItem[], title: string) {
    if (!items.length) return
    const platforms = items.map((item) => PLATFORMS[item.platform]?.label ?? item.platform).join(", ")
    toast.success(items.length > 1 ? t("created_many", { count: items.length }) : t("created_single"), {
      description: `${truncate(title, 60)} · ${platforms}`,
    })
    onClose()
    router.push(`/studio/${items[0].id}`)
  }

  return (
    <Tabs value={tab} onValueChange={switchTab} className="flex min-h-0 flex-1 flex-col gap-0">
      <CaptureHeader
        title={t("title")}
        description={t("description")}
      >
        <TabsList className="mt-2 w-full sm:w-fit">
          <TabsTrigger value="idea">{t("tab_idea")}</TabsTrigger>
          <TabsTrigger value="scratch">{t("tab_scratch")}</TabsTrigger>
        </TabsList>
      </CaptureHeader>
      <TabsContent
        value="idea"
        forceMount
        ref={(el) => {
          panels.current.idea = el
        }}
        className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
      >
        <FromIdeaForm
          initialIdeaId={ideaId}
          defaults={defaults}
          ideas={choosable}
          onCancel={onClose}
          onCreated={created}
          onScratch={() => switchTab("scratch")}
        />
      </TabsContent>
      <TabsContent
        value="scratch"
        forceMount
        ref={(el) => {
          panels.current.scratch = el
        }}
        className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
      >
        <FromScratchForm defaults={defaults} autoFocus={initialTab === "scratch"} onCancel={onClose} onCreated={created} />
      </TabsContent>
    </Tabs>
  )
}
