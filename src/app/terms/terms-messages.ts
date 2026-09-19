/**
 * DRAFT — Terms of Use for the owner to review WITH A LAWYER before real people sign up. Not legal advice.
 * Plain language on purpose. Every factual sentence matches this implementation as of 2026-09-19 (sources in
 * `terms-view.tsx`); the rest are rules for users or commitments the owner makes. When the app changes, or the
 * owner changes how the beta runs, update this file and the "updated" date, and tell people as `changes_notice` says.
 *
 * Owner to confirm with the lawyer:
 * - `law_body`: governing law is the Philippines (and whether to name courts or a venue — not named yet).
 * - `who_age`: 18+ (the request form doesn't ask for age; agreeing to these terms is the only check).
 * - `beta_end` and `changes_notice` are promises: there's no in-app announcement tool, so the owner emails
 *   people by hand (addresses are in Admin → Users).
 * - Missing on purpose until a lawyer words them: limitation of liability, indemnity, termination by the user,
 *   dispute resolution, and any price (Orbi has no billing).
 * `{privacy}` is a link to /privacy. Contact and deletion lines are shared: ../privacy/legal-messages.ts.
 */
import { defineMessages } from "@/lib/i18n/core"

export const termsMessages = defineMessages({
  en: {
    title: "Terms of Use",
    updated: "Last updated September 19, 2026",
    intro:
      "The rules for using Orbi, in plain language. By asking for access or using your Orbi account, you agree to them. The {privacy} explains what Orbi stores and who can see it.",

    beta_title: "Orbi is in private beta",
    beta_changes: "Orbi is still being built. Features can change, move or be removed, sometimes without notice.",
    beta_bugs:
      "Expect bugs and downtime. Export your workspace regularly (Settings → Data → Export workspace) so you always have your own copy.",
    beta_as_is: "Orbi is provided as it is. We can't promise it will be error-free or always available.",
    beta_end: "We may pause or end the beta. If we do, we'll try to tell you first so you can export your workspace.",

    who_title: "Who can use Orbi",
    who_age: "You must be 18 or older.",
    who_invite: "Accounts are by invitation: an admin approves your access request or invites you directly.",
    who_personal: "Your account is just for you. Don't share it or let anyone else use it.",

    own_title: "Your content is yours",
    own_yours: "You own what you put into Orbi: your brand, ideas, scripts, posts, analytics and money records.",
    own_store:
      "Orbi stores it only to run the service for you — to save it, show it back to you and, when Claude-powered AI is on, send the text a generation needs to the AI provider. The {privacy} has the details.",

    ai_title: "AI suggestions and the Content Score",
    ai_review:
      "AI suggestions (ideas, hooks, scripts, captions and Content Strategist answers) can be wrong, generic or similar to what other creators get. Review and edit them before you post — what you publish is your responsibility.",
    ai_score:
      "The Content Score rates a draft's quality: hook, relevance, value, clarity, authenticity and call to action. It's a quality evaluation, not a prediction of views or virality.",
    ai_no_guarantee:
      "Orbi doesn't guarantee growth, reach, followers, engagement or income. Analytics and recommendations are based on the numbers you add; they aren't promises.",
    ai_money: "Money tools (brand deals, income and rate cards) help you keep records. They aren't tax, legal or financial advice.",

    use_title: "Acceptable use",
    use_platforms:
      "Follow the rules of every platform you post to, and label paid partnerships the way the platform and the law require.",
    use_no_pods: "No engagement pods, fake engagement, bought followers or spam — and don't use Orbi to organize them.",
    use_no_scraping:
      "Don't scrape or bulk-copy Orbi, and don't try to break, overload or get around its security, or get into anyone else's account.",
    use_legal:
      "Nothing illegal, harassing, hateful or misleading, and nothing that infringes someone else's copyright, trademark or privacy. Posts you save as research are for studying — don't repost other creators' work as your own.",
    use_collabs: "Collabs and Circles: treat other creators with respect. Don't pressure, spam or mislead the people you pitch or work with.",
    use_partner_details:
      "Partner details you type in — names, handles, contact details and notes — are your responsibility. Only save what they'd be fine with you keeping, and delete it if they ask.",
    use_circles:
      "What members share in a Circle stays in that circle. Don't pass on anyone's check-ins, asks or contact details without their OK.",
    use_profile:
      "Your profile photo and details must be yours and appropriate: no one else's photo or name, and nothing misleading, hateful or explicit. Admins may remove a profile photo that breaks these rules.",

    account_title: "Your account",
    account_password:
      "Keep your password safe and don't reuse one from another site. If you think someone else got into your account, tell us right away.",
    account_disable:
      "Admins can disable an account that breaks these terms. A disabled account can't sign in; its workspace stays as it is.",

    data_title: "Your data",
    data_export: "Export any time: Settings → Data → Export workspace downloads a JSON file with everything in your workspace.",
    data_privacy: "The {privacy} explains what Orbi stores, who can see it and where it's kept.",

    changes_title: "Changes to these terms",
    changes_date: "We'll update these terms as Orbi changes. The date at the top shows when they last changed.",
    changes_notice: "If a change affects what you agree to, we'll email the address on your account before it takes effect.",
    changes_continue:
      "If you keep using Orbi after that, the new terms apply. If you don't agree, stop using Orbi and ask us to delete your account.",

    law_title: "Governing law",
    law_body: "These terms are governed by the laws of the Republic of the Philippines.",
  },
  tl: {
    title: "Terms of Use",
    updated: "Huling na-update noong September 19, 2026",
    intro:
      "Ang rules sa paggamit ng Orbi, sa simpleng salita. Kapag nag-request ka ng access o ginamit mo ang Orbi account mo, agree ka na sa mga ito. Nasa {privacy} kung ano ang sine-save ng Orbi at sino ang nakakakita.",

    beta_title: "Private beta pa ang Orbi",
    beta_changes: "Ginagawa pa ang Orbi. Puwedeng magbago, lumipat o matanggal ang features, minsan nang walang abiso.",
    beta_bugs:
      "Asahan ang bugs at downtime. Mag-export ng workspace mo nang madalas (Settings → Data → Export workspace) para laging may sarili kang kopya.",
    beta_as_is: "Ibinibigay ang Orbi as is. Hindi namin maipapangako na walang error ito o laging available.",
    beta_end: "Puwede naming i-pause o tapusin ang beta. Kapag ganoon, susubukan naming sabihan ka muna para ma-export mo ang workspace mo.",

    who_title: "Sino ang puwedeng gumamit ng Orbi",
    who_age: "Dapat 18 years old ka pataas.",
    who_invite: "By invitation ang accounts: ina-approve ng admin ang access request mo, o direkta ka niyang ini-invite.",
    who_personal: "Para sa'yo lang ang account mo. Huwag itong i-share o ipagamit sa iba.",

    own_title: "Sa'yo ang content mo",
    own_yours: "Sa'yo ang lahat ng inilalagay mo sa Orbi: brand, ideas, scripts, posts, analytics at money records mo.",
    own_store:
      "Sine-save lang ito ng Orbi para mapatakbo ang serbisyo para sa'yo — para ma-save, maipakita ulit sa'yo at, kapag naka-on ang Claude-powered AI, maipadala sa AI provider ang text na kailangan ng isang generation. Nasa {privacy} ang details.",

    ai_title: "AI suggestions at ang Content Score",
    ai_review:
      "Puwedeng mali, generic o kahawig ng nakukuha ng ibang creators ang AI suggestions (ideas, hooks, scripts, captions at sagot ng Content Strategist). I-review at i-edit muna bago mag-post — responsibilidad mo ang pino-post mo.",
    ai_score:
      "Nire-rate ng Content Score ang quality ng draft: hook, relevance, value, clarity, authenticity at call to action. Quality evaluation ito, hindi prediction ng views o virality.",
    ai_no_guarantee:
      "Walang garantiya ang Orbi sa growth, reach, followers, engagement o income. Base sa numbers na idinadagdag mo ang analytics at recommendations; hindi ito mga pangako.",
    ai_money: "Tumutulong ang money tools (brand deals, income at rate cards) na mag-record. Hindi ito tax, legal o financial advice.",

    use_title: "Tamang paggamit",
    use_platforms:
      "Sundin ang rules ng bawat platform na pinagpo-post-an mo, at i-label ang paid partnerships ayon sa hinihingi ng platform at ng batas.",
    use_no_pods: "Bawal ang engagement pods, fake engagement, biniling followers at spam — at huwag gamitin ang Orbi para i-organize ang mga ito.",
    use_no_scraping:
      "Huwag i-scrape o i-bulk copy ang Orbi, at huwag subukang sirain, i-overload o lusutan ang security nito, o pasukin ang account ng iba.",
    use_legal:
      "Bawal ang illegal, nanghaharass, hateful o misleading, at bawal ang lumalabag sa copyright, trademark o privacy ng iba. Pang-aral ang posts na sine-save mo bilang research — huwag i-repost ang gawa ng ibang creators na parang sa'yo.",
    use_collabs: "Collabs at Circles: respetuhin ang ibang creators. Huwag i-pressure, i-spam o lokohin ang mga pini-pitch-an o kasama mo.",
    use_partner_details:
      "Responsibilidad mo ang partner details na tina-type mo — pangalan, handle, contact details at notes. I-save lang ang okay sa kanila na itabi mo, at burahin kapag hiniling nila.",
    use_circles:
      "Sa loob lang ng Circle ang shine-share ng members doon. Huwag ipasa ang check-ins, asks o contact details ng iba nang walang paalam sa kanila.",
    use_profile:
      "Dapat sa'yo at angkop ang profile photo at details mo: hindi photo o pangalan ng iba, at walang misleading, hateful o explicit. Puwedeng tanggalin ng admins ang profile photo na lumalabag dito.",

    account_title: "Ang account mo",
    account_password:
      "Ingatan ang password mo at huwag gumamit ng password na gamit mo na sa ibang site. Kung sa tingin mo may ibang nakapasok sa account mo, sabihan kami agad.",
    account_disable:
      "Puwedeng i-disable ng admins ang account na lumalabag sa terms na 'to. Hindi makakapag-sign in ang disabled na account; mananatili ang workspace nito.",

    data_title: "Ang data mo",
    data_export: "Mag-export anytime: Settings → Data → Export workspace — magda-download ng JSON file na nandoon lahat ng nasa workspace mo.",
    data_privacy: "Nasa {privacy} kung ano ang sine-save ng Orbi, sino ang nakakakita at saan ito nakatago.",

    changes_title: "Mga pagbabago sa terms",
    changes_date: "Ia-update namin ang terms na 'to habang nagbabago ang Orbi. Nasa taas ang petsa ng huling pagbabago.",
    changes_notice: "Kapag may pagbabagong nakakaapekto sa pinag-agree-han mo, ie-email namin ang address ng account mo bago ito magsimula.",
    changes_continue:
      "Kung gagamitin mo pa rin ang Orbi pagkatapos noon, ang bagong terms na ang susundin. Kung hindi ka agree, itigil ang paggamit ng Orbi at ipa-delete sa amin ang account mo.",

    law_title: "Governing law",
    law_body: "Batas ng Republic of the Philippines ang sinusunod ng terms na 'to.",
  },
})
