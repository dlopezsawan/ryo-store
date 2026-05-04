import { redirect } from "next/navigation"

// Root del panel siempre redirige a dashboard. El middleware se encarga
// de mandarte al login si no hay sesión válida.
export default function Root() {
  redirect("/dashboard")
}
