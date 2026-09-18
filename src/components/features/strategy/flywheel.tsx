"use client"

import { ArrowRight, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useId, useState } from "react"
import { Delta, SectionCard } from "@/components/common"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { systemMessages } from "./system-messages"
import type { FlywheelStep, FlywheelSummary } from "./system-model"

/* Geometry in viewBox units. The HTML labels share the same coordinate space (percent of W / H). */
const W = 132
const H = 108
const CX = 66
const CY = 54
const R = 30
const LABEL_R = 35.5
const GAP_DEG = 8

const rad = (deg: number) => (deg * Math.PI) / 180
const angleOf = (i: number, n: number) => -90 + (360 / n) * i
const point = (deg: number, r: number) => ({ x: CX + r * Math.cos(rad(deg)), y: CY + r * Math.sin(rad(deg)) })
const fixed = (n: number) => Number(n.toFixed(3))

function arcPath(fromDeg: number, toDeg: number): string {
  const a = point(fromDeg, R)
  const b = point(toDeg, R)
  return `M ${fixed(a.x)} ${fixed(a.y)} A ${R} ${R} 0 0 1 ${fixed(b.x)} ${fixed(b.y)}`
}

/** Where a label sits relative to its anchor: outward from the ring. */
function labelPlacement(deg: number): { style: React.CSSProperties; align: "start" | "center" | "end" } {
  const c = Math.cos(rad(deg))
  const s = Math.sin(rad(deg))
  const p = point(deg, LABEL_R)
  const tx = c > 0.3 ? "0%" : c < -0.3 ? "-100%" : "-50%"
  const ty = s < -0.3 ? "-100%" : s > 0.3 ? "0%" : "-50%"
  return {
    style: { left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`, transform: `translate(${tx}, ${ty})` },
    align: c > 0.3 ? "start" : c < -0.3 ? "end" : "center",
  }
}

function StepValue({ step }: { step: FlywheelStep }) {
  const t = useT(systemMessages)
  return (
    <>
      <span className="text-sm leading-5 font-semibold num">
        {step.value} <span className="text-xs font-normal text-muted-foreground">{step.unit}</span>
      </span>
      {step.delta !== null ? <Delta value={step.delta} /> : <span className="text-xs text-muted-foreground">{t("all_time")}</span>}
    </>
  )
}

function Wheel({ summary }: { summary: FlywheelSummary }) {
  const markerId = `fw-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const [active, setActive] = useState<number | null>(null)
  const n = summary.steps.length
  const t = useT(systemMessages)

  return (
    <div className="relative mx-auto aspect-[132/108] w-full max-w-[46rem]">
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <marker id={markerId} viewBox="0 0 6 6" refX="4.5" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L6,3 L0,6 z" fill="context-stroke" />
          </marker>
        </defs>
        <circle cx={CX} cy={CY} r={R - 7} className="fill-muted/40 dark:fill-input/20" />
        {summary.steps.map((step, i) => {
          const from = angleOf(i, n) + GAP_DEG
          const to = angleOf(i + 1, n) - GAP_DEG
          const closing = i === n - 1
          return (
            <path
              key={step.key}
              d={arcPath(from, to)}
              fill="none"
              strokeWidth={closing ? 0.7 : 0.5}
              strokeLinecap="round"
              markerEnd={`url(#${markerId})`}
              className={closing ? "stroke-brand" : "stroke-muted-foreground/45"}
            />
          )
        })}
        {summary.steps.map((step, i) => {
          const p = point(angleOf(i, n), R)
          const on = active === i
          return (
            <g key={step.key}>
              <circle
                cx={fixed(p.x)}
                cy={fixed(p.y)}
                r={2.7}
                strokeWidth={0.6}
                className={cn("transition-colors", on ? "fill-brand stroke-brand" : "fill-card stroke-brand")}
              />
              <text
                x={fixed(p.x)}
                y={fixed(p.y)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={2.4}
                className={cn("font-semibold", on ? "fill-white" : "fill-foreground")}
              >
                {i + 1}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="pointer-events-none absolute top-1/2 left-1/2 flex w-[34%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center">
        <RefreshCw className="size-5 text-brand" aria-hidden />
        <p className="text-sm leading-5 font-semibold text-balance">{t("flywheel_title")}</p>
        {summary.measured ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground num">
              {t("growing_count", { growing: summary.growing, measured: summary.measured })}
            </span>{" "}
            {t("growing_suffix")}
          </p>
        ) : (
          <p className="text-xs text-pretty text-muted-foreground">{t("no_history")}</p>
        )}
        <p className="text-[11px] text-muted-foreground">{t("period_compare")}</p>
      </div>

      <ol className="contents">
        {summary.steps.map((step, i) => {
          const { style, align } = labelPlacement(angleOf(i, n))
          return (
            <li key={step.key} className="absolute w-max max-w-[23%]" style={style}>
              <Link
                href={step.href}
                title={step.description}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className={cn(
                  "flex flex-col rounded-md px-1.5 py-1 outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50",
                  align === "start" && "items-start text-left",
                  align === "center" && "items-center text-center",
                  align === "end" && "items-end text-right"
                )}
              >
                <span className="text-xs font-medium">
                  <span className="sr-only">{t("step_sr", { n: i + 1 })}</span>
                  {step.label}
                </span>
                <StepValue step={step} />
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Narrow containers: the same cycle as a numbered list. */
function StepList({ summary }: { summary: FlywheelSummary }) {
  const t = useT(systemMessages)
  return (
    <ol className="flex flex-col">
      {summary.steps.map((step, i) => (
        <li key={step.key} className="relative flex gap-3 pb-3">
          <span aria-hidden className="absolute top-7 bottom-0 left-3 w-px bg-border" />
          <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full border border-brand bg-card text-xs font-semibold num">
            {i + 1}
          </span>
          <Link
            href={step.href}
            className="flex min-w-0 flex-1 items-start justify-between gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">{step.label}</span>
              <span className="block text-xs text-pretty text-muted-foreground">{step.description}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end">
              <StepValue step={step} />
            </span>
          </Link>
        </li>
      ))}
      <li className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex size-6 shrink-0 items-center justify-center">
          <RefreshCw className="size-4 text-brand" aria-hidden />
        </span>
        {t("next_cycle")}
      </li>
    </ol>
  )
}

/** The Personal Brand Flywheel (spec §51) with live evidence per step. */
export function FlywheelCard({ summary }: { summary: FlywheelSummary }) {
  const weak = summary.weakest
  const strong = summary.strongest
  const t = useT(systemMessages)
  return (
    <SectionCard
      title={t("flywheel_title")}
      description={t("flywheel_description")}
      footer={
        weak || strong ? (
          <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {strong ? (
              <span>
                {t("strongest")} <span className="font-medium text-foreground">{strong.label}</span> <Delta value={strong.delta} />
              </span>
            ) : null}
            {weak ? (
              <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
                {t("weakest")} <span className="font-medium text-foreground">{weak.label}</span> <Delta value={weak.delta} />
                <span aria-hidden>—</span>
                <Link href={weak.tip.href} className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline">
                  {weak.tip.text}
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </span>
            ) : null}
          </p>
        ) : undefined
      }
    >
      <div className="@container">
        <div className="hidden @min-[34rem]:block">
          <Wheel summary={summary} />
        </div>
        <div className="@min-[34rem]:hidden">
          <StepList summary={summary} />
        </div>
      </div>
    </SectionCard>
  )
}
