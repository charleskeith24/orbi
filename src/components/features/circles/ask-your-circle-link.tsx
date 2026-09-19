"use client"

import { UsersRound } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import type { CirclesApi } from "@/lib/circles/types"
import { useT } from "@/lib/i18n"
import { useCirclesClient } from "./circles-client"
import { askYourCircleMessages } from "./messages"

const TTL_MS = 60_000
let cached: { self: string; at: number; href: Promise<string | null> } | null = null

/** Where "Ask your circle" goes: your circle's asks when you're in one, the list when in several, nothing otherwise. */
function circleHref(api: CirclesApi): Promise<string | null> {
  const now = Date.now()
  if (!cached || cached.self !== api.self || now - cached.at > TTL_MS) {
    const href = api
      .listCircles()
      .then(({ circles }) => (circles.length === 1 ? `/circles/${circles[0].id}#asks` : circles.length > 1 ? "/circles" : null))
      .catch(() => null)
    cached = { self: api.self, at: now, href }
  }
  return cached.href
}

/**
 * The Collabs page header's "Ask your circle" link: online version only (or the dev fixture), and only when
 * you're in a circle. Renders nothing while it checks, in local mode, or when you have no circle.
 */
export function AskYourCircleLink() {
  const t = useT(askYourCircleMessages)
  const state = useCirclesClient()
  const api = state.status === "ready" ? state.api : null
  const [href, setHref] = useState<string | null>(null)

  useEffect(() => {
    if (!api) return
    let active = true
    void circleHref(api).then((next) => {
      if (active) setHref(next)
    })
    return () => {
      active = false
    }
  }, [api])

  if (!api || !href) return null
  return (
    <Button asChild size="sm" variant="ghost" title={t("title")}>
      <Link href={href}>
        <UsersRound aria-hidden />
        {t("label")}
      </Link>
    </Button>
  )
}
