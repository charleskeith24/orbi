"use client"

import { formatDistanceStrict } from "date-fns"
import { ExternalLink, KeyRound, Lock, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog, SectionCard } from "@/components/common"
import { commonMessages } from "@/lib/i18n/messages/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { refreshAiStatus } from "@/lib/ai/use-ai-task"
import {
  AI_KEY_CONSOLES,
  AI_KEY_PROVIDER_NAMES,
  AI_KEY_PROVIDERS,
  cleanApiKey,
  type AiKeyProvider,
  type AiKeyState,
} from "@/lib/ai/byok/types"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { AiKeyRequestError, httpAiKeyClient, type AiKeyClient } from "./client"
import { aiKeyFixtureMode, createAiKeyFixture } from "./dev-fixture"
import { aiKeyMessages } from "./messages"

const PLACEHOLDERS: Record<AiKeyProvider, string> = { anthropic: "sk-ant-…", openai: "sk-…", gemini: "AIza…" }
const NOTES = { anthropic: "anthropic_note", openai: "openai_note", gemini: "gemini_note" } as const

type Saved = Extract<AiKeyState, { status: "saved" }>

/** The HTTP client — or, in development with `pbos:dev-ai-key` set, the in-page fixture. */
function useClient(): AiKeyClient {
  return useMemo(() => {
    const mode = aiKeyFixtureMode()
    return mode ? createAiKeyFixture(mode) : httpAiKeyClient
  }, [])
}

/**
 * Settings → AI → "Your AI key" (online version): connect your own Claude, OpenAI or Gemini key — checked
 * with the provider before it's saved, encrypted, never shown again — pick the model, replace or remove it.
 */
export function AiKeyCard({ now }: { now: Date }) {
  const t = useT(aiKeyMessages)
  const client = useClient()
  const [state, setState] = useState<AiKeyState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [replacing, setReplacing] = useState(false)

  useEffect(() => {
    let active = true
    client
      .get({ models: true })
      .then((s) => active && setState(s))
      .catch((err: unknown) => active && setLoadError(err instanceof Error ? err.message : t("err_generic")))
    return () => {
      active = false
    }
  }, [client, t])

  const onSaved = (next: AiKeyState) => {
    setState(next)
    setReplacing(false)
    refreshAiStatus()
  }

  return (
    <SectionCard title={t("title")} info={t("info")}>
      {state === null ? (
        loadError ? (
          <p className="text-sm text-critical-fg">{loadError}</p>
        ) : (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-9 w-full" />
          </div>
        )
      ) : state.status === "not_configured" || state.status === "local" ? (
        <p className="text-sm text-muted-foreground">{t("not_configured")}</p>
      ) : state.status === "saved" && !replacing ? (
        <SavedKey state={state} client={client} now={now} onChange={onSaved} onReplace={() => setReplacing(true)} />
      ) : (
        <KeyForm
          client={client}
          initialProvider={state.status === "saved" ? state.provider : "gemini"}
          onSaved={onSaved}
          onCancel={state.status === "saved" ? () => setReplacing(false) : undefined}
        />
      )}
    </SectionCard>
  )
}

function useErrorText() {
  const t = useT(aiKeyMessages)
  return (err: unknown, provider: AiKeyProvider): string => {
    const name = AI_KEY_PROVIDER_NAMES[provider]
    if (!(err instanceof AiKeyRequestError)) return t("err_generic")
    if (err.code === "invalid_key") return t("err_invalid_key", { provider: name })
    if (err.code === "quota") return t("err_quota", { provider: name })
    if (err.code === "unknown_model") return t("err_unknown_model")
    if (err.code === "provider_error") return t("err_provider_error", { provider: name })
    if (err.code === "network") return t("err_network")
    return err.message || t("err_generic")
  }
}

