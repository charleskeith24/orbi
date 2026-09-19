"use client"

/**
 * DRAFT — the privacy notice, for the owner to review before launch (copy in `privacy-messages.ts`).
 * Sources for each section, so it stays true when the code changes:
 * - account: Supabase Auth (`auth.users`), `public.users`; admins' 2-step: `auth.mfa` factors
 * - workspace: the 33 workspace tables (supabase/migrations/20260910000000_init.sql, RLS per user)
 * - access requests: `access_requests` (src/app/api/access-requests/route.ts — no IP read or stored)
 * - feedback: `feedback` (src/app/api/feedback/route.ts: kind, message, page, ui_language, viewport, user_agent, app_version)
 * - usage analytics: `usage_events`, opt-in per device (src/lib/telemetry, ARCHITECTURE §13)
 * - circles: supabase/migrations/20260919000000_circles.sql (members-only RLS; contacts only via
 *   `circle_contact()` after an accepted interest; leaving deletes the member's rows; no admin access)
 * - admins: metadata + counts only (src/lib/admin/types.ts `AdminUserRow`), audit log `admin_audit_log`
 *   (`target_email` has no foreign key, so entries outlive a deleted account)
 * - export / start fresh: Settings → Data; account deletion: admin `DELETE /api/admin/users/:id` (workspace,
 *   `feedback` and `usage_events` cascade); an access request is removed by the owner in Supabase (docs/ADMIN.md)
 * - contact: `NEXT_PUBLIC_CONTACT_EMAIL` (./contact-email.ts); without it, the Feedback button (signed in only)
 * - AI: `/api/ai` → Anthropic only with ANTHROPIC_API_KEY, otherwise the offline engine
 */
import { useScreenT } from "@/components/app-shell/device-ui-lang"
import { ContactSection, LegalList, LegalPage, LegalSection, legalBodyClass, useDeletionLines } from "./legal-shell"
import { privacyMessages } from "./privacy-messages"

type Key = keyof (typeof privacyMessages)["en"]

export function PrivacyView({ showRequestAccess, contactEmail }: { showRequestAccess: boolean; contactEmail: string | null }) {
  const t = useScreenT(privacyMessages)
  const deletion = useDeletionLines(contactEmail)
  const list = (keys: Key[]) => keys.map((key) => t(key))
  const stores: [Key, Key][] = [
    ["stores_account_title", "stores_account"],
    ["stores_workspace_title", "stores_workspace"],
    ["stores_requests_title", "stores_requests"],
    ["stores_feedback_title", "stores_feedback"],
    ["stores_usage_title", "stores_usage"],
    ["stores_circles_title", "stores_circles"],
  ]

  return (
    <LegalPage current="privacy" title={t("title")} updated={t("updated")} intro={t("intro")} showRequestAccess={showRequestAccess}>
      <LegalSection title={t("stores_title")}>
        <dl className="flex flex-col gap-3 rounded-lg border bg-card p-4">
          {stores.map(([title, body]) => (
            <div key={title} className="flex flex-col gap-0.5">
              <dt className="text-sm font-medium">{t(title)}</dt>
              <dd className="text-sm text-pretty text-muted-foreground">{t(body)}</dd>
            </div>
          ))}
        </dl>
      </LegalSection>

      <LegalSection title={t("see_title")}>
        <LegalList items={list(["see_you", "see_admins", "see_admins_read", "see_audit", "see_circles"])} />
      </LegalSection>
      <LegalSection title={t("hosting_title")}>
        <LegalList items={list(["hosting_supabase", "hosting_vercel", "hosting_ai"])} />
      </LegalSection>
      <LegalSection title={t("control_title")}>
        <LegalList items={[t("control_export"), t("control_clear"), ...deletion, t("control_usage")]} />
      </LegalSection>
      <LegalSection title={t("storage_title")}>
        <p className={legalBodyClass}>{t("storage_body")}</p>
      </LegalSection>
      <LegalSection title={t("local_title")}>
        <p className={legalBodyClass}>{t("local_body")}</p>
      </LegalSection>

      <ContactSection email={contactEmail} />
    </LegalPage>
  )
}
