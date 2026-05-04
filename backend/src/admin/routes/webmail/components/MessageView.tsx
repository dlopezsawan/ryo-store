import { Container, Heading, Text, Button, Badge, Skeleton } from "@medusajs/ui"
import { useRef, useEffect } from "react"

type MessageDetail = {
  uid: number; from: string; to: string; cc: string
  subject: string; date: string; html: string; text: string
  seen: boolean; attachments: { filename: string; size: number; contentType: string }[]
}

type Props = {
  message: MessageDetail | null
  loading: boolean
  onClose: () => void
  onReply: () => void
  onForward: () => void
  onDelete: (uid: number) => void
  onMarkUnread: (uid: number) => void
}

function formatFullDate(iso: string): string {
  if (!iso) return ""
  return new Date(iso).toLocaleString("es", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function SanitizedHtml({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument
    if (!doc) return
    doc.open()
    doc.write(`
      <!DOCTYPE html>
      <html><head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, system-ui, sans-serif; font-size: 14px; color: #333; margin: 0; padding: 8px; word-wrap: break-word; }
          img { max-width: 100%; height: auto; }
          a { color: #2563eb; }
          pre { overflow-x: auto; }
        </style>
      </head><body>${html}</body></html>
    `)
    doc.close()
    const resizeObserver = new ResizeObserver(() => {
      if (doc.body) iframe.style.height = `${doc.body.scrollHeight + 16}px`
    })
    if (doc.body) resizeObserver.observe(doc.body)
    return () => resizeObserver.disconnect()
  }, [html])

  return (
    <iframe ref={iframeRef} sandbox="allow-same-origin"
      className="w-full border-0 min-h-[200px]" title="Email content" />
  )
}

export function MessageView({ message, loading, onClose, onReply, onForward, onDelete, onMarkUnread }: Props) {
  if (loading) {
    return (
      <Container className="p-6 flex flex-col gap-4 h-full">
        <Skeleton className="h-8 w-3/4 rounded" />
        <Skeleton className="h-4 w-1/2 rounded" />
        <Skeleton className="h-4 w-1/3 rounded" />
        <Skeleton className="h-64 w-full rounded" />
      </Container>
    )
  }

  if (!message) {
    return (
      <div className="flex items-center justify-center h-full">
        <Text className="text-ui-fg-muted">Selecciona un mensaje para leer</Text>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="flex items-center justify-between px-4 py-2 border-b border-ui-border-base flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="small" onClick={onReply}>↩ Responder</Button>
          <Button variant="secondary" size="small" onClick={onForward}>↪ Reenviar</Button>
          <Button variant="secondary" size="small" onClick={() => onMarkUnread(message.uid)}>
            Marcar no leído
          </Button>
          <Button variant="secondary" size="small" onClick={() => onDelete(message.uid)}
            className="text-ui-fg-error">
            Eliminar
          </Button>
        </div>
        <Button variant="secondary" size="small" onClick={onClose}>✕</Button>
      </div>

      <div className="px-6 py-4 flex flex-col gap-3">
        <Heading level="h2">{message.subject}</Heading>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Text size="small" className="text-ui-fg-muted w-12">De:</Text>
            <Text size="small" className="font-medium">{message.from}</Text>
          </div>
          <div className="flex items-center gap-2">
            <Text size="small" className="text-ui-fg-muted w-12">Para:</Text>
            <Text size="small">{message.to}</Text>
          </div>
          {message.cc && (
            <div className="flex items-center gap-2">
              <Text size="small" className="text-ui-fg-muted w-12">CC:</Text>
              <Text size="small">{message.cc}</Text>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Text size="small" className="text-ui-fg-muted w-12">Fecha:</Text>
            <Text size="small" className="text-ui-fg-muted">{formatFullDate(message.date)}</Text>
          </div>
        </div>

        {message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((a, i) => (
              <Badge key={i} color="grey" size="small">
                📎 {a.filename} ({formatSize(a.size)})
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 px-6 pb-6">
        {message.html ? (
          <SanitizedHtml html={message.html} />
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-ui-fg-base font-sans">{message.text}</pre>
        )}
      </div>
    </div>
  )
}
