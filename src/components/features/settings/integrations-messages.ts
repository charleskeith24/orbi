import { defineMessages } from "@/lib/i18n/core"

/** Settings → Integrations: the connection cards and the "isn't connected" dialog. Adapter text lives in lib/integrations. */
export const integrationsMessages = defineMessages({
  en: {
    connections: "Connections",
    connections_count: "{connected} / {total} connected",
    connections_info:
      "Each service needs its own developer app and a server-side OAuth callback. None are set up for this workspace, so nothing syncs automatically — use the CSV import or log posts by hand.",
    category_info: "About {name}",
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
    connections_count: "{connected} / {total} naka-connect",
    connections_info:
      "Kailangan ng bawat service ang sariling developer app at server-side OAuth callback. Wala pang naka-setup dito, kaya walang automatic na sync — gamitin ang CSV import o i-log ang posts manually.",
    category_info: "Tungkol sa {name}",
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
