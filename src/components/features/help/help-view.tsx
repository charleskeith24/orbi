"use client"

import { ArrowRight, Lightbulb, Mail, MessageSquarePlus, SearchX } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Fragment, useEffect, useMemo, useState } from "react"
import { CONTACT_EMAIL } from "@/app/privacy/contact-email"
import { EmptyState, PageContainer, PageHeader, SearchInput, SectionHeader } from "@/components/common"
import { FeedbackDialog } from "@/components/features/feedback/feedback-dialog"
import { m as feedbackMessages } from "@/components/features/feedback/messages"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useT, useUiLang, type UiLang } from "@/lib/i18n"
import { ALL_PAGES } from "@/lib/navigation"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { HELP_GROUPS, HELP_TOPICS, helpPageTitle, helpText, searchHelp, type HelpTopic } from "./help-topics"
import { m } from "./messages"

/** Renders **bold** (button and menu names) inside a guide's sentence; everything else is plain text. */
function Inline({ text }: { text: string }) {
  return text.split("**").map((part, i) =>
    i % 2 ? (
      <strong key={i} className="font-medium text-foreground">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  )
}

const anchorId = (id: string) => `help-${id}`

/**
 * /help — the guides, grouped like the sidebar, each a closed row until it's opened (Calm UI: titles first,
 * the steps on request). `?open=<topic>` opens and scrolls to one (⌘K links there). Search matches both
 * languages, so a Taglish reader can type an English word.
 */
export function HelpView() {
  const t = useT(m)
  const fb = useT(feedbackMessages)
  const lang = useUiLang()
  const params = useSearchParams()
  const requested = params.get("open")
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState<string[]>(() => (requested && HELP_TOPICS.some((topic) => topic.id === requested) ? [requested] : []))
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  // A link to another topic while the page is open (⌘K from here): open it too, then bring it into view.
  const [seen, setSeen] = useState(requested)
  if (requested !== seen) {
    setSeen(requested)
    if (requested && HELP_TOPICS.some((topic) => topic.id === requested)) {
      setQuery("")
      setOpen((current) => (current.includes(requested) ? current : [...current, requested]))
    }
  }
  useEffect(() => {
    if (!requested) return
    const frame = requestAnimationFrame(() => document.getElementById(anchorId(requested))?.scrollIntoView({ block: "start" }))
    return () => cancelAnimationFrame(frame)
  }, [requested])

  const results = useMemo(() => searchHelp(query), [query])
  const matched = useMemo(() => new Set(results.map((topic) => topic.id)), [results])
  const searching = query.trim().length > 0
  // One match left: open it, so the answer shows without another click.
  const onlyMatch = searching && results.length === 1 ? results[0].id : null
  const value = onlyMatch && !open.includes(onlyMatch) ? [...open, onlyMatch] : open

  return (
    <PageContainer width="narrow">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={t("search_placeholder")}
          aria-label={t("search_label")}
          size="default"
          className="w-full sm:w-full"
        />
      </PageHeader>

      {searching && !results.length ? (
        <EmptyState
          icon={SearchX}
          title={t("no_results_title", { query: query.trim() })}
          description={t("no_results_description")}
          action={
            <Button variant="outline" size="sm" onClick={() => setQuery("")}>
              {t("clear_search")}
            </Button>
          }
        />
      ) : (
        <Accordion type="multiple" value={value} onValueChange={setOpen} className="flex flex-col gap-6">
          {HELP_GROUPS.map((group) => {
            const topics = HELP_TOPICS.filter((topic) => topic.group === group && matched.has(topic.id))
            if (!topics.length) return null
            return (
              <section key={group} aria-labelledby={`help-group-${group}`} className="flex flex-col gap-1">
                <SectionHeader id={`help-group-${group}`} title={t(`group_${group}`)} count={searching ? topics.length : undefined} />
                <div className="rounded-lg border bg-card px-4">
                  {topics.map((topic) => (
                    <TopicRow key={topic.id} topic={topic} lang={lang} />
                  ))}
                </div>
              </section>
            )
          })}
        </Accordion>
      )}

      <section aria-labelledby="help-stuck" className="flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="help-stuck" className="text-sm font-medium">
            {t("stuck_title")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("stuck_body")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setFeedbackOpen(true)}>
            <MessageSquarePlus aria-hidden /> {fb("menu_label")}
          </Button>
          {CONTACT_EMAIL ? (
            <Button size="sm" variant="outline" asChild>
              <a href={`mailto:${CONTACT_EMAIL}`}>
                <Mail aria-hidden /> {t("email_us", { email: CONTACT_EMAIL })}
              </a>
            </Button>
          ) : null}
        </div>
      </section>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </PageContainer>
  )

}

/** One guide: a closed row with its title; opened, the summary, numbered steps, tips and a link to the page. */
function TopicRow({ topic, lang }: { topic: HelpTopic; lang: UiLang }) {
  const t = useT(m)
  const text = helpText(topic, lang)
  const Icon = topic.icon
  const question = topic.group === "faq"
  const page = topic.href ? helpPageTitle(topic.href, ALL_PAGES) : null
  return (
    <AccordionItem value={topic.id} id={anchorId(topic.id)} className="scroll-mt-20 last:border-b-0">
      <AccordionTrigger className="items-center gap-3 py-3 text-sm hover:no-underline">
        <span className="flex min-w-0 flex-1 items-center gap-3">
          {question ? null : <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
          <span className="min-w-0 font-medium">{text.title}</span>
          {topic.online && !isSupabaseConfigured ? (
            <Badge variant="outline" className="shrink-0 font-normal text-muted-foreground">
              {t("online_only")}
            </Badge>
          ) : null}
        </span>
      </AccordionTrigger>
      <AccordionContent className={question ? "pb-4" : "pb-4 pl-7"}>
        <p className="text-sm text-muted-foreground">
          <Inline text={text.summary} />
        </p>
        {text.steps?.length ? (
          <ol aria-label={t("steps")} className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm marker:text-muted-foreground">
            {text.steps.map((step, i) => (
              <li key={i} className="pl-1">
                <Inline text={step} />
              </li>
            ))}
          </ol>
        ) : null}
        {text.tips?.length ? (
          <ul aria-label={t("tips")} className="mt-3 flex flex-col gap-1">
            {text.tips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  <Inline text={tip} />
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {topic.href && page ? (
          <Button asChild size="sm" variant="outline" className="mt-4 no-underline!">
            <Link href={topic.href}>
              {t("open", { page })} <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : null}
      </AccordionContent>
    </AccordionItem>
  )
}
