import { NextResponse } from "next/server"
import { listCustomers, MedusaError } from "@/lib/medusa"

/**
 * GET /customers/export
 *
 * Exporta TODOS los clientes (paginando si hay >500) como CSV.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const idsParam = url.searchParams.get("ids")
  const idsFilter = idsParam ? new Set(idsParam.split(",").filter(Boolean)) : null

  let all: Awaited<ReturnType<typeof listCustomers>>["customers"] = []
  try {
    let offset = 0
    const limit = 200
    for (let i = 0; i < 20; i++) {
      const res = await listCustomers({ limit, offset })
      all = all.concat(res.customers)
      if (all.length >= res.count || res.customers.length === 0) break
      offset += limit
    }
    if (idsFilter) all = all.filter((c) => idsFilter.has(c.id))
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) {
      return NextResponse.json({ error: "session_expired" }, { status: 401 })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 })
  }

  const header = ["id", "email", "first_name", "last_name", "phone", "has_account", "cedula", "created_at"]
  const rows = all.map((c) => {
    const cedula = typeof c.metadata?.cedula === "string" ? c.metadata.cedula : ""
    return [
      c.id,
      c.email,
      c.first_name ?? "",
      c.last_name ?? "",
      c.phone ?? "",
      String(c.has_account),
      cedula,
      c.created_at,
    ].map(csvEscape).join(",")
  })

  const csv = [header.join(","), ...rows].join("\n")
  const filename = `enrola-customers-${new Date().toISOString().slice(0, 10)}.csv`
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}

function csvEscape(s: string): string {
  if (s === "") return ""
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
