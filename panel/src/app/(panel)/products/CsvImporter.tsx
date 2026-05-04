"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileText, AlertCircle, CheckCircle2, X } from "lucide-react"
import { importProductsCsvAction, type CsvProduct, type CsvImportResult } from "./actions"

const TEMPLATE_CSV = `title,handle,description,status,sku,price,currency_code
"Producto Demo 1",producto-demo-1,"Descripción opcional",draft,SKU-001,15.50,eur
"Producto Demo 2",producto-demo-2,,published,SKU-002,9.99,eur
`

type Toast = { kind: "ok" | "err"; msg: string } | null

/**
 * Parser CSV simple. Soporta:
 *  - Comillas dobles para campos con comas
 *  - Headers en primera línea
 *  - Trim de whitespace
 * No soporta multi-line quoted strings (no es necesario para products básicos).
 */
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { headers: [], rows: [] }

  function splitLine(line: string): string[] {
    const out: string[] = []
    let cur = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === "," && !inQuotes) {
        out.push(cur.trim())
        cur = ""
      } else {
        cur += ch
      }
    }
    out.push(cur.trim())
    return out
  }

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase())
  const rows = lines.slice(1).map(splitLine)
  return { headers, rows }
}

export function CsvImporter() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [csvText, setCsvText] = useState("")
  const [preview, setPreview] = useState<{ rows: CsvProduct[]; warnings: string[] } | null>(null)
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 5000)
  }

  function reset() {
    setCsvText("")
    setPreview(null)
    setImportResult(null)
  }

  function loadFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? "")
      setCsvText(text)
      generatePreview(text)
    }
    reader.readAsText(file)
  }

  function generatePreview(text: string) {
    const { headers, rows } = parseCsv(text)
    if (headers.length === 0) {
      setPreview({ rows: [], warnings: ["CSV vacío"] })
      return
    }
    if (!headers.includes("title")) {
      setPreview({ rows: [], warnings: [`Columna requerida "title" no encontrada. Headers: ${headers.join(", ")}`] })
      return
    }
    const titleIdx = headers.indexOf("title")
    const handleIdx = headers.indexOf("handle")
    const descIdx = headers.indexOf("description")
    const statusIdx = headers.indexOf("status")
    const skuIdx = headers.indexOf("sku")
    const priceIdx = headers.indexOf("price")
    const currencyIdx = headers.indexOf("currency_code")

    const warnings: string[] = []
    const products: CsvProduct[] = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const title = row[titleIdx]
      if (!title) {
        warnings.push(`Fila ${i + 2}: sin title, ignorada`)
        continue
      }
      const status = (row[statusIdx] ?? "").toLowerCase()
      products.push({
        title,
        handle: row[handleIdx] || undefined,
        description: row[descIdx] || undefined,
        status: status === "published" ? "published" : "draft",
        sku: row[skuIdx] || undefined,
        price: priceIdx >= 0 && row[priceIdx] ? Number(row[priceIdx]) : undefined,
        currency_code: row[currencyIdx] || (priceIdx >= 0 && row[priceIdx] ? "eur" : undefined),
      })
    }
    setPreview({ rows: products, warnings })
  }

  function doImport() {
    if (!preview) return
    startTransition(async () => {
      const res = await importProductsCsvAction(preview.rows)
      setImportResult(res)
      if (res.failed.length === 0) {
        flash("ok", `${res.ok} producto(s) creado(s)`)
        router.refresh()
      } else {
        flash("err", `${res.ok} OK · ${res.failed.length} fallaron`)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { reset(); setOpen(true) }}
        className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
        style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
      >
        <Upload size={11} strokeWidth={2.5} /> Importar CSV
      </button>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => !pending && setOpen(false)}>
          <div className="bg-page rounded-md max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto" style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink mb-1">
              Importar productos desde CSV
            </h3>
            <p className="text-[11px] text-ink-3 mb-4">
              Columnas soportadas: <code className="font-mono">title</code> (requerida),{" "}
              <code className="font-mono">handle</code>, <code className="font-mono">description</code>,{" "}
              <code className="font-mono">status</code>, <code className="font-mono">sku</code>,{" "}
              <code className="font-mono">price</code>, <code className="font-mono">currency_code</code>.{" "}
              <button type="button" onClick={() => { setCsvText(TEMPLATE_CSV); generatePreview(TEMPLATE_CSV) }}
                className="text-orange hover:underline">Cargar plantilla</button>
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={pending}
                  className="flex items-center gap-1 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
                  style={{ border: "1.5px solid var(--border)" }}
                >
                  <FileText size={11} strokeWidth={2.5} /> Subir archivo .csv
                </button>
                <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) loadFile(f)
                    e.target.value = ""
                  }} />
                <span className="text-[10px] text-ink-3 font-mono">o pega el contenido abajo</span>
              </div>

              <textarea
                value={csvText}
                onChange={(e) => { setCsvText(e.target.value); generatePreview(e.target.value) }}
                rows={8}
                placeholder="title,handle,description,status,sku,price,currency_code&#10;..."
                className="w-full px-3 py-2 bg-cream rounded-md text-[11px] font-mono focus:outline-none resize-none"
                style={{ border: "1.5px solid var(--border)" }}
              />

              {preview && (
                <div className="space-y-2">
                  {preview.warnings.length > 0 && (
                    <div className="bg-orange/5 p-3 rounded-md text-[11px] space-y-0.5" style={{ border: "1.5px solid #FF3B27" }}>
                      <p className="font-display font-bold uppercase tracking-wider text-orange mb-1">Warnings</p>
                      {preview.warnings.map((w, i) => (
                        <p key={i} className="text-ink-2 font-mono">• {w}</p>
                      ))}
                    </div>
                  )}
                  {preview.rows.length > 0 && (
                    <div className="bg-secondary/5 p-3 rounded-md" style={{ border: "1.5px solid #4D5431" }}>
                      <p className="text-[11px] font-display font-bold uppercase tracking-wider text-secondary mb-2">
                        Preview · {preview.rows.length} producto(s) listos
                      </p>
                      <div className="text-[10px] font-mono space-y-0.5 max-h-32 overflow-y-auto">
                        {preview.rows.slice(0, 10).map((p, i) => (
                          <div key={i} className="flex items-center justify-between gap-2">
                            <span className="truncate">
                              {p.title}
                              {p.sku && <span className="text-ink-3"> · {p.sku}</span>}
                            </span>
                            <span className="text-ink-3 flex-shrink-0">
                              {p.status} {p.price ? `· ${(p.currency_code ?? "eur").toUpperCase()} ${p.price}` : ""}
                            </span>
                          </div>
                        ))}
                        {preview.rows.length > 10 && (
                          <p className="text-ink-3 italic text-center pt-1">
                            + {preview.rows.length - 10} más
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {importResult && (
                <div className={`p-3 rounded-md text-[11px] ${importResult.failed.length === 0 ? "bg-secondary/5" : "bg-primary/5"}`}
                  style={{ border: `1.5px solid ${importResult.failed.length === 0 ? "#4D5431" : "#BB3B2E"}` }}>
                  <p className="font-display font-bold uppercase tracking-wider mb-1">
                    Resultado: <span className="text-secondary">{importResult.ok} OK</span>
                    {importResult.failed.length > 0 && <span className="text-primary"> · {importResult.failed.length} fallaron</span>}
                  </p>
                  {importResult.failed.length > 0 && (
                    <div className="text-[10px] font-mono space-y-0.5 max-h-40 overflow-y-auto">
                      {importResult.failed.map((f, i) => (
                        <div key={i}>fila {f.row} ({f.title}): {f.error}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button type="button" onClick={() => setOpen(false)} disabled={pending}
                className="px-4 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
                style={{ border: "1.5px solid var(--border)" }}>
                {importResult ? "Cerrar" : "Cancelar"}
              </button>
              {!importResult && (
                <button type="button" onClick={doImport}
                  disabled={pending || !preview || preview.rows.length === 0}
                  className="px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
                  style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}>
                  {pending ? "Importando…" : `Importar ${preview?.rows.length ?? 0} producto(s)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