function KeyForm({
  client,
  initialProvider,
  onSaved,
  onCancel,
}: {
  client: AiKeyClient
  initialProvider: AiKeyProvider
  onSaved: (state: AiKeyState) => void
  onCancel?: () => void
}) {
  const t = useT(aiKeyMessages)
  const tc = useT(commonMessages)
  const errorText = useErrorText()
  const [provider, setProvider] = useState<AiKeyProvider>(initialProvider)
  const [key, setKey] = useState("")
  const [touched, setTouched] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cleaned = cleanApiKey(key)
  const fieldError = error ?? (touched && !cleaned ? t("key_required") : null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTouched(true)
    if (!cleaned || pending) return
    setPending(true)
    setError(null)
    try {
      const next = await client.save({ provider, key: cleaned })
      setKey("")
      toast.success(t("saved_toast", { provider: AI_KEY_PROVIDER_NAMES[provider] }))
      onSaved(next)
    } catch (err) {
      setError(errorText(err, provider))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("provider_label")}</legend>
        <RadioGroup
          value={provider}
          onValueChange={(value) => {
            setProvider(value as AiKeyProvider)
            setError(null)
          }}
          className="grid gap-2 sm:grid-cols-3"
        >
          {AI_KEY_PROVIDERS.map((id) => (
            <Label
              key={id}
              htmlFor={`ai-key-${id}`}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 font-normal transition-colors hover:bg-muted/50",
                provider === id && "border-brand/60 bg-brand-soft/40"
              )}
            >
              <RadioGroupItem id={`ai-key-${id}`} value={id} className="mt-0.5" />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">{AI_KEY_PROVIDER_NAMES[id]}</span>
                <span className="text-xs text-muted-foreground">{t(NOTES[id])}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="ai-key-input">{t("key_label")}</Label>
          <a
            href={AI_KEY_CONSOLES[provider]}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("get_key")} <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
        <Input
          id="ai-key-input"
          type="password"
          value={key}
          onChange={(event) => {
            setKey(event.target.value)
            setError(null)
          }}
          onBlur={() => setTouched(true)}
          placeholder={PLACEHOLDERS[provider]}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "ai-key-error" : "ai-key-note"}
          disabled={pending}
        />
        {fieldError ? (
          <p id="ai-key-error" className="text-xs text-critical-fg">
            {fieldError}
          </p>
        ) : (
          <p id="ai-key-note" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3" aria-hidden /> {t("encrypted")}
          </p>
        )}
        {provider === "gemini" ? <p className="text-xs text-muted-foreground">{t("gemini_free_note")}</p> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending || (touched && !cleaned)}>
          {pending ? <Spinner /> : <KeyRound aria-hidden />}
          {pending ? t("testing") : t("save")}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
            {tc("cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  )
}

function SavedKey({
  state,
  client,
  now,
  onChange,
  onReplace,
}: {
  state: Saved
  client: AiKeyClient
  now: Date
  onChange: (state: AiKeyState) => void
  onReplace: () => void
}) {
  const t = useT(aiKeyMessages)
  const errorText = useErrorText()
  const [changing, setChanging] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const name = AI_KEY_PROVIDER_NAMES[state.provider]
  const verified = new Date(state.verifiedAt)
  const models = state.models ?? []
  const options = models.some((m) => m.id === state.model) ? models : [{ id: state.model, label: state.model }, ...models]

  async function changeModel(model: string) {
    if (model === state.model) return
    setChanging(true)
    try {
      const next = await client.setModel(model)
      toast.success(t("model_changed", { model: options.find((m) => m.id === model)?.label ?? model }))
      onChange(next)
    } catch (err) {
      toast.error(errorText(err, state.provider))
    } finally {
      setChanging(false)
    }
  }

  async function remove() {
    try {
      const next = await client.remove()
      toast.success(t("removed_toast"))
      onChange(next)
    } catch (err) {
      toast.error(errorText(err, state.provider))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <KeyRound className="size-4 text-brand" aria-hidden /> {name}
        </span>
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">•••• {state.hint}</code>
        {Number.isNaN(verified.getTime()) ? null : (
          <span className="text-xs text-muted-foreground">
            {verified.getTime() > now.getTime() - 60_000 ? t("checked_now") : t("checked", { when: formatDistanceStrict(verified, now, { addSuffix: true }) })}
          </span>
        )}
      </div>

      <div className="flex max-w-sm flex-col gap-1.5">
        <Label htmlFor="ai-key-model">{t("model_label")}</Label>
        <Select value={state.model} onValueChange={(model) => void changeModel(model)} disabled={changing || !models.length}>
          <SelectTrigger id="ai-key-model" className="w-full">
            {changing ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Spinner /> {t("models_loading")}
              </span>
            ) : (
              <SelectValue />
            )}
          </SelectTrigger>
          <SelectContent>
            {options.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.modelsError ? (
          <p className="text-xs text-warning-fg">{t("models_error", { message: state.modelsError })}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{t("billing", { provider: name })}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onReplace}>
          <KeyRound aria-hidden /> {t("replace")}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="text-critical-fg" onClick={() => setConfirming(true)}>
          <Trash2 aria-hidden /> {t("remove")}
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("remove_title")}
        description={t("remove_body")}
        confirmLabel={t("remove")}
        destructive
        onConfirm={remove}
      />
    </div>
  )
}
