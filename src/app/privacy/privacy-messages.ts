/**
 * DRAFT — privacy notice for the owner to review before launch (docs/ADMIN_BRIEF.md §6). Not legal advice.
 * Every sentence states a fact of this implementation as of 2026-09-19 (the tables, routes and settings named
 * in the comments of `privacy-view.tsx`). When the app changes what it stores or who can see it, update this
 * file. The contact and deletion lines shared with /terms are in `legal-messages.ts`; the contact email is
 * `NEXT_PUBLIC_CONTACT_EMAIL` (owner to-do: set it before real people sign up — docs/DEPLOY.md step 4).
 */
import { defineMessages } from "@/lib/i18n/core"

export const privacyMessages = defineMessages({
  en: {
    title: "Privacy notice",
    updated: "Last updated September 19, 2026",
    intro: "A plain-language summary of what Orbi stores, who can see it, where it's kept, and how to take it with you or delete it.",

    stores_title: "What Orbi stores",
    stores_account_title: "Your account",
    stores_account:
      "Your email, your name if you give one, your password (stored hashed by Supabase, never in plain text), when you joined and last signed in, and — for admins — whether 2-step verification is on.",
    stores_workspace_title: "Your workspace",
    stores_workspace:
      "Everything you add in Orbi: your brand, audience, ideas, content, scripts, analytics you log, money records, collabs and settings. For collabs, that includes the names, handles and links you type in for the creators you work with; they aren't told and can't see it. Row-level security in the database lets only your account read it.",
    stores_requests_title: "Access requests",
    stores_requests:
      "When you ask to join: your name, email, what you create and the link you share, with the date. Orbi uses them only to decide on access. No IP address is stored.",
    stores_feedback_title: "Feedback",
    stores_feedback:
      "What you write in the Feedback dialog, plus the page you were on (without anything after “?” or “#”), the app language, your screen size (phone, tablet or desktop), your browser type and the app version.",
    stores_usage_title: "Usage analytics — only if you turn it on",
    stores_usage:
      "Off by default and chosen per device. When on: page names, setup step names and counts of key actions (like “an idea was captured”). Never your ideas, posts or anything else you type.",

    stores_circles_title: "Collab Circles — only if you join one",
    stores_circles:
      "The circles you create or join, the name you use in each, your weekly check-ins (the number of posts you choose to share and an optional note), collab asks and interests, and the contact you choose to share. Leaving a circle deletes what you wrote in it.",
    see_circles:
      "Members of a circle see its names, check-ins and asks. Your contact is shown only to a member linked to you by an accepted collab ask, and theirs only to you. Admins can't see circles.",

    see_title: "Who can see what",
    see_you: "You can see and change everything in your workspace.",
    see_admins:
      "Orbi's admins see account details (email, name, status, join and last sign-in dates, whether setup is finished, whether 2-step verification is on) and counts (how many ideas, content items and published posts you have). They never see your ideas, scripts, posts or anything else inside your workspace.",
    see_admins_read: "Admins read access requests and the feedback people send, because both are written to the Orbi team.",
    see_audit:
      "Every change an admin makes to an account or an access request is recorded in an audit log, with the email it was about. Log entries stay after an account is deleted.",

    hosting_title: "Where it's kept",
    hosting_supabase: "Supabase — the database and sign-in. It also sends the sign-in and invite emails.",
    hosting_vercel: "Vercel — the website itself.",
    hosting_ai:
      "Anthropic — only when the online version has Claude-powered AI turned on: the text a generation needs (your Brand HQ context and your request) is sent to write the answer. Without it, Orbi uses its offline templates.",

    control_title: "Take it with you or delete it",
    control_export: "Export: Settings → Data → Export workspace downloads a JSON file with everything in your workspace.",
    control_clear: "Clear: Settings → Data → Start fresh replaces everything in your workspace.",
    control_usage: "Usage analytics: turn it on or off anytime in the Feedback dialog.",

    storage_title: "Cookies and browser storage",
    storage_body:
      "Sign-in uses Supabase session cookies, and one more cookie remembers whether the sidebar is open. Your browser keeps small preferences on this device (theme, app language, your usage-analytics choice, view settings) and, for the open tab only, unsaved drafts from Content Studio and the Idea Generator.",

    local_title: "The local version",
    local_body:
      "If you use Orbi without an account (local mode), your workspace stays in this browser. There are no accounts, access requests, feedback or usage analytics sent anywhere.",
  },
  tl: {
    title: "Privacy notice",
    updated: "Huling na-update noong September 19, 2026",
    intro: "Simpleng buod kung ano ang sine-save ng Orbi, sino ang nakakakita, saan ito nakatago, at paano mo ito makukuha o mabubura.",

    stores_title: "Ano ang sine-save ng Orbi",
    stores_account_title: "Ang account mo",
    stores_account:
      "Ang email mo, pangalan mo kung ibinigay mo, password mo (naka-hash sa Supabase, hindi kailanman plain text), kailan ka sumali at huling nag-sign in, at — para sa admins — kung naka-on ang 2-step verification.",
    stores_workspace_title: "Ang workspace mo",
    stores_workspace:
      "Lahat ng idinadagdag mo sa Orbi: brand, audience, ideas, content, scripts, analytics na nilo-log mo, money records, collabs at settings. Sa collabs, kasama rito ang pangalan, handle at link ng mga creator na kasama mo na ikaw mismo ang nag-type; hindi sila inaabisuhan at hindi nila ito nakikita. Dahil sa row-level security sa database, account mo lang ang nakakabasa nito.",
    stores_requests_title: "Access requests",
    stores_requests:
      "Kapag nag-request kang sumali: pangalan, email, anong content mo at ang link na binigay mo, kasama ang petsa. Ginagamit lang ito ng Orbi para magdesisyon sa access. Walang IP address na sine-save.",
    stores_feedback_title: "Feedback",
    stores_feedback:
      "Ang sinulat mo sa Feedback dialog, kasama ang page kung nasaan ka (walang kasamang kahit ano pagkatapos ng “?” o “#”), app language, laki ng screen (phone, tablet o desktop), klase ng browser at app version.",
    stores_usage_title: "Usage analytics — kung i-on mo lang",
    stores_usage:
      "Naka-off by default at pinipili kada device. Kapag naka-on: pangalan ng pages, pangalan ng setup steps at bilang ng mahahalagang action (gaya ng “may na-capture na idea”). Hindi kailanman ang ideas, posts o kahit anong tina-type mo.",

    stores_circles_title: "Collab Circles — kung sasali ka lang",
    stores_circles:
      "Ang mga circle na ginawa o sinalihan mo, ang pangalang gamit mo sa bawat isa, ang weekly check-ins mo (ang bilang ng posts na pinili mong i-share at optional na note), collab asks at interests, at ang contact na pinili mong i-share. Kapag umalis ka sa circle, buburahin ang mga isinulat mo roon.",
    see_circles:
      "Nakikita ng mga miyembro ng circle ang mga pangalan, check-ins at asks doon. Ipinapakita lang ang contact mo sa miyembrong naka-link sa'yo sa isang na-accept na collab ask, at ang sa kanila sa'yo lang. Hindi nakikita ng admins ang circles.",

    see_title: "Sino ang nakakakita ng ano",
    see_you: "Nakikita at nababago mo ang lahat sa workspace mo.",
    see_admins:
      "Ang mga admin ng Orbi ay nakakakita ng account details (email, pangalan, status, petsa ng pagsali at huling sign-in, kung tapos na ang setup, kung naka-on ang 2-step verification) at counts (ilan ang ideas, content items at published posts mo). Hindi nila kailanman nakikita ang ideas, scripts, posts o kahit ano sa loob ng workspace mo.",
    see_admins_read: "Binabasa ng admins ang access requests at ang feedback na pinapadala, kasi pareho itong para sa Orbi team.",
    see_audit:
      "Nire-record sa audit log ang bawat binabago ng admin sa isang account o access request, kasama ang email na tinutukoy nito. Nananatili ang log entries kahit na-delete na ang account.",

    hosting_title: "Saan ito nakatago",
    hosting_supabase: "Supabase — ang database at sign-in. Ito rin ang nagpapadala ng sign-in at invite emails.",
    hosting_vercel: "Vercel — ang website mismo.",
    hosting_ai:
      "Anthropic — kapag naka-on lang ang Claude-powered AI sa online version: pinapadala ang text na kailangan ng isang generation (Brand HQ context mo at ang request mo) para isulat ang sagot. Kapag wala, offline templates ang gamit ng Orbi.",

    control_title: "Kunin o burahin",
    control_export: "I-export: Settings → Data → Export workspace — magda-download ng JSON file na nandoon lahat ng nasa workspace mo.",
    control_clear: "I-clear: Settings → Data → Start fresh — papalitan ang lahat ng nasa workspace mo.",
    control_usage: "Usage analytics: i-on o i-off anytime sa Feedback dialog.",

    storage_title: "Cookies at browser storage",
    storage_body:
      "Gumagamit ang sign-in ng Supabase session cookies, at may isa pang cookie na nakakaalala kung bukas ang sidebar. Nakatabi sa device na 'to ang maliliit na preference (theme, app language, ang pinili mo sa usage analytics, view settings) at, para sa bukas na tab lang, ang hindi pa naa-save na drafts mula sa Content Studio at Idea Generator.",

    local_title: "Ang local version",
    local_body:
      "Kung gamit mo ang Orbi nang walang account (local mode), nasa browser na 'to lang ang workspace mo. Walang accounts, access requests, feedback o usage analytics na pinapadala kahit saan.",
  },
})
