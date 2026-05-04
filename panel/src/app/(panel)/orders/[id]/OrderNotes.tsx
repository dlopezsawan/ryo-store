"use client"

import { NotesPanel, type NoteRow } from "@/components/notes/NotesPanel"
import { addOrderNoteAction, deleteOrderNoteAction } from "./actions"

interface Props {
  orderId: string
  notes: NoteRow[]
  currentUser?: string
}

export function OrderNotes({ orderId, notes, currentUser }: Props) {
  return (
    <NotesPanel
      notes={notes}
      currentUser={currentUser}
      onAdd={(text) => addOrderNoteAction(orderId, text)}
      onDelete={(id) => deleteOrderNoteAction(orderId, id)}
      title="Notas del pedido"
    />
  )
}
