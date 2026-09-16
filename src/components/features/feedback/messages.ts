import { defineMessages } from "@/lib/i18n/core"

/** Feedback button + dialog in the top bar, and the usage-analytics opt-in. */
export const m = defineMessages({
  en: {
    // Top-bar button
    button_label: "Feedback",
    button_aria: "Send feedback",
    button_tooltip: "Tell the Orbi team what to fix or add",

    // Dialog
    title: "Send feedback",
    description_online: "It goes straight to the Orbi team, together with the page you're on.",
    description_local: "Tell the Orbi team what to fix, add or keep.",
    kind_label: "What kind of feedback?",
    kind_bug: "Bug",
    kind_idea: "Idea",
    kind_confusing: "Confusing",
    kind_praise: "Praise",
    kind_error: "Pick what kind of feedback this is.",
    message_label: "Your feedback",
    placeholder_bug: "What happened, and what did you expect instead?",
    placeholder_idea: "What would make Orbi more useful for you?",
    placeholder_confusing: "What was hard to understand or find?",
    placeholder_praise: "What do you like? We'll keep it.",
    placeholder_default: "Write your feedback…",
    message_error: "Write your feedback first.",
    page_label: "Page: {page}",
    page_attached: "attached automatically",
    shortcut: "to send",
    cancel: "Cancel",

    // Online version
    send: "Send feedback",
    sending: "Sending…",
    sent_toast: "Thanks — feedback sent",
    sent_toast_body: "The Orbi team reads every message.",
    error_signed_out: "You're signed out. Sign in again, then send it.",
    error_offline: "You're offline. Copy your feedback, or send it when you're back online.",
    error_generic: "Couldn't send your feedback — try again.",
    copy_instead: "Copy instead",

    // Local mode
    local_title: "This copy of Orbi can't send feedback",
    local_body:
      "You're using the local version: everything stays in this browser, so nothing is sent anywhere. Copy your feedback and send it to the Orbi team by email or chat.",
    copy: "Copy feedback",
    copied_toast: "Feedback copied",
    copied_toast_body: "Paste it into an email or chat to the Orbi team.",
    copy_failed: "Couldn't copy — select the text and copy it yourself.",
    copy_heading: "Orbi feedback — {kind}",
    copy_page: "Page: {page}",
    copy_context: "Language: {lang} · Screen: {viewport}",
    copy_date: "Date: {date}",

    // Usage analytics opt-in
    usage_title: "Share anonymous usage data",
    usage_body:
      "Helps the Orbi team see which pages and setup steps get used. Only page names, step names and counts of key actions — never your ideas, posts or anything you type. Saved on this device; turn it off anytime.",
    usage_on: "Usage sharing is on for this device.",
    usage_off: "Usage sharing is off.",
  },
  tl: {
    button_label: "Feedback",
    button_aria: "Magpadala ng feedback",
    button_tooltip: "Sabihin sa Orbi team kung ano ang aayusin o idadagdag",

    title: "Magpadala ng feedback",
    description_online: "Diretso ito sa Orbi team, kasama ang page kung nasaan ka.",
    description_local: "Sabihin sa Orbi team kung ano ang aayusin, idadagdag o dapat manatili.",
    kind_label: "Anong klaseng feedback?",
    kind_bug: "Bug",
    kind_idea: "Idea",
    kind_confusing: "Nakakalito",
    kind_praise: "Gusto ko 'to",
    kind_error: "Piliin kung anong klaseng feedback ito.",
    message_label: "Ang feedback mo",
    placeholder_bug: "Ano'ng nangyari, at ano sana ang inaasahan mo?",
    placeholder_idea: "Ano ang magpapa-useful pa sa Orbi para sa'yo?",
    placeholder_confusing: "Ano ang mahirap intindihin o hanapin?",
    placeholder_praise: "Ano ang gusto mo? Itutuloy namin 'yan.",
    placeholder_default: "Isulat ang feedback mo…",
    message_error: "Isulat muna ang feedback mo.",
    page_label: "Page: {page}",
    page_attached: "kasama na automatic",
    shortcut: "para i-send",
    cancel: "Cancel",

    send: "I-send ang feedback",
    sending: "Sine-send…",
    sent_toast: "Salamat — na-send na ang feedback",
    sent_toast_body: "Binabasa ng Orbi team ang bawat message.",
    error_signed_out: "Naka-sign out ka. Mag-sign in ulit, tapos i-send.",
    error_offline: "Offline ka. I-copy muna ang feedback mo, o i-send pag online ka na ulit.",
    error_generic: "Hindi na-send ang feedback mo — subukan ulit.",
    copy_instead: "I-copy na lang",

    local_title: "Hindi makakapag-send ng feedback ang Orbi na ito",
    local_body:
      "Local version ang gamit mo: nasa browser na ito lang ang lahat, kaya walang naise-send kahit saan. I-copy ang feedback mo at i-send sa Orbi team through email o chat.",
    copy: "I-copy ang feedback",
    copied_toast: "Na-copy ang feedback",
    copied_toast_body: "I-paste sa email o chat papunta sa Orbi team.",
    copy_failed: "Hindi ma-copy — i-select ang text at i-copy mo nang manual.",
    copy_heading: "Orbi feedback — {kind}",
    copy_page: "Page: {page}",
    copy_context: "Language: {lang} · Screen: {viewport}",
    copy_date: "Date: {date}",

    usage_title: "I-share ang anonymous usage data",
    usage_body:
      "Makakatulong ito para makita ng Orbi team kung aling pages at setup steps ang ginagamit. Page names, step names at bilang ng key actions lang — hindi kailanman ang ideas, posts o anumang tina-type mo. Naka-save sa device na ito; puwede mong i-off anytime.",
    usage_on: "Naka-on ang usage sharing sa device na ito.",
    usage_off: "Naka-off ang usage sharing.",
  },
})
