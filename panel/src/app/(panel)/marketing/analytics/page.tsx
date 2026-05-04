import {} from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { MarketingNav } from "../MarketingNav"
import { AnalyticsClient } from "./AnalyticsClient"

export default function AnalyticsPage() {
  // Clarity ID se lee del env público (visible al browser)
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID || "wfp9s5wh5i"

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="📊" />

      <Breadcrumbs items={[{ label: "Marketing", href: "/marketing" }, { label: "Analytics" }]} />

      <PageHeader
        title="ANALYTICS"
        stamp="LIVE STREAMING"
        stampTone="orange"
        description="PostHog (events, flags, errors, LLM) + Microsoft Clarity (heatmaps + recordings) · cada bloque carga independiente"
      />

      <MarketingNav />

      <AnalyticsClient clarityId={clarityId} />
    </div>
  )
}
