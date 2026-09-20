"use client"

import { Trash2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef } from "react"
import { PageContainer, PageHeader, ProviderBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { buildAnalyticsSnapshot, useAiStatus } from "@/lib/ai"
import { useT, useUiLang } from "@/lib/i18n"
import { useDb, useSettings } from "@/lib/store"
import { useClearConversation } from "./clear-conversation"
import { Conversation } from "./conversation"
import { strategistKnowledge } from "./knowledge"
import { dataPrompts } from "./prompts"
import { strategistSession } from "./session"
import { strategistMessages } from "./strategist-messages"
import { KnowledgeCard, MobileKnowledge, QuickPromptsCard } from "./strategist-knowledge"
import { useNow } from "./use-now"
import { useViewportFill } from "./use-viewport-fill"

/** /strategist — the conversation full width, with what the strategist knows and quick prompts. `?q=` asks a question. */
export function StrategistView() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const query = searchParams.get("q")?.trim() ?? ""
  const handled = useRef<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const db = useDb()
  const settings = useSettings()
  const now = useNow()
  const ai = useAiStatus()
  const { clear, dialog, count } = useClearConversation()
  const lang = useUiLang()
  const t = useT(strategistMessages)
  useViewportFill(gridRef)

  const knowledge = useMemo(() => strategistKnowledge(db, now, settings, lang), [db, now, settings, lang])
  const extraPrompts = useMemo(() => dataPrompts(buildAnalyticsSnapshot(db, now), lang), [db, now, lang])

  useEffect(() => {
    if (!query || handled.current === query) return
    handled.current = query
    strategistSession.send(query)
    router.replace("/strategist", { scroll: false })
  }, [query, router])

  return (
    <PageContainer className="gap-4 md:gap-5">
      <PageHeader
        title="Content Strategist"
        info={t("page_info")}
        actions={
          <>
            {ai.loading ? null : <ProviderBadge provider={ai.provider} model={ai.model || undefined} />}
            <Button variant="outline" size="sm" disabled={!count} onClick={() => void clear()}>
              <Trash2 aria-hidden />
              {t("clear")}
            </Button>
          </>
        }
      />
      <MobileKnowledge data={knowledge} extra={extraPrompts} />
      <div ref={gridRef} className="grid min-w-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside
          aria-label={t("knows_label")}
          className="hidden min-h-0 flex-col gap-4 overflow-y-auto scrollbar-thin lg:flex [&>*]:shrink-0"
        >
          <KnowledgeCard data={knowledge} />
          <QuickPromptsCard extra={extraPrompts} />
        </aside>
        <section aria-label={t("conversation_label")} className="flex min-h-0 min-w-0 flex-col rounded-lg border bg-card">
          <Conversation variant="page" />
        </section>
      </div>
      {dialog}
    </PageContainer>
  )
}
