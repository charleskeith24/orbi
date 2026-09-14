"use client"

import { ArrowUpRight, FlaskConical, Plus, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTable } from "@/lib/store"
import { cn } from "@/lib/utils"
import { createExperimentFromRecommendation } from "./review-actions"

const normalize = (text: string) => text.trim().replace(/\s+/g, " ")

function ExperimentRow({
  index,
  item,
  experimentId,
  disabled,
  onCommit,
  onRemove,
  onCreate,
}: {
  index: number
  item: string
  experimentId: string | undefined
  disabled?: boolean
  onCommit: (text: string) => void
  onRemove: () => void
  onCreate: (text: string) => void
}) {
  const [draft, setDraft] = useState(item)
  const [source, setSource] = useState(item)
  // Re-sync when the underlying item changes (AI draft, removal above).
  if (source !== item) {
    setSource(item)
    setDraft(item)
  }
  return (
    <li className="flex flex-wrap items-center gap-1 py-1 pr-1 pl-2.5 sm:flex-nowrap">
      <span aria-hidden className="w-4 shrink-0 text-right text-xs text-muted-foreground num">
        {index + 1}
      </span>
      <input
        value={draft}
        disabled={disabled}
        aria-label={`Experiment ${index + 1}`}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            onCommit(draft)
          } else if (event.key === "Escape" && draft !== item) {
            event.stopPropagation()
            setDraft(item)
          }
        }}
        className="h-7 min-w-0 flex-1 basis-48 rounded-md bg-transparent px-1.5 text-base outline-none hover:bg-muted/60 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/50 md:text-sm"
      />
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {experimentId ? (
          <Button asChild size="xs" variant="ghost">
            <Link href={`/experiments?open=${experimentId}`}>
              <ArrowUpRight aria-hidden />
              Open experiment
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={disabled || !draft.trim()}
            onClick={() => {
              onCommit(draft)
              onCreate(draft)
            }}
          >
            <FlaskConical aria-hidden />
            Create experiment
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove experiment ${index + 1}`} disabled={disabled} onClick={onRemove}>
          <X aria-hidden />
        </Button>
      </div>
    </li>
  )
}

/**
 * Editable "Experiment" recommendations. Each line can become a planned experiment (name + hypothesis
 * from the text); once created, the line links to it in Experiments.
 */
export function ExperimentList({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: {
  id?: string
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const router = useRouter()
  const experiments = useTable("content_experiments")
  const linked = useMemo(() => new Map(experiments.map((e) => [normalize(e.hypothesis), e.id])), [experiments])
  const [draft, setDraft] = useState("")

  function add() {
    const clean = draft.trim()
    if (!clean) return
    onChange([...value, clean])
    setDraft("")
  }

  function create(text: string) {
    if (!normalize(text)) return
    const experiment = createExperimentFromRecommendation(text)
    toast.success(`Planned experiment “${experiment.name}”`, {
      action: { label: "Open", onClick: () => router.push(`/experiments?open=${experiment.id}`) },
    })
  }

  return (
    <div className={cn("flex flex-col gap-2 print:hidden", className)}>
      {value.length ? (
        <ol aria-label="Experiment" className="flex flex-col divide-y rounded-lg border bg-card dark:bg-input/20">
          {value.map((item, index) => (
            <ExperimentRow
              key={index}
              index={index}
              item={item}
              experimentId={linked.get(normalize(item))}
              disabled={disabled}
              onCommit={(text) => {
                const clean = text.trim()
                if (!clean) onChange(value.filter((_, i) => i !== index))
                else if (clean !== item) onChange(value.map((v, i) => (i === index ? clean : v)))
              }}
              onRemove={() => onChange(value.filter((_, i) => i !== index))}
              onCreate={create}
            />
          ))}
        </ol>
      ) : null}
      <div className="flex items-center gap-2">
        <Input
          id={id}
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="New experiment"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              add()
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add} disabled={disabled || !draft.trim()}>
          <Plus aria-hidden />
          Add
        </Button>
      </div>
    </div>
  )
}
