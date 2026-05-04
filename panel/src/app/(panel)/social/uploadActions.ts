"use server"

import { uploadFiles, MedusaError } from "@/lib/medusa"

type UploadResult = { ok: true; urls: string[] } | { ok: false; error: string }

/**
 * Sube archivos al store Medusa via /admin/uploads y devuelve sus URLs.
 * Recibe FormData con campo `files` (uno o más).
 */
export async function uploadFileAction(fd: FormData): Promise<UploadResult> {
  try {
    const files = fd.getAll("files")
    if (files.length === 0) return { ok: false, error: "Sin archivos" }
    const res = await uploadFiles(fd)
    return { ok: true, urls: res.files.map((f) => f.url) }
  } catch (e) {
    if (e instanceof MedusaError) {
      if (e.status === 401) return { ok: false, error: "Sesión expirada" }
      return { ok: false, error: `Upload ${e.status}: ${e.message}` }
    }
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" }
  }
}
