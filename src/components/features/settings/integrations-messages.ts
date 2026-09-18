import { defineMessages } from "@/lib/i18n/core"

/** Settings → Integrations: the connection cards and the "isn't connected" dialog. Adapter text lives in lib/integrations. */
export const integrationsMessages = defineMessages({
  en: {
    connections: "Connections",
    connections_description:
      "{connected} of {total} connected. Each service needs its own developer app and a server-side OAuth callback; none are set up for this workspace, so nothing syncs automatically — use the CSV import or log posts by hand.",
    capabilities_aria: "Capabilities",
    requires: "Requires {auth}",
    connect: "Connect",
    connect_aria: "Connect {name}",
    not_connected_title: "{name} isn't connected",
    needs: "What a real connection needs",
    works_today: "What works today",
    import_csv: "Import a CSV",
    log_post: "Log a published post",
    open_studio: "Open Content Studio",
  },
  tl: {
    connections: "Mga connection",
    connections_description:
      "{connected} ng {total} naka-connect. Kailangan ng bawat service ang sariling developer app at server-side OAuth callback; walang naka-setup para sa workspace na ito, kaya walang automatic na sync — gamitin ang CSV import o i-log ang posts manually.",
    capabilities_aria: "Mga capability",
    requires: "Kailangan ng {auth}",
    connect: "I-connect",
    connect_aria: "I-connect ang {name}",
    not_connected_title: "Hindi naka-connect ang {name}",
    needs: "Ano ang kailangan para sa totoong connection",
    works_today: "Ano ang gumagana ngayon",
    import_csv: "Mag-import ng CSV",
    log_post: "I-log ang published post",
    open_studio: "Buksan ang Content Studio",
  },
})
