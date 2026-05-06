import { NextResponse } from "next/server"
import { getDanaConversation, MedusaError } from "@/lib/medusa"
import { getSession } from "@/lib/auth"

/**
 * GET /api/dana/conversation/:phone
 *
 * Proxy panel→medusa para refrescar mensajes del thread activo desde
 * el componente cliente. Polling cada 6s mientras hay conversación
 * abierta.
 */

export async function GET(_req: Request, { params }: { params: Promise<{ phone: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "no_session" }, { status: 401 })

  const { phone } = await params
  if (!phone) return NextResponse.json({ error: "phone_required" }, { status: 400 })

  try {
    const data = await getDanaConversation(phone, { limit: 200 })
    return NextResponse.json(data)
  } catch (e) {
    if (e instanceof MedusaError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 })
  }
}
