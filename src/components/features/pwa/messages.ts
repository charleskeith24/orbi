import { defineMessages } from "@/lib/i18n/core"

/** PWA copy: installing Orbi, the /share page and the offline page served by the service worker. */
export const m = defineMessages({
  en: {
    // Install
    install_label: "Install Orbi",
    install_hint: "Open Orbi from your home screen, full screen",
    installed_toast: "Orbi is installed",
    installed_toast_body: "Open it from your home screen or app list.",
    prompt_failed: "Couldn't open the install prompt. Use your browser menu instead.",
    got_it: "Got it",

    ios_title: "Add Orbi to your Home Screen",
    ios_description: "Orbi opens full screen like an app, and pages you've opened keep working offline.",
    ios_step_share: "Tap the Share button (the square with an arrow).",
    ios_step_add: "Scroll down and tap “Add to Home Screen”.",
    ios_step_confirm: "Tap “Add”. Orbi appears on your Home Screen.",
    ios_share_note: "On iPhone, other apps can't share straight into Orbi. Copy the text or link, open Orbi and use Quick Capture.",

    android_title: "Install Orbi",
    android_description: "Your browser can add Orbi to your home screen.",
    android_step_menu: "Open your browser menu (⋮).",
    android_step_install: "Tap “Install app” or “Add to Home screen”.",
    android_share_note: "Once installed, Orbi shows up when you share from other apps, and what you share lands in Quick Capture.",

    mac_title: "Add Orbi to your Dock",
    mac_description: "Safari can keep Orbi in its own window, like an app.",
    mac_step_menu: "In the menu bar, choose File → Add to Dock.",
    mac_step_add: "Click “Add”. Orbi opens from the Dock.",

    // /share
    share_title: "Capture into Orbi",
    share_description: "Shared from another app. Save it to the Idea Bank with Quick Capture.",
    shared_label: "What you shared",
    open_capture: "Open Quick Capture",
    saved_title: "Saved to your Idea Bank",
    open_idea: "Open idea",
    go_ideas: "Go to Idea Bank",
    go_today: "Back to Today",
    empty_title: "Share straight into Orbi",
    empty_description:
      "Install Orbi on Android, then pick Orbi from any app's Share menu. The text or link lands in Quick Capture, ready to save as an idea.",
    android_note_title: "On Android",
    android_note: "After you install Orbi, it appears in the Share menu of other apps.",
    iphone_note_title: "On iPhone",
    iphone_note:
      "Add to Home Screen works, but iPhone doesn't let other apps share into web apps. Copy the text or link, then use Quick Capture.",

    // Offline page (rendered by the service worker)
    offline_title: "You're offline",
    offline_body: "This page isn't saved on this device yet. Pages you've opened before still work offline.",
    offline_today: "Open Today",
    offline_retry: "Try again",
  },
  tl: {
    install_label: "I-install ang Orbi",
    install_hint: "Buksan ang Orbi sa home screen mo, full screen",
    installed_toast: "Na-install na ang Orbi",
    installed_toast_body: "Buksan mo ito sa home screen o sa app list mo.",
    prompt_failed: "Hindi mabuksan ang install prompt. Gamitin na lang ang menu ng browser mo.",
    got_it: "Sige",

    ios_title: "Idagdag ang Orbi sa Home Screen mo",
    ios_description: "Bubukas ang Orbi nang full screen na parang app, at gagana pa rin offline ang mga page na nabuksan mo na.",
    ios_step_share: "I-tap ang Share button (yung square na may arrow).",
    ios_step_add: "Mag-scroll pababa at i-tap ang “Add to Home Screen”.",
    ios_step_confirm: "I-tap ang “Add”. Lalabas na ang Orbi sa Home Screen mo.",
    ios_share_note: "Sa iPhone, hindi puwedeng mag-share diretso sa Orbi mula sa ibang apps. I-copy ang text o link, buksan ang Orbi, tapos gamitin ang Quick Capture.",

    android_title: "I-install ang Orbi",
    android_description: "Kaya ng browser mo na idagdag ang Orbi sa home screen mo.",
    android_step_menu: "Buksan ang menu ng browser mo (⋮).",
    android_step_install: "I-tap ang “Install app” o “Add to Home screen”.",
    android_share_note: "Pag naka-install na, lalabas ang Orbi kapag nag-share ka mula sa ibang apps, at diretso sa Quick Capture ang shinare mo.",

    mac_title: "Idagdag ang Orbi sa Dock mo",
    mac_description: "Kaya ng Safari na ilagay ang Orbi sa sarili nitong window, parang app.",
    mac_step_menu: "Sa menu bar, piliin ang File → Add to Dock.",
    mac_step_add: "I-click ang “Add”. Bubukas na ang Orbi mula sa Dock.",

    share_title: "I-capture sa Orbi",
    share_description: "Galing sa ibang app. I-save sa Idea Bank gamit ang Quick Capture.",
    shared_label: "Ang shinare mo",
    open_capture: "Buksan ang Quick Capture",
    saved_title: "Naka-save na sa Idea Bank mo",
    open_idea: "Buksan ang idea",
    go_ideas: "Pumunta sa Idea Bank",
    go_today: "Balik sa Today",
    empty_title: "Mag-share diretso sa Orbi",
    empty_description:
      "I-install ang Orbi sa Android, tapos piliin ang Orbi sa Share menu ng kahit anong app. Mapupunta ang text o link sa Quick Capture, ready nang i-save bilang idea.",
    android_note_title: "Sa Android",
    android_note: "Pag na-install mo na ang Orbi, lalabas ito sa Share menu ng ibang apps.",
    iphone_note_title: "Sa iPhone",
    iphone_note:
      "Gumagana ang Add to Home Screen, pero hindi pinapayagan ng iPhone na mag-share ang ibang apps papunta sa web apps. I-copy ang text o link, tapos gamitin ang Quick Capture.",

    offline_title: "Offline ka ngayon",
    offline_body: "Hindi pa naka-save ang page na ito sa device mo. Gumagana pa rin offline ang mga page na nabuksan mo na.",
    offline_today: "Buksan ang Today",
    offline_retry: "Subukan ulit",
  },
})
