import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

const BASE = process.env.MEDUSA_ADMIN_URL ?? "http://localhost:9000"

/**
 * GET /api/social/export-brief
 *
 * Proxies a `GET /admin/social/export-brief` del backend Medusa con la
 * sesión del panel. Devuelve text/markdown con un Content-Disposition
 * que fuerza descarga.
 *
 * El brief incluye:
 *  - Contexto de marca (audiencia, tono, productos, colores, tipografía)
 *  - Latest AI trend brief (themes, content ideas, hashtags)
 *  - Open suggestions agrupadas por status
 *  - **Feedback no resuelto agrupado por post/story** ← lo que pidió el user
 *  - Recent published posts (14d) para continuidad de referencia
 */
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 })
  }

  try {
    const url = new URL("/admin/social/export-brief", BASE)
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${session.medusaToken}` },
      cache: "no-store",
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      return NextResponse.json(
        { ok: false, error: `Medusa ${res.status}: ${detail || res.statusText}` },
        { status: res.status === 401 ? 401 : 502 },
      )
    }

    const markdown = await res.text()
    const filename = `enrola-social-brief-${new Date().toISOString().slice(0, 10)}.md`

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch error" },
      { status: 500 },
    )
  }
}
