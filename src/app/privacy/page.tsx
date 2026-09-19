// DRAFT — privacy notice for the owner to review before launch. Copy: ./privacy-messages.ts; sources: ./privacy-view.tsx.
import type { Metadata } from "next"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { PrivacyView } from "./privacy-view"

export const metadata: Metadata = { title: "Privacy" }

/** Public page (no sign-in needed), linked from Request access, Sign in and the account screens. */
export default function Page() {
  return <PrivacyView showRequestAccess={isSupabaseConfigured} />
}
