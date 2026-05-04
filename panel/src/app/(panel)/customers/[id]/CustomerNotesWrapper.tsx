"use client"

import { NotesPanel, type NoteRow } from "@/components/notes/NotesPanel"
import { addCustomerNoteAction, deleteCustomerNoteAction } from "./actions"

interface Props {
  customerId: string
  notes: NoteRow[]
  currentUser?: string
}

export function CustomerNotesWrapper({ customerId, notes, currentUser }: Props) {
  return (
    <NotesPanel
      notes={notes}
      currentUser={currentUser}
      onAdd={(text) => addCustomerNoteAction(customerId, text)}
      onDelete={(id) => deleteCustomerNoteAction(customerId, id)}
      title="Notas del cliente"
    />
  )
}
