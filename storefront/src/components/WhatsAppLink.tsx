"use client"

import Link from "next/link"
import { trackWhatsAppClicked } from "@/lib/posthog"
import type { ReactNode, AnchorHTMLAttributes } from "react"

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  phone: string                       // with country code, no "+"
  message?: string                    // pre-filled message
  context?: string                    // label to group clicks (e.g. "pdp_cta", "footer", "checkout_help")
  children: ReactNode
}

/**
 * Wrapper around wa.me links that automatically captures `whatsapp_clicked`
 * event with source page + context for remarketing analysis.
 *
 * Use this instead of raw <a href="wa.me/..."> so every WhatsApp click is tracked.
 */
export default function WhatsAppLink({ phone, message, context, children, onClick, ...rest }: Props) {
  const encoded = message ? `?text=${encodeURIComponent(message)}` : ""
  const href = `https://wa.me/${phone.replace(/\D/g, "")}${encoded}`

  return (
    <Link
      {...rest}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        try {
          trackWhatsAppClicked({
            source_page: typeof window !== "undefined" ? window.location.pathname : "",
            context,
          })
        } catch { /* never block the click */ }
        if (onClick) onClick(e)
      }}
    >
      {children}
    </Link>
  )
}
