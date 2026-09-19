"use client"

import Link from "next/link"
import { Fragment } from "react"
import { useScreenT } from "@/components/app-shell/device-ui-lang"
import { authMessages } from "@/components/features/auth/messages"

/** Text link on the auth cards and legal pages. */
export const authLinkClass = "font-medium text-foreground underline-offset-4 hover:underline"

/**
 * Fills `{name}` placeholders in a translated template with React nodes (usually links); the rest stays text.
 * Unknown placeholders stay visible, like `interpolate`, so a missing node is easy to spot.
 */
export function fillTemplate(template: string, nodes: Record<string, React.ReactNode>): React.ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, index) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1]
    return <Fragment key={index}>{name !== undefined && Object.hasOwn(nodes, name) ? nodes[name] : part}</Fragment>
  })
}

/** "Terms · Privacy" for the sign-in and request-access footers (both pages are public, see `PUBLIC_PAGES`). */
export function LegalLinks() {
  const t = useScreenT(authMessages)
  return (
    <>
      <Link href="/terms" className={authLinkClass}>
        {t("terms_link")}
      </Link>
      <span aria-hidden className="mx-2">
        ·
      </span>
      <Link href="/privacy" className={authLinkClass}>
        {t("privacy_link")}
      </Link>
    </>
  )
}
