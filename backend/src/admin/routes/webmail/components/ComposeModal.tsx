import { FocusModal, Button, Input, Label, Heading, Badge } from "@medusajs/ui"
import { useState, useEffect, useRef } from "react"
import { RichTextEditor } from "./RichTextEditor"

type AttachmentFile = { name: string; size: number; data: string; type: string }

type Props = {
  open: boolean
  onClose: () => void
  onSend: (to: string, subject: string, html: string, opts?: {
    cc?: string; bcc?: string; inReplyTo?: string
    attachments?: AttachmentFile[]
  }) => Promise<void>
  defaultTo?: string
  defaultSubject?: string
  defaultBody?: string
  inReplyTo?: string
  mode?: "compose" | "reply" | "forward"
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function ComposeModal({ open, onClose, onSend, defaultTo, defaultSubject, defaultBody, inReplyTo, mode = "compose" }: Props) {
  const [to, setTo] = useState(defaultTo || "")
  const [cc, setCc] = useState("")
  const [bcc, setBcc] = useState("")
  const [subject, setSubject] = useState(defaultSubject || "")
  const [body, setBody] = useState(defaultBody || "")
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTo(defaultTo || "")
    setSubject(defaultSubject || "")
    setBody(defaultBody || "")
    setCc("")
    setBcc("")
    setShowCc(false)
    setShowBcc(false)
    setAttachments([])
  }, [defaultTo, defaultSubject, defaultBody, open])

  const title = mode === "reply" ? "Responder" : mode === "forward" ? "Reenviar" : "Nuevo email"

  const handleAttachFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const base64 = dataUrl.split(",")[1]
        setAttachments((prev) => [
          ...prev,
          { name: file.name, size: file.size, data: base64, type: file.type },
        ])
      }
      reader.readAsDataURL(file)
    })
    // Reset so same file can be re-added
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSend = async () => {
    if (!to || !subject) return
    setSending(true)
    try {
      await onSend(to, subject, body, {
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        inReplyTo: inReplyTo || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      })
      onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <FocusModal open={open} onOpenChange={(v) => !v && onClose()}>
      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex items-center justify-between w-full pr-4">
            <Heading level="h2">{title}</Heading>
            <div className="flex items-center gap-2">
              {/* Attach button */}
              <label title="Adjuntar archivo"
                className="cursor-pointer flex items-center gap-1 text-xs text-ui-fg-muted hover:text-ui-fg-base px-2 py-1 rounded hover:bg-ui-bg-base-hover transition-colors">
                📎 Adjuntar
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleAttachFiles} />
              </label>
            </div>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-col gap-3 p-6 overflow-auto">
          {/* To */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="compose-to">Para</Label>
              <div className="flex gap-3">
                {!showCc && (
                  <button type="button" onClick={() => setShowCc(true)}
                    className="text-xs text-ui-fg-muted hover:text-ui-fg-base transition-colors">
                    + CC
                  </button>
                )}
                {!showBcc && (
                  <button type="button" onClick={() => setShowBcc(true)}
                    className="text-xs text-ui-fg-muted hover:text-ui-fg-base transition-colors">
                    + CCO
                  </button>
                )}
              </div>
            </div>
            <Input id="compose-to" placeholder="destinatario@ejemplo.com"
              value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          {showCc && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="compose-cc">CC</Label>
                <button type="button" onClick={() => { setShowCc(false); setCc("") }}
                  className="text-xs text-ui-fg-muted hover:text-ui-fg-base">✕</button>
              </div>
              <Input id="compose-cc" placeholder="cc@ejemplo.com"
                value={cc} onChange={(e) => setCc(e.target.value)} />
            </div>
          )}

          {showBcc && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="compose-bcc">CCO (BCC)</Label>
                <button type="button" onClick={() => { setShowBcc(false); setBcc("") }}
                  className="text-xs text-ui-fg-muted hover:text-ui-fg-base">✕</button>
              </div>
              <Input id="compose-bcc" placeholder="bcc@ejemplo.com"
                value={bcc} onChange={(e) => setBcc(e.target.value)} />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="compose-subject">Asunto</Label>
            <Input id="compose-subject" placeholder="Asunto del email"
              value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          {/* Rich text body */}
          <div className="flex flex-col gap-1.5 flex-1">
            <Label>Mensaje</Label>
            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="Escribe tu mensaje..."
            />
          </div>

          {/* Attachments list */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <div key={i}
                  className="flex items-center gap-1.5 px-2 py-1 rounded border border-ui-border-base bg-ui-bg-subtle text-xs text-ui-fg-base">
                  <span>📎 {a.name}</span>
                  <span className="text-ui-fg-muted">({formatFileSize(a.size)})</span>
                  <button type="button" onClick={() => removeAttachment(i)}
                    className="text-ui-fg-muted hover:text-ui-fg-error ml-1">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <label title="Adjuntar archivo"
              className="cursor-pointer flex items-center gap-1 text-xs text-ui-fg-muted hover:text-ui-fg-base transition-colors">
              📎 Adjuntar archivo
              <input type="file" multiple className="hidden" onChange={handleAttachFiles} />
            </label>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} disabled={sending}>Cancelar</Button>
              <Button onClick={handleSend} disabled={sending || !to || !subject}>
                {sending ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
