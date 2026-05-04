import { NextResponse } from "next/server"
import { getPosthogOverview, listPosthogFlags, getPosthogErrors, getPosthogLlm, MedusaError } from "@/lib/medusa"
import { getSession } from "@/lib/auth"

export const maxDuration = 90
export const dynamic = "force-dynamic"

/**
 * Trae los 4 datasets de PostHog en paralelo. Si alguno falla, devolvemos el
 * resto + error parcial. Cada uno es independiente para que la UI muestre lo
 * que sí está disponible.
 */
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 })

  const [overR, flagsR, errorsR, llmR] = await Promise.allSettled([
    getPosthogOverview(),
    listPosthogFlags(),
    getPosthogErrors(7),
    getPosthogLlm(7),
  ])

  return NextResponse.json({
    ok: true,
    overview: overR.status === "fulfilled" ? overR.value : null,
    overview_error: overR.status === "rejected" ? errMsg(overR.reason) : null,
    flags: flagsR.status === "fulfilled" ? flagsR.value : null,
    flags_error: flagsR.status === "rejected" ? errMsg(flagsR.reason) : null,
    errors: errorsR.status === "fulfilled" ? errorsR.value : null,
    errors_error: errorsR.status === "rejected" ? errMsg(errorsR.reason) : null,
    llm: llmR.status === "fulfilled" ? llmR.value : null,
    llm_error: llmR.status === "rejected" ? errMsg(llmR.reason) : null,
  })
}

function errMsg(e: unknown): string {
  if (e instanceof MedusaError) return `Medusa ${e.status}: ${e.message}`
  return e instanceof Error ? e.message : "fetch error"
}
