"use client"

import { formatDistanceStrict } from "date-fns"
import { useMemo } from "react"
import { AiNotice, CopyButton, DefinitionList, KeyValue, ProviderBadge, SectionCard, StatusPill } from "@/components/common"
import { Spinner } from "@/components/ui/spinner"
import { providerLabel, useAiStatus } from "@/lib/ai"
import { parseDate } from "@/lib/dates"
import { useTable } from "@/lib/store"
import { AiLog } from "./ai-log"
import { BrandContextCard } from "./brand-context-card"

const ENV_SNIPPET = `# .env.local in the project root — read by the server only
ANTHROPIC_API_KEY=your-anthropic-api-key

# Optional
AI_MODEL=claude-opus-5
AI_EFFORT=high`

const ENV_VARS: { name: string; required: boolean; description: string }[] = [
  { name: "ANTHROPIC_API_KEY", required: true, description: "Your Anthropic API key. Stays on the server — the browser never sees it." },
  { name: "AI_MODEL", required: false, description: "Model id. Defaults to claude-opus-5." },
  { name: "AI_EFFORT", required: false, description: "low · medium · high (default) · xhigh · max — more effort, deeper answers, slower." },
  { name: "AI_PROVIDER", required: false, description: "Set to offline to force the offline templates even with a key." },
]

export function AiTab({ now }: { now: Date }) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <EngineCard now={now} />
      <BrandContextCard now={now} />
      <AiLog now={now} />
    </div>
  )
}

function EngineCard({ now }: { now: Date }) {
  const status = useAiStatus()
  const generations = useTable("ai_generations")
  const last = useMemo(
    () => generations.reduce<(typeof generations)[number] | null>((best, g) => (!best || g.created_at > best.created_at ? g : best), null),
    [generations]
  )
  const live = status.provider === "anthropic" && status.configured
  const unreachable = !status.loading && !live && status.reason.startsWith("Couldn't reach")
  const lastAt = parseDate(last?.created_at)

  return (
    <>
      <SectionCard title="AI engine" description="Every AI action in the app runs through one server-side gateway — keys never reach the browser.">
        {status.loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Checking the AI service…
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <ProviderBadge provider={status.provider} model={status.model} />
              <StatusPill tone={live ? "good" : unreachable ? "warning" : "neutral"}>
                {live ? "Claude connected" : unreachable ? "AI service unreachable" : "Offline mode"}
              </StatusPill>
            </div>
            <DefinitionList>
              <KeyValue label="Engine">{live ? "Claude via the Anthropic API" : "Offline template engine"}</KeyValue>
              <KeyValue label="Model">
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{status.model || "—"}</code>
              </KeyValue>
              <KeyValue label="API key">{status.configured ? "Configured on the server" : "Not set"}</KeyValue>
              <KeyValue label="Status">{status.reason || "—"}</KeyValue>
              <KeyValue label="Last generation">
                {last && lastAt
                  ? `${providerLabel(last.provider, last.model)} · ${lastAt >= now ? "just now" : formatDistanceStrict(lastAt, now, { addSuffix: true })}`
                  : "None yet"}
              </KeyValue>
            </DefinitionList>
            {!live ? (
              <AiNotice>
                Offline templates assemble drafts from your Brand HQ, audience, pillars, winners and stories — genuinely useful, and
                always labelled “Offline templates”. Claude writes more specific, personal copy.
              </AiNotice>
            ) : null}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={live ? "Claude configuration" : "Enable Claude"}
        description={
          live
            ? "Claude is on. Change the model or effort in .env.local and restart the server."
            : "Three steps. Everything keeps working offline until you do."
        }
      >
        <div className="flex flex-col gap-4">
          {!live ? (
            <ol className="flex flex-col gap-2 text-sm">
              {[
                "Create an API key in your Anthropic account (Claude Console → API keys).",
                "Add it to .env.local in the project root, as below.",
                "Restart the dev server — environment variables are read at startup. This page will then say “Claude connected”.",
              ].map((step, index) => (
                <li key={step} className="flex gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-medium num">
                    {index + 1}
                  </span>
                  <span className="text-pretty">{step}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <div className="relative min-w-0">
            <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 pr-12 font-mono text-xs leading-relaxed scrollbar-thin">
              {ENV_SNIPPET}
            </pre>
            <CopyButton text={ENV_SNIPPET} successMessage="Environment snippet copied" className="absolute top-1.5 right-1.5" />
          </div>
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
            {ENV_VARS.map((v) => (
              <div key={v.name} className="contents">
                <dt className="flex items-center gap-2">
                  <code className="font-mono text-xs">{v.name}</code>
                  {v.required ? <span className="text-xs text-muted-foreground">required</span> : null}
                </dt>
                <dd className="mb-1 text-xs text-muted-foreground sm:mb-0">{v.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </SectionCard>
    </>
  )
}
