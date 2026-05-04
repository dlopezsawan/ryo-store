import { useEditor, EditorContent } from "@tiptap/react"
import { StarterKit } from "@tiptap/starter-kit"
import { Underline } from "@tiptap/extension-underline"
import { Link } from "@tiptap/extension-link"
import { TextAlign } from "@tiptap/extension-text-align"
import { TextStyle } from "@tiptap/extension-text-style"
import { Color } from "@tiptap/extension-color"
import { useEffect, useCallback } from "react"

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

function ToolbarButton({
  onClick, active, title, children,
}: {
  onClick: () => void; active?: boolean; title?: string; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={`px-1.5 py-0.5 rounded text-sm font-medium transition-colors select-none ${
        active
          ? "bg-ui-bg-interactive text-ui-fg-on-color"
          : "text-ui-fg-subtle hover:bg-ui-bg-base-hover hover:text-ui-fg-base"
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="w-px h-5 bg-ui-border-base mx-0.5 shrink-0" />
}

export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-blue-500 underline" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "min-h-[200px] outline-none px-3 py-2 text-sm text-ui-fg-base",
      },
    },
  } as any)

  // Sync external value reset (e.g. when modal reopens)
  useEffect(() => {
    if (!editor) return
    if (value === "" && editor.getHTML() !== "<p></p>") {
      editor.commands.setContent("")
    }
  }, [value, editor])

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes("link").href || ""
    const url = window.prompt("URL del enlace:", prev)
    if (url === null) return
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
    }
  }, [editor])

  if (!editor) return null

  return (
    <div className="flex flex-col border border-ui-border-base rounded-md overflow-hidden bg-ui-bg-field">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1 border-b border-ui-border-base bg-ui-bg-subtle">
        {/* History */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Deshacer">↩</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Rehacer">↪</ToolbarButton>
        <Divider />

        {/* Formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")} title="Negrita"
        ><b>B</b></ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")} title="Cursiva"
        ><i>I</i></ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")} title="Subrayado"
        ><u>U</u></ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")} title="Tachado"
        ><s>S</s></ToolbarButton>
        <Divider />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })} title="Título 1"
        >H1</ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })} title="Título 2"
        >H2</ToolbarButton>
        <Divider />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })} title="Izquierda"
        >⬅</ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })} title="Centrar"
        >☰</ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })} title="Derecha"
        >➡</ToolbarButton>
        <Divider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")} title="Lista"
        >• —</ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")} title="Lista numerada"
        >1. —</ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")} title="Cita"
        >❝</ToolbarButton>
        <Divider />

        {/* Link */}
        <ToolbarButton onClick={setLink} active={editor.isActive("link")} title="Insertar enlace">
          🔗
        </ToolbarButton>
        <Divider />

        {/* Color */}
        <label title="Color de texto" className="flex items-center cursor-pointer px-1">
          <span className="text-sm text-ui-fg-subtle mr-0.5">A</span>
          <input
            type="color"
            className="w-4 h-4 cursor-pointer border-0 p-0 rounded"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            value={editor.getAttributes("textStyle").color || "#000000"}
          />
        </label>
      </div>

      {/* Editor area */}
      <div className="flex-1 relative">
        {editor.isEmpty && placeholder && (
          <span className="absolute top-2 left-3 text-sm text-ui-fg-muted pointer-events-none select-none">
            {placeholder}
          </span>
        )}
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .ProseMirror { outline: none; }
        .ProseMirror p { margin: 0 0 0.5em; }
        .ProseMirror ul { list-style: disc; padding-left: 1.5em; }
        .ProseMirror ol { list-style: decimal; padding-left: 1.5em; }
        .ProseMirror blockquote { border-left: 3px solid #ccc; padding-left: 1em; color: #666; margin: 0.5em 0; }
        .ProseMirror h1 { font-size: 1.5em; font-weight: bold; margin: 0.5em 0; }
        .ProseMirror h2 { font-size: 1.25em; font-weight: bold; margin: 0.5em 0; }
      `}</style>
    </div>
  )
}
