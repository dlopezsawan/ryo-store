import {} from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { MarketingNav } from "../MarketingNav"
import { PatternsClient } from "./PatternsClient"

export default function PatternsPage() {
  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="◊" />

      <Breadcrumbs items={[{ label: "Marketing", href: "/marketing" }, { label: "Patrones" }]} />

      <PageHeader
        title="PATRONES"
        stamp="LIVE · BACKEND LENTO"
        stampTone="orange"
        description={`Insights agregados de toda la base de usuarios — segmentación, repetición de productos, cross-sell, funnel global. El backend tarda hasta 1 minuto en computar.`}
      />

      <MarketingNav />

      <PatternsClient />
    </div>
  )
}
