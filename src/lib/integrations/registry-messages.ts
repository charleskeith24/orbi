import { defineMessages } from "@/lib/i18n/core"

/**
 * Display text for the integration registry (`registry.ts`) and the labels in `types.ts`. Service
 * names stay English. English here is the source the adapters are built from; `integrationText` and
 * `integrationLabels` in `registry.ts` return the Taglish versions.
 */
export const registryMessages = defineMessages({
  en: {
    connect_message: "{name} can't be connected yet — it requires {auth} that haven't been configured for this workspace.",
    auth_oauth2: "OAuth app credentials",
    auth_api_key: "API credentials",
    status_not_configured: "Not connected",
    status_disconnected: "Disconnected",
    status_connected: "Connected",
    status_error: "Connection error",
    capability_import_analytics: "Import analytics",
    capability_import_posts: "Import posts",
    capability_publish: "Publish",
    capability_schedule: "Schedule",
    capability_assets: "Assets",
    capability_design: "Design",
    category_social_label: "Social platforms",
    category_social_description: "Pull post analytics and publish from the networks you post on.",
    category_analytics_label: "Analytics",
    category_analytics_description: "Bring cross-platform numbers in from the tools you already use.",
    category_scheduling_label: "Scheduling & publishing",
    category_scheduling_description: "Hand approved content to your scheduler.",
    category_assets_label: "Assets & design",
    category_assets_description: "Keep footage, thumbnails and designs next to the content they belong to.",

    req_callback: "An OAuth redirect URL registered for your deployment",
    req_server_route: "A server-side route that stores tokens and calls the API (keys never reach the browser)",

    meta_description: "Page posts with reach, reactions, comments and shares.",
    meta_req_app: "A Meta developer app (App ID and App Secret)",
    meta_req_review: "App Review approval for Page insights permissions",
    meta_req_page: "A Facebook Page you manage",
    meta_manual: "Export post insights from Meta Business Suite and import the CSV.",

    instagram_description: "Reels and posts with reach, saves and shares for professional accounts.",
    instagram_req_account: "An Instagram professional (Business or Creator) account",
    instagram_req_app: "A Meta developer app with Instagram permissions approved in App Review",
    instagram_manual: "Export insights from Meta Business Suite and import the CSV.",

    tiktok_description: "Video views, likes, comments and shares.",
    tiktok_req_app: "A TikTok for Developers app (client key and secret)",
    tiktok_req_scopes: "Approved scopes for reading videos (and content posting to publish)",
    tiktok_manual: "Download your post analytics from TikTok and import the CSV.",

    youtube_description: "Views, watch time and average percentage viewed per video.",
    youtube_req_project: "A Google Cloud project with the YouTube Data and YouTube Analytics APIs enabled",
    youtube_req_client: "An OAuth client (client ID and secret) with a consent screen",
    youtube_manual: "Export a table from YouTube Studio analytics and import the CSV.",

    linkedin_description: "Post impressions, reactions, comments and follower growth.",
    linkedin_req_app: "A LinkedIn developer app verified by a Company Page",
    linkedin_req_access: "Approved access to LinkedIn's post analytics products",
    linkedin_manual: "Export post analytics from LinkedIn and import the CSV.",

    metricool_description: "Cross-platform analytics and scheduling from one account.",
    metricool_req_plan: "A Metricool plan that includes API access",
    metricool_req_token: "Your Metricool API token and brand ID",
    metricool_manual: "Export a Metricool report as CSV and import it.",

    social_analytics_description: "Any analytics provider with a REST API — an aggregator or data warehouse you already use.",
    social_analytics_req_credentials: "The provider's API credentials",
    social_analytics_req_mapping: "A mapping from its fields to this workspace's metrics",
    social_analytics_manual: "Export from your analytics tool as CSV — the column mapper reads most formats.",

    buffer_description: "Send approved posts to your Buffer queue.",
    buffer_req_access: "Buffer API access (developer app credentials)",
    buffer_manual: "Copy the caption from Content Studio into Buffer, then log the post here.",

    later_description: "Visual planning and scheduling for Instagram, TikTok and more.",
    later_req_partner: "Later API partner access",
    later_req_credentials: "OAuth app credentials (client ID and secret)",
    later_manual: "Schedule in Later, then log the post here once it's live.",

    google_drive_description: "Attach raw footage, thumbnails and final exports to content items.",
    google_drive_req_project: "A Google Cloud project with the Drive API enabled",
    google_drive_req_client: "An OAuth client (client ID and secret) with a consent screen",
    google_drive_manual: "Paste Drive links into the brief's reference or production notes.",

    canva_description: "Start designs from a brief and bring finished exports back.",
    canva_req_integration: "A Canva Connect integration (client ID and secret)",
    canva_manual: "Design in Canva and paste the share link into the brief.",
  },
  tl: {
    connect_message: "Hindi pa ma-connect ang {name} — kailangan nito ng {auth} na hindi pa naka-configure para sa workspace na ito.",
    auth_oauth2: "OAuth app credentials",
    auth_api_key: "API credentials",
    status_not_configured: "Hindi naka-connect",
    status_disconnected: "Na-disconnect",
    status_connected: "Naka-connect",
    status_error: "Error sa connection",
    capability_import_analytics: "Import ng analytics",
    capability_import_posts: "Import ng posts",
    capability_publish: "Publish",
    capability_schedule: "Schedule",
    capability_assets: "Assets",
    capability_design: "Design",
    category_social_label: "Social platforms",
    category_social_description: "Kunin ang post analytics at mag-publish mula sa mga network kung saan mo nag-post.",
    category_analytics_label: "Analytics",
    category_analytics_description: "Ilipat dito ang cross-platform numbers mula sa mga tool na ginagamit mo na.",
    category_scheduling_label: "Scheduling at publishing",
    category_scheduling_description: "Ipasa ang approved content sa scheduler mo.",
    category_assets_label: "Assets at design",
    category_assets_description: "Ilagay ang footage, thumbnails at designs kasama ang content kung saan nabibilang ang mga ito.",

    req_callback: "OAuth redirect URL na naka-register para sa deployment mo",
    req_server_route: "Server-side route na nag-store ng tokens at tumatawag sa API (hindi nakakarating sa browser ang keys)",

    meta_description: "Page posts kasama ang reach, reactions, comments at shares.",
    meta_req_app: "Meta developer app (App ID at App Secret)",
    meta_req_review: "App Review approval para sa Page insights permissions",
    meta_req_page: "Facebook Page na ni-manage mo",
    meta_manual: "I-export ang post insights mula Meta Business Suite at i-import ang CSV.",

    instagram_description: "Reels at posts kasama ang reach, saves at shares para sa professional accounts.",
    instagram_req_account: "Instagram professional account (Business o Creator)",
    instagram_req_app: "Meta developer app na may Instagram permissions na approved sa App Review",
    instagram_manual: "I-export ang insights mula Meta Business Suite at i-import ang CSV.",

    tiktok_description: "Video views, likes, comments at shares.",
    tiktok_req_app: "TikTok for Developers app (client key at secret)",
    tiktok_req_scopes: "Approved scopes para magbasa ng videos (at content posting para mag-publish)",
    tiktok_manual: "I-download ang post analytics mo mula TikTok at i-import ang CSV.",

    youtube_description: "Views, watch time at average percentage viewed kada video.",
    youtube_req_project: "Google Cloud project na naka-enable ang YouTube Data at YouTube Analytics APIs",
    youtube_req_client: "OAuth client (client ID at secret) na may consent screen",
    youtube_manual: "I-export ang table mula YouTube Studio analytics at i-import ang CSV.",

    linkedin_description: "Post impressions, reactions, comments at follower growth.",
    linkedin_req_app: "LinkedIn developer app na verified ng Company Page",
    linkedin_req_access: "Approved access sa post analytics products ng LinkedIn",
    linkedin_manual: "I-export ang post analytics mula LinkedIn at i-import ang CSV.",

    metricool_description: "Cross-platform analytics at scheduling mula sa isang account.",
    metricool_req_plan: "Metricool plan na may API access",
    metricool_req_token: "Ang Metricool API token at brand ID mo",
    metricool_manual: "I-export ang Metricool report bilang CSV at i-import ito.",

    social_analytics_description: "Anumang analytics provider na may REST API — aggregator o data warehouse na ginagamit mo na.",
    social_analytics_req_credentials: "Ang API credentials ng provider",
    social_analytics_req_mapping: "Mapping mula sa fields nito sa metrics ng workspace na ito",
    social_analytics_manual: "I-export mula sa analytics tool mo bilang CSV — nababasa ng column mapper ang karamihan ng formats.",

    buffer_description: "Ipadala ang approved posts sa Buffer queue mo.",
    buffer_req_access: "Buffer API access (developer app credentials)",
    buffer_manual: "I-copy ang caption mula Content Studio papunta sa Buffer, tapos i-log ang post dito.",

    later_description: "Visual planning at scheduling para sa Instagram, TikTok at iba pa.",
    later_req_partner: "Later API partner access",
    later_req_credentials: "OAuth app credentials (client ID at secret)",
    later_manual: "I-schedule sa Later, tapos i-log ang post dito kapag live.",

    google_drive_description: "I-attach ang raw footage, thumbnails at final exports sa content items.",
    google_drive_req_project: "Google Cloud project na naka-enable ang Drive API",
    google_drive_req_client: "OAuth client (client ID at secret) na may consent screen",
    google_drive_manual: "I-paste ang Drive links sa reference o production notes ng brief.",

    canva_description: "Magsimula ng designs mula sa brief at ibalik ang finished exports.",
    canva_req_integration: "Canva Connect integration (client ID at secret)",
    canva_manual: "Mag-design sa Canva at i-paste ang share link sa brief.",
  },
})
