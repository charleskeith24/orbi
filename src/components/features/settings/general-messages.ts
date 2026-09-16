import { defineMessages } from "@/lib/i18n/core"

/** Settings → General: the "Language & display" section and the save toast. */
export const generalMessages = defineMessages({
  en: {
    display_title: "Language & display",
    display_description: "How Orbi looks and speaks to you.",
    language_label: "App language",
    language_description: "The language of Orbi's screens. The language your content is written in is set in Brand HQ.",
    simple_label: "Simple mode",
    simple_description:
      "Show only the everyday modules in the sidebar: Home, Today, Ideas, Content Studio, Calendar, Analytics, Money and Settings. Every page stays one ⌘K away.",
    simple_on: "On — everyday modules only",
    simple_off: "Off — every module in the sidebar",
    currency_label: "Currency",
    currency_description: "The default currency for brand deals, income and rate cards. Amounts you already logged keep their own currency.",
    saved: "General settings saved",
  },
  tl: {
    display_title: "Language at display",
    display_description: "Paano mukha at paano magsalita ang Orbi sa'yo.",
    language_label: "App language",
    language_description: "Ang language ng mga screen ng Orbi. Ang language ng content mo ay nasa Brand HQ.",
    simple_label: "Simple mode",
    simple_description:
      "Mga pang-araw-araw na modules lang ang nasa sidebar: Home, Today, Ideas, Content Studio, Calendar, Analytics, Money at Settings. Lahat ng page, isang ⌘K lang ang layo.",
    simple_on: "On — pang-araw-araw na modules lang",
    simple_off: "Off — lahat ng modules nasa sidebar",
    currency_label: "Currency",
    currency_description: "Default na currency para sa brand deals, income at rate cards. Hindi magbabago ang currency ng mga na-log mo na.",
    saved: "Na-save ang General settings",
  },
})
