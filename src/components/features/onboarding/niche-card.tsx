"use client"

import { Award, Check, Heart, Users, type LucideIcon } from "lucide-react"
import { useState } from "react"
import { ColorDot } from "@/components/common"
import { Button } from "@/components/ui/button"
import type { NicheKind, NicheOption } from "@/lib/ai"
import { CATEGORICAL_COLORS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { useCopy } from "./copy"

const KIND_ICONS: Record<NicheKind, LucideIcon> = { expertise: Award, passion: Heart, audience: Users }
const FIT_KEYS = ["passion", "expertise", "demand"] as const

/** One suggested niche direction — built to be compared side by side with the other two. */
export function NicheCard({ option, index, chosen, onChoose }: { option: NicheOption; index: number; chosen: boolean; onChoose: () => void }) {
  const copy = useCopy()
  const t = copy.niche
  const [open, setOpen] = useState(false)
  const Icon = KIND_ICONS[option.kind]
  const titleId = `ob-niche-option-${index}`
  return (
    <article
      aria-labelledby={titleId}
      className={cn("flex min-w-0 flex-col rounded-lg border bg-card p-4 transition-colors dark:bg-input/20", chosen && "border-brand/60 ring-1 ring-brand/30")}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{t.kinds[option.kind]}</span>
          <span className="hidden truncate font-normal xl:inline">· {t.kindHints[option.kind]}</span>
        </span>
        {chosen ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand">
            <Check className="size-3.5" aria-hidden />
            {t.chosen}
          </span>
        ) : null}
      </div>
      <h3 id={titleId} className="mt-2 text-sm font-semibold text-balance">
        {option.name}
      </h3>
      <p className="mt-1 text-sm text-pretty text-muted-foreground">{option.niche_statement}</p>

      <dl className="mt-4 flex flex-col gap-1.5">
        {FIT_KEYS.map((key) => {
          const fit = option.fit[key]
          return (
            <div key={key} className="grid grid-cols-[4.75rem_minmax(0,1fr)_2.5rem] items-center gap-2">
              <dt className="truncate text-xs text-muted-foreground">{t.fit[key]}</dt>
              <dd className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className="block h-full rounded-full bg-foreground/55" style={{ width: `${fit.score * 10}%` }} />
              </dd>
              <dd className="text-right text-xs font-medium num" aria-label={t.fitAria(t.fit[key], fit.score)}>
                {t.outOfTen(fit.score)}
              </dd>
            </div>
          )
        })}
      </dl>

      <div className="mt-4">
        <p className="text-xs font-medium">{t.pillars}</p>
        <ul className="mt-1.5 flex flex-col gap-1">
          {option.pillars.map((p, i) => (
            <li key={p.name} className="flex items-center gap-2 text-xs">
              <ColorDot color={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="shrink-0 text-muted-foreground num">{p.target_percentage}%</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex flex-col gap-2 text-xs text-pretty">
        <p>
          <span className="font-medium">{t.why}: </span>
          <span className="text-muted-foreground">{option.why_it_fits}</span>
        </p>
        <p>
          <span className="font-medium">{t.risk}: </span>
          <span className="text-muted-foreground">{option.risk}</span>
        </p>
      </div>

      {open ? (
        <div className="mt-4 flex flex-col gap-3 border-t pt-3 text-xs">
          <div>
            <p className="font-medium">{t.posts}</p>
            <ol className="mt-1.5 flex flex-col gap-2">
              {option.sample_posts.map((post) => (
                <li key={post.title}>
                  <p className="text-pretty">{post.title}</p>
                  {post.hook ? <p className="text-pretty text-muted-foreground">“{post.hook}”</p> : null}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="font-medium">{t.money}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
              {option.monetization.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium">{t.audience}</p>
            <p className="text-muted-foreground">{option.audience}</p>
          </div>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            {FIT_KEYS.map((key) => (
              <li key={key}>
                <span className="font-medium text-foreground">{t.fit[key]} {t.outOfTen(option.fit[key].score)}</span> — {option.fit[key].reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-auto flex items-center gap-2 pt-4">
        <Button type="button" size="sm" variant={chosen ? "secondary" : "outline"} aria-pressed={chosen} onClick={onChoose} className="flex-1">
          {chosen ? <Check aria-hidden /> : null}
          {chosen ? t.chosen : t.choose}
        </Button>
        <Button type="button" size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? t.less : t.more}
        </Button>
      </div>
    </article>
  )
}
