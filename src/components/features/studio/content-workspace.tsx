"use client"

import { ArrowLeft, ChartNoAxesColumn, FileQuestion, FileText, Gauge, GitBranch, PenLine, Repeat2, SquareKanban } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"
import { toast } from "sonner"
import { EmptyState, PageContainer } from "@/components/common"
import { ContentTree } from "@/components/features/repurpose/content-tree"
import { RepurposePanel } from "@/components/features/repurpose/repurpose-panel"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PUBLISHED_STAGES } from "@/lib/constants"
import { useRow } from "@/lib/store"
import type { ContentItem, ID } from "@/lib/types"
import { BriefTab } from "./brief-tab"
import { PerformanceTab } from "./performance-tab"
import { ScoreTab } from "./score-tab"
import { ScriptTab } from "./script-tab"
import { studioActions, useDraftFormatsKey } from "./studio-store"
import { defaultTabForStage, parseTab, type WorkspaceTab } from "./studio-utils"
import { useNow } from "./use-now"
import { WorkspaceHeader } from "./workspace-header"
import { WorkspaceRail } from "./workspace-rail"
import { SaveShortcutProvider } from "./workspace-save"

const TABS: { value: WorkspaceTab; label: string; icon: typeof GitBranch }[] = [
  { value: "brief", label: "Brief", icon: FileText },
  { value: "script", label: "Script", icon: PenLine },
  { value: "score", label: "Score", icon: Gauge },
  { value: "repurpose", label: "Repurpose", icon: Repeat2 },
  { value: "tree", label: "Tree", icon: GitBranch },
  { value: "performance", label: "Performance", icon: ChartNoAxesColumn },
]

/** Shallow URL update — Next keeps `useSearchParams` in sync with the History API. */
function setTabParam(tab: WorkspaceTab) {
  const params = new URLSearchParams(window.location.search)
  params.set("tab", tab)
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`)
}

/** `/studio/<id>` — resolves the item; unknown ids get a proper empty state. */
export function ContentWorkspace({ itemId }: { itemId: string }) {
  const item = useRow("content_items", itemId)
  const [leaving, setLeaving] = useState(false)
  if (!item) return leaving ? null : <WorkspaceNotFound />
  return <Workspace key={item.id} item={item} onDeleting={() => setLeaving(true)} />
}

function WorkspaceNotFound() {
  return (
    <PageContainer>
      <EmptyState
        icon={FileQuestion}
        title="Content not found"
        description="This piece may have been deleted, or the link is out of date. Everything in production is in the Content Studio and on the Pipeline."
        action={
          <Button size="sm" asChild>
            <Link href="/studio">
              <ArrowLeft aria-hidden />
              Back to Content Studio
            </Link>
          </Button>
        }
        secondaryAction={
          <Button size="sm" variant="outline" asChild>
            <Link href="/pipeline">
              <SquareKanban aria-hidden />
              Open Pipeline
            </Link>
          </Button>
        }
      />
    </PageContainer>
  )
}

/**
 * The content workspace: header (title, properties, next action), six tabs synced to `?tab=` and a
 * context rail. ⌘/Ctrl+S saves the active tab.
 */
function Workspace({ item, onDeleting }: { item: ContentItem; onDeleting: () => void }) {
  const now = useNow()
  const searchParams = useSearchParams()
  const live = PUBLISHED_STAGES.includes(item.stage)
  const [fallbackTab] = useState<WorkspaceTab>(() => defaultTabForStage(item.stage))
  const tab = parseTab(searchParams.get("tab")) ?? fallbackTab
  const draftFormats = useDraftFormatsKey(item.id)
  const score = item.quality_score?.total ?? null

  // Tabs mount on first visit and then stay mounted, so drafts and AI results survive switching.
  const [visited, setVisited] = useState<ReadonlySet<WorkspaceTab>>(() => new Set([tab]))
  if (!visited.has(tab)) setVisited(new Set([...visited, tab]))
  const mounted = (value: WorkspaceTab) => visited.has(value) || undefined

  const handlers = useRef(new Map<string, () => void>())
  const register = useCallback((key: string, handler: (() => void) | null) => {
    if (handler) handlers.current.set(key, handler)
    else handlers.current.delete(key)
  }, [])

  const saveActiveTab = useEffectEvent(() => {
    const handler = handlers.current.get(tab)
    if (handler) handler()
    else toast.success("Everything is saved", { description: "Changes on this tab save automatically." })
  })
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== "s") return
      event.preventDefault()
      saveActiveTab()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const pickStory = useCallback(
    (storyId: ID) => {
      studioActions.setStory(item.id, storyId)
      setTabParam("script")
      toast.success("Story selected for the script", { description: "Generate with AI to weave it in as proof." })
    },
    [item.id]
  )

  return (
    <SaveShortcutProvider value={register}>
      <PageContainer className="gap-5">
        <WorkspaceHeader item={item} now={now} onDeleting={onDeleting} />
        <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18.5rem]">
          <Tabs
            value={tab}
            onValueChange={(value) => {
              const next = parseTab(value)
              if (next) setTabParam(next)
            }}
            className="min-w-0 gap-5"
          >
            <div className="-mx-4 overflow-x-auto px-4 shadow-[inset_0_-1px_0_var(--border)] scrollbar-thin md:mx-0 md:px-0">
              <TabsList variant="line" aria-label="Workspace sections" className="h-10 gap-5 p-0">
                {TABS.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger key={value} value={value} className="flex-none px-0.5 group-data-horizontal/tabs:after:bottom-0">
                    <Icon aria-hidden />
                    {label}
                    {value === "script" && draftFormats ? (
                      <>
                        <span aria-hidden className="size-1.5 rounded-full bg-warning" />
                        <span className="sr-only">(unsaved changes)</span>
                      </>
                    ) : null}
                    {value === "score" && score !== null ? <span className="text-xs font-normal text-muted-foreground num">{score}</span> : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <TabsContent value="brief" forceMount={mounted("brief")} className="min-w-0 data-[state=inactive]:hidden">
              <BriefTab item={item} />
            </TabsContent>
            <TabsContent value="script" forceMount={mounted("script")} className="min-w-0 data-[state=inactive]:hidden">
              <ScriptTab item={item} />
            </TabsContent>
            <TabsContent value="score" forceMount={mounted("score")} className="min-w-0 data-[state=inactive]:hidden">
              <ScoreTab item={item} onOpenScript={() => setTabParam("script")} />
            </TabsContent>
            <TabsContent value="repurpose" forceMount={mounted("repurpose")} className="min-w-0 data-[state=inactive]:hidden">
              <RepurposePanel itemId={item.id} />
            </TabsContent>
            <TabsContent value="tree" forceMount={mounted("tree")} className="min-w-0 data-[state=inactive]:hidden">
              <ContentTree itemId={item.id} />
            </TabsContent>
            <TabsContent value="performance" forceMount={mounted("performance")} className="min-w-0 data-[state=inactive]:hidden">
              <PerformanceTab item={item} now={now} live={live} />
            </TabsContent>
          </Tabs>
          <WorkspaceRail item={item} now={now} onUseStory={pickStory} />
        </div>
      </PageContainer>
    </SaveShortcutProvider>
  )
}
