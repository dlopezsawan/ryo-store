"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { UserPlus, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react"
import { syncSegmentToGroupAction } from "../actions"

type Toast = { kind: "ok" | "err"; msg: string } | null

interface Props {
  segmentLabel: string
  customerIds: string[]
  /** Si ya existe un grupo asociado a este segmento, su id */
  existingGroupId?: string
}

export function SegmentSyncer({ segmentLabel, customerIds, existingGroupId }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(existingGroupId ?? null)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4500)
  }

  function sync() {
    startTransition(async () => {
      const groupName = `RFM · ${segmentLabel}`
      const res = await syncSegmentToGroupAction({
        groupName,
        customerIds,
        groupId: createdGroupId ?? undefined,
      })
      if (!res.ok) return flash("err", res.error)
      flash("ok", `${res.added} customer(s) sincronizados`)
      setCreatedGroupId(res.groupId)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={sync} disabled={pending || customerIds.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50 transition-all hover:translate-x-[1px] hover:translate-y-[1px]"
          style={{ border: "1.5px solid #1A1A1A", boxShadow: "2px 2px 0 0 var(--shadow-color)" }}>
          <UserPlus size={11} strokeWidth={2.5} />
          {pending ? "Sincronizando…" : createdGroupId ? "Re-sincronizar" : "Crear grupo"}
        </button>
        {createdGroupId && (
          <a href={`/customer-groups`}
            className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-display font-bold uppercase tracking-wider text-secondary hover:text-orange">
            <ExternalLink size={10} strokeWidth={2.5} /> Ver grupo
          </a>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}
