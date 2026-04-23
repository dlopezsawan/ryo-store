import { useState } from "react"
import { Badge, Text } from "@medusajs/ui"
import type { SocialStory } from "../types"
import { StatusBadge } from "./StatusBadge"
import { FeedbackPanel } from "./FeedbackPanel"

export function StoryCard({ story, onChange }: { story: SocialStory; onChange: () => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="aspect-[9/16] w-full bg-ui-bg-base overflow-hidden rounded-md border border-ui-border-base hover:border-ui-border-strong transition-colors relative group"
      >
        {story.media_url ? (
          <img src={story.media_url} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ui-fg-muted text-xs">
            Sin media
          </div>
        )}
        <div className="absolute top-1 left-1 right-1 flex items-center justify-between">
          <Badge size="2xsmall" color="grey">
            {story.slot}
          </Badge>
          <Badge size="2xsmall" color="grey">
            {story.type}
          </Badge>
        </div>
        {story.link_url && (
          <div className="absolute bottom-1 left-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 truncate">
            🔗 {new URL(story.link_url).hostname.replace(/^www\./, "")}
          </div>
        )}
      </button>

      <div className="flex items-center justify-between">
        <Text size="xsmall" className="text-ui-fg-subtle">
          {story.date.slice(5)} · #{story.slot}
        </Text>
        <StatusBadge status={story.status} />
      </div>

      {expanded && (
        <div className="mt-2 p-2 rounded-md border border-ui-border-base bg-ui-bg-base">
          <FeedbackPanel entityType="story" entityId={story.id} />
        </div>
      )}
    </div>
  )
}
