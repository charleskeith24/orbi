import type { Metadata } from "next"
import { CampaignDetailView } from "@/components/features/campaigns/campaign-detail-view"

export const metadata: Metadata = { title: "Campaign" }

export default async function Page(props: PageProps<"/campaigns/[id]">) {
  const { id } = await props.params
  return <CampaignDetailView campaignId={id} />
}
