// DRAFT — privacy notice for the owner to review before launch. Copy: ./privacy-messages.ts; sources: ./privacy-view.tsx.
import type { Metadata } from "next"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { contactEmailForPage } from "./contact-email"
import { PrivacyView } from "./privacy-view"

export const metadata: Metadata = { title: "Privacy" }

/**
 * Public page (no sign-in needed), linked from Request access, Sign in, /terms and Settings → Data.
 * Contact: NEXT_PUBLIC_CONTACT_EMAIL; `?preview=contact` shows a sample address in development only.
 */
export default async function Page(props: PageProps<"/privacy">) {
  const contactEmail = await contactEmailForPage(props.searchParams)
  return <PrivacyView showRequestAccess={isSupabaseConfigured} contactEmail={contactEmail} />
}
