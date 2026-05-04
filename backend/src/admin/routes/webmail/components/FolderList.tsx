import { Badge, Text } from "@medusajs/ui"

type Folder = { path: string; name: string; unseen: number; total: number }

const FOLDER_ICONS: Record<string, string> = {
  INBOX: "📥",
  Sent: "📤",
  Drafts: "📝",
  Trash: "🗑",
  Junk: "⚠️",
  Spam: "⚠️",
}

type Props = {
  folders: Folder[]
  selected: string
  onSelect: (path: string) => void
}

export function FolderList({ folders, selected, onSelect }: Props) {
  const sorted = [...folders].sort((a, b) => {
    const order = ["INBOX", "Sent", "Drafts", "Junk", "Spam", "Trash"]
    const ai = order.indexOf(a.name)
    const bi = order.indexOf(b.name)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  return (
    <div className="flex flex-col gap-0.5">
      {sorted.map((f) => {
        const active = f.path === selected
        const icon = FOLDER_ICONS[f.name] || "📁"
        return (
          <button
            key={f.path}
            onClick={() => onSelect(f.path)}
            className={`flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors ${
              active
                ? "bg-ui-bg-base-pressed text-ui-fg-base"
                : "text-ui-fg-subtle hover:bg-ui-bg-base-hover"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="text-sm">{icon}</span>
              <Text size="small" className="font-medium">{f.name}</Text>
            </span>
            {f.unseen > 0 && (
              <Badge color="blue" size="small">{f.unseen}</Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}
