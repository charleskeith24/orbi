"use client"

/**
 * DRAFT — the Terms of Use, for the owner to review with a lawyer before launch (copy and open questions in
 * `terms-messages.ts`). Sources for the factual sentences, so they stay true when the code changes:
 * - who / invitation only: /signup is the waitlist (src/app/(auth)/signup), approve + invite in the admin area
 *   (src/app/api/admin/requests/[id]/approve, src/app/api/admin/users/invite); Supabase sign-ups off (docs/ADMIN.md §2)
 * - content stored only to run the service: workspace tables with RLS per user; admins see counts only
 *   (ARCHITECTURE §14); AI: `/api/ai` → Anthropic only with ANTHROPIC_API_KEY (src/lib/ai)
 * - AI suggestions: src/lib/ai/tasks (ideas, hooks, scripts + captions, strategist chat)
 * - Content Score: `score_content` + src/lib/scoring.ts `QUALITY_DIMENSIONS` (hook, relevance, value, clarity,
 *   authenticity, CTA); the Studio already labels it "quality, not virality"
 * - analytics from the numbers people add: content_metrics are logged or imported (no platform is connected, §8)
 * - money tools: brand_deals, income_entries, rate_cards (records only)
 * - collab partner details: `collabs` partner fields are free text in the creator's workspace; Circles: docs/CIRCLES.md
 * - disable: admin `POST /api/admin/users/:id/disable` (a long ban; the workspace is untouched)
 * - export: Settings → Data → Export workspace; deletion + contact: ../privacy/legal-shell.tsx
 */
import { useScreenT } from "@/components/app-shell/device-ui-lang"
import { fillTemplate } from "@/components/features/auth/legal-links"
import { ContactSection, LegalList, LegalPage, LegalPageLink, LegalSection, legalBodyClass, useDeletionLines } from "../privacy/legal-shell"
import { termsMessages } from "./terms-messages"

type Key = keyof (typeof termsMessages)["en"]

export function TermsView({ showRequestAccess, contactEmail }: { showRequestAccess: boolean; contactEmail: string | null }) {
  const t = useScreenT(termsMessages)
  const deletion = useDeletionLines(contactEmail)
  const privacy = <LegalPageLink page="privacy" />
  const withPrivacy = (key: Key) => fillTemplate(t(key), { privacy })
  const list = (keys: Key[]) => keys.map((key) => t(key))

  return (
    <LegalPage
      current="terms"
      title={t("title")}
      updated={t("updated")}
      intro={withPrivacy("intro")}
      showRequestAccess={showRequestAccess}
    >
      <LegalSection title={t("beta_title")}>
        <LegalList items={list(["beta_changes", "beta_bugs", "beta_as_is", "beta_end"])} />
      </LegalSection>
      <LegalSection title={t("who_title")}>
        <LegalList items={list(["who_age", "who_invite", "who_personal"])} />
      </LegalSection>
      <LegalSection title={t("own_title")}>
        <LegalList items={[t("own_yours"), withPrivacy("own_store")]} />
      </LegalSection>
      <LegalSection title={t("ai_title")}>
        <LegalList items={list(["ai_review", "ai_score", "ai_no_guarantee", "ai_money"])} />
      </LegalSection>
      <LegalSection title={t("use_title")}>
        <LegalList
          items={list([
            "use_platforms",
            "use_no_pods",
            "use_no_scraping",
            "use_legal",
            "use_collabs",
            "use_partner_details",
            "use_circles",
          ])}
        />
      </LegalSection>
      <LegalSection title={t("account_title")}>
        <LegalList items={list(["account_password", "account_disable"])} />
      </LegalSection>
      <LegalSection title={t("data_title")}>
        <LegalList items={[t("data_export"), ...deletion, withPrivacy("data_privacy")]} />
      </LegalSection>
      <LegalSection title={t("changes_title")}>
        <LegalList items={list(["changes_date", "changes_notice", "changes_continue"])} />
      </LegalSection>
      <LegalSection title={t("law_title")}>
        <p className={legalBodyClass}>{t("law_body")}</p>
      </LegalSection>

      <ContactSection email={contactEmail} />
    </LegalPage>
  )
}
