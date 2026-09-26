"use client"

import { formatDistanceStrict } from "date-fns"
import { useMemo, useSyncExternalStore } from "react"
import { AiNotice, CopyButton, DefinitionList, Disclosure, KeyValue, ProviderBadge, SectionCard, StatusPill } from "@/components/common"
import { Spinner } from "@/components/ui/spinner"
import { providerLabel, useAiStatus } from "@/lib/ai"
import { parseDate } from "@/lib/dates"
import { type Translator, type UiLang, useT, useUiLang } from "@/lib/i18n"
import { useTable } from "@/lib/store"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { AiKeyCard } from "./ai-key/ai-key-card"
import { aiKeyFixtureMode } from "./ai-key/dev-fixture"
import { AiLog } from "./ai-log"
import { aiMessages } from "./ai-messages"
import { BrandContextCard } from "./brand-context-card"

const ENV_SNIPPET = `# .env.local in the project root — read by the server only
ANTHROPIC_API_KEY=your-anthropic-api-key

# Optional
AI_MODEL=claude-opus-5
AI_EFFORT=high`

const ENV_VARS: { name: string; required: boolean; description: "env_api_key" | "env_model" | "env_effort" | "env_provider" }[] = [
  { name: "ANTHROPIC_API_KEY", required: true, description: "env_api_key" },
  { name: "AI_MODEL", required: false, description: "env_model" },
  { name: "AI_EFFORT", required: false, description: "env_effort" },
  { name: "AI_PROVIDER", required: false, description: "env_provider" },
]

/** The gateway's status sentence (English, from the server) in the UI language; unknown reasons pass through. */
function statusReason(reason: string, model: string, lang: UiLang, t: Translator<(typeof aiMessages)["en"]>): string {
  if (lang === "en" || !reason) return reason
  if (reason.startsWith("AI_PROVIDER is set to offline")) return t("reason_forced_offline")
  if (reason.startsWith("No ANTHROPIC_API_KEY")) return t("reason_no_key")
  if (reason.startsWith("Couldn't reach")) return t("reason_unreachable")
  if (reason.startsWith("Using ") && reason.endsWith(" via the Anthropic API.")) return t("reason_using", { model })
  if (reason.startsWith("No AI key yet")) return t("reason_no_key_online")
  if (reason.startsWith("AI keys aren't set up")) return t("reason_not_ready")
  if (reason.startsWith("Your saved AI key can't be read")) return t("reason_unreadable")
  const yours = /^Using your (\S+) key \((.+)\)\.$/.exec(reason)
  if (yours) return t("reason_using_yours", { provider: yours[1], model: yours[2] })
  return reason
}

const noSubscribe = () => () => {}
/** Online — or, in development, the AI key fixture: the card for your own key replaces the server setup. */
function useOwnKeys(): boolean {
  const fixture = useSyncExternalStore(noSubscribe, aiKeyFixtureMode, () => null)
  return isSupabaseConfigured || fixture !== null
}

const ENGINE_LABELS = { anthropic: "engine_claude", openai: "engine_openai", gemini: "engine_gemini", offline: "engine_offline" } as const

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
  const t = useT(aiMessages)
  const lang = useUiLang()
  const generations = useTable("ai_generations")
  const last = useMemo(
    () => generations.reduce<(typeof generations)[number] | null>((best, g) => (!best || g.created_at > best.created_at ? g : best), null),
    [generations]
  )
  const ownKeys = useOwnKeys()
  const live = status.provider !== "offline" && status.configured
  const unreachable = !status.loading && !live && status.reason.startsWith("Couldn't reach")
  const lastAt = parseDate(last?.created_at)

  return (
    <>
      <SectionCard title={t("engine_title")} info={t("engine_info")}>
        {status.loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> {t("checking")}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <ProviderBadge provider={status.provider} model={status.model} />
              <StatusPill tone={live ? "good" : unreachable ? "warning" : "neutral"}>
                {live ? (status.source === "user" ? t("own_key_connected") : t("claude_connected")) : unreachable ? t("unreachable") : t("offline_mode")}
              </StatusPill>
            </div>
            <DefinitionList>
              <KeyValue label={t("kv_engine")}>{t(ENGINE_LABELS[live ? status.provider : "offline"])}</KeyValue>
              <KeyValue label={t("kv_model")}>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{status.model || "—"}</code>
              </KeyValue>
              <KeyValue label={t("kv_api_key")}>
                {status.source === "user" ? t("key_yours") : status.configured ? t("key_configured") : t("key_not_set")}
              </KeyValue>
              <KeyValue label={t("kv_status")}>{statusReason(status.reason, status.model, lang, t) || "—"}</KeyValue>
              <KeyValue label={t("kv_last")}>
                {last && lastAt
                  ? `${providerLabel(last.provider, last.model)} · ${lastAt >= now ? t("just_now") : formatDistanceStrict(lastAt, now, { addSuffix: true })}`
                  : t("none_yet")}
              </KeyValue>
            </DefinitionList>
            {!live ? <AiNotice>{ownKeys ? t("offline_notice_online") : t("offline_notice")}</AiNotice> : null}
          </div>
        )}
      </SectionCard>

      {ownKeys ? (
        <AiKeyCard now={now} />
      ) : (
      <SectionCard
        title={live ? t("config_title") : t("enable_title")}
        info={live ? t("config_live_info") : t("config_offline_info")}
      >
        <div className="flex flex-col gap-4">
          {!live ? (
            <ol className="flex flex-col gap-2 text-sm">
              {[t("step_1"), t("step_2"), t("step_3")].map((step, index) => (
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
            <CopyButton text={ENV_SNIPPET} successMessage={t("snippet_copied")} className="absolute top-1.5 right-1.5" />
          </div>
          <Disclosure label={t("env_vars")}>
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
              {ENV_VARS.map((v) => (
                <div key={v.name} className="contents">
                  <dt className="flex items-center gap-2">
                    <code className="font-mono text-xs">{v.name}</code>
                    {v.required ? <span className="text-xs text-muted-foreground">{t("required")}</span> : null}
                  </dt>
                  <dd className="mb-1 text-xs text-muted-foreground sm:mb-0">{t(v.description)}</dd>
                </div>
              ))}
            </dl>
          </Disclosure>
        </div>
      </SectionCard>
      )}
    </>
  )
}
