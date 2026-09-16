"use client"

import { CircleCheck, Lightbulb, Share2, Smartphone } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { EmptyState, PageContainer, PageHeader, type IconComponent } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { uiActions, useTable, useUIStore } from "@/lib/store"
import { m } from "./messages"
import { resolveShareIntent } from "./share-intent"

/**
 * /share — the Android share target and the home-screen shortcuts (see manifest.ts).
 * Shared text opens Quick Capture prefilled and stays here to confirm the save; the shortcuts open
 * their dialog over the Idea Bank / Content Studio. Without params it explains how sharing works.
 */
export function ShareView() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const t = useT(m)
  const intent = useMemo(() => resolveShareIntent(searchParams), [searchParams])
  const handled = useRef(false)
  const ideas = useTable("content_ideas")
  const [ideaIdsAtOpen] = useState(() => new Set(ideas.map((idea) => idea.id)))
  const captureOpen = useUIStore((s) => s.dialog?.type === "quick-capture")

  useEffect(() => {
    if (handled.current) return
    handled.current = true
    if (intent.kind === "new-content") {
      uiActions.openDialog({ type: "new-content" })
      router.replace("/studio")
    } else if (intent.kind === "capture" && !intent.shared) {
      uiActions.openDialog({ type: "quick-capture" })
      router.replace("/ideas")
    } else if (intent.kind === "capture") {
      uiActions.openDialog({ type: "quick-capture", initialText: intent.text })
    }
  }, [intent, router])

  const savedIdea = useMemo(
    () => ideas.filter((idea) => idea.source === "quick_capture" && !ideaIdsAtOpen.has(idea.id)).at(-1) ?? null,
    [ideas, ideaIdsAtOpen]
  )

  // Shortcuts hand over to another page right away.
  if (intent.kind === "new-content" || (intent.kind === "capture" && !intent.shared)) return null

  if (intent.kind === "none") {
    return (
      <PageContainer width="narrow">
        <PageHeader icon={Share2} title={t("share_title")} />
        <EmptyState
          icon={Share2}
          title={t("empty_title")}
          description={t("empty_description")}
          action={
            <Button size="sm" onClick={() => uiActions.openDialog({ type: "quick-capture" })}>
              <Lightbulb aria-hidden /> {t("open_capture")}
            </Button>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <PlatformNote icon={Smartphone} title={t("android_note_title")} body={t("android_note")} />
          <PlatformNote icon={Smartphone} title={t("iphone_note_title")} body={t("iphone_note")} />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer width="narrow">
      <PageHeader icon={Share2} title={t("share_title")} description={t("share_description")} />
      <section className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4" aria-labelledby="shared-label">
        <h2 id="shared-label" className="text-xs font-medium text-muted-foreground">
          {t("shared_label")}
        </h2>
        <p className="line-clamp-6 text-sm break-words whitespace-pre-line">{intent.text}</p>
        {savedIdea ? (
          <p className="flex min-w-0 items-center gap-2 text-sm" role="status">
            <CircleCheck className="size-4 shrink-0 text-good-fg" aria-hidden />
            <span className="shrink-0 font-medium">{t("saved_title")}</span>
            <span className="truncate text-muted-foreground">{savedIdea.title}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {savedIdea ? (
            <>
              <Button asChild size="sm">
                <Link href={`/ideas?open=${savedIdea.id}`}>{t("open_idea")}</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/today">{t("go_today")}</Link>
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                disabled={captureOpen}
                onClick={() => uiActions.openDialog({ type: "quick-capture", initialText: intent.text })}
              >
                <Lightbulb aria-hidden /> {t("open_capture")}
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/ideas">{t("go_ideas")}</Link>
              </Button>
            </>
          )}
        </div>
      </section>
    </PageContainer>
  )
}

function PlatformNote({ icon: Icon, title, body }: { icon: IconComponent; title: string; body: string }) {
  return (
    <div className="flex min-w-0 gap-3 rounded-lg border bg-card p-4">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}
