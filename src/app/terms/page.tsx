// DRAFT — Terms of Use for the owner to review with a lawyer before launch. Copy and open questions:
// ./terms-messages.ts (governing law: the Philippines — the owner must confirm it); sources: ./terms-view.tsx.
import type { Metadata } from "next"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { contactEmailForPage } from "../privacy/contact-email"
import { TermsView } from "./terms-view"

export const metadata: Metadata = { title: "Terms of Use" }

/**
 * Public page (no sign-in needed, `PUBLIC_PAGES`), linked from Request access (the consent checkbox), Sign in,
 * /privacy and Settings → Data. Contact: NEXT_PUBLIC_CONTACT_EMAIL; `?preview=contact` shows a sample address
 * in development only.
 */
export default async function Page(props: PageProps<"/terms">) {
  const contactEmail = await contactEmailForPage(props.searchParams)
  return <TermsView showRequestAccess={isSupabaseConfigured} contactEmail={contactEmail} />
}
