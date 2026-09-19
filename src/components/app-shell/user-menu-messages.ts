import { defineMessages } from "@/lib/i18n/core"

/** The account menu in the sidebar footer (online version; local mode shows the device-only profile). */
export const userMenuMessages = defineMessages({
  en: {
    menu_label: "Account menu — {name}",
    profile: "Profile",
    your_profile: "Your profile",
    local_subtitle: "Local mode · this device",
    settings: "Settings",
    set_password: "Set a password",
    admin: "Admin",
    sign_out: "Sign out",
    sign_in: "Sign in",
  },
  tl: {
    menu_label: "Account menu — {name}",
    profile: "Profile",
    your_profile: "Profile mo",
    local_subtitle: "Local mode · device na 'to",
    settings: "Settings",
    set_password: "Mag-set ng password",
    admin: "Admin",
    sign_out: "Mag-sign out",
    sign_in: "Mag-sign in",
  },
})
