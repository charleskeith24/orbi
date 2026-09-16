"use client"

import { Settings } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { PageContainer, PageHeader } from "@/components/common"
import { RemindersTab } from "@/components/features/reminders/reminders-tab"
import { AiTab } from "./ai-tab"
import { DataTab } from "./data-tab"
import { EngagementTab } from "./engagement-tab"
import { FormatsTab } from "./formats-tab"
import { FunnelTab } from "./funnel-tab"
import { GeneralTab } from "./general-tab"
import { IntegrationsTab } from "./integrations-tab"
import { PerformanceTab } from "./performance-tab"
import { engagementFromSettings, funnelFromSettings, generalFromSettings, performanceFromSettings } from "./sections"
import { SettingsNav } from "./settings-nav"
import { parseSettingsTab, SETTINGS_TAB_MAP } from "./tabs"
import { TagsTab } from "./tags-tab"
import { useSettingsDraft } from "./use-settings-draft"

export function SettingsView() {
  const searchParams = useSearchParams()
  const tab = parseSettingsTab(searchParams.get("tab"))
  const openId = searchParams.get("open")
  const [now] = useState(() => new Date())

  // Drafts live here so unsaved edits survive switching tabs.
  const general = useSettingsDraft(generalFromSettings)
  const performance = useSettingsDraft(performanceFromSettings)
  const funnel = useSettingsDraft(funnelFromSettings)
  const engagement = useSettingsDraft(engagementFromSettings)
  const dirty = { general: general.dirty, performance: performance.dirty, funnel: funnel.dirty, engagement: engagement.dirty }
  const meta = SETTINGS_TAB_MAP[tab]

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        icon={Settings}
        description="Targets, thresholds, libraries, AI, integrations and your data — the rules the rest of the system runs on."
      />
      <div className="grid min-w-0 gap-5 lg:grid-cols-[11.5rem_minmax(0,1fr)] lg:gap-8">
        <SettingsNav active={tab} dirty={dirty} />
        <section aria-labelledby="settings-section-title" className="flex min-w-0 flex-col gap-4">
          <header className="min-w-0">
            <h2 id="settings-section-title" className="text-base leading-6 font-semibold">
              {meta.label}
            </h2>
            <p className="text-sm text-pretty text-muted-foreground">{meta.description}</p>
          </header>
          {tab === "general" ? <GeneralTab draft={general} now={now} /> : null}
          {tab === "performance" ? <PerformanceTab draft={performance} now={now} /> : null}
          {tab === "funnel" ? <FunnelTab draft={funnel} now={now} /> : null}
          {tab === "formats" ? <FormatsTab openId={openId} now={now} /> : null}
          {tab === "tags" ? <TagsTab openId={openId} /> : null}
          {tab === "engagement" ? <EngagementTab draft={engagement} now={now} /> : null}
          {tab === "reminders" ? <RemindersTab /> : null}
          {tab === "ai" ? <AiTab now={now} /> : null}
          {tab === "integrations" ? <IntegrationsTab now={now} /> : null}
          {tab === "data" ? <DataTab now={now} /> : null}
        </section>
      </div>
    </PageContainer>
  )
}
