/**
 * Shared by /privacy and /terms (DRAFT — see the source comments in `privacy-messages.ts` and
 * `../terms/terms-messages.ts`): the page frame, the contact block and the deletion lines.
 * `{email}` is `NEXT_PUBLIC_CONTACT_EMAIL` (./contact-email.ts), rendered as a mailto: link.
 * The "_none" lines are shown while no contact email is configured; they must stay honest about that.
 */
import { defineMessages } from "@/lib/i18n/core"

export const legalMessages = defineMessages({
  en: {
    back: "Back to Orbi",
    request_access: "Request access",
    legal_nav: "Legal",
    terms: "Terms of Use",
    privacy: "Privacy notice",

    contact_title: "Contact",
    contact_email: "Email us at {email}.",
    contact_none:
      "No contact email is set up for this site yet. If you have an account, use Send feedback in the account menu (your photo or initials at the top of any page) to reach the Orbi team.",

    delete_email:
      "Delete your account: email us at {email} from the address you use for Orbi. Deleting an account deletes its workspace, feedback and usage analytics too.",
    delete_feedback:
      "Delete your account: ask the Orbi team with Send feedback in the account menu at the top of any page. Deleting an account deletes its workspace, feedback and usage analytics too.",
    request_email: "Asked for access but don't have an account? Email us at {email} to have your request removed.",
    request_none:
      "Asked for access but don't have an account? Removing a request needs a contact email, and this site doesn't have one set up yet.",
  },
  tl: {
    back: "Balik sa Orbi",
    request_access: "Mag-request ng access",
    legal_nav: "Legal",
    terms: "Terms of Use",
    privacy: "Privacy notice",

    contact_title: "Contact",
    contact_email: "I-email kami sa {email}.",
    contact_none:
      "Wala pang contact email na naka-set up sa site na 'to. Kung may account ka, gamitin ang Magpadala ng feedback sa account menu (photo o initials mo sa taas ng kahit anong page) para maabot ang Orbi team.",

    delete_email:
      "I-delete ang account mo: i-email kami sa {email} gamit ang address na gamit mo sa Orbi. Kapag na-delete ang account, buburahin din ang workspace, feedback at usage analytics nito.",
    delete_feedback:
      "I-delete ang account mo: sabihan ang Orbi team gamit ang Magpadala ng feedback sa account menu sa taas ng kahit anong page. Kapag na-delete ang account, buburahin din ang workspace, feedback at usage analytics nito.",
    request_email: "Nag-request ka ng access pero wala kang account? I-email kami sa {email} para mabura ang request mo.",
    request_none:
      "Nag-request ka ng access pero wala kang account? Kailangan ng contact email para makapagpabura ng request, at wala pang naka-set up sa site na 'to.",
  },
})
