/**
 * Enrola brand injector — mounts on the admin landing page so the
 * MutationObserver starts right after login. Once started, it persists
 * for the entire session (the existing `ryo-branding-global.tsx` guard
 * prevents double-mount).
 *
 * Widget zones only mount on their specific route, so we need multiple
 * entry points. This file covers login → home. The other files cover
 * direct navigation to /orders, /products etc.
 */
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"

// Enrola favicon (red swirly icon)
const ENROLA_LOGO_URL =
  "data:image/svg+xml,%3Csvg viewBox='0 0 4500 4500' xmlns='http://www.w3.org/2000/svg'%3E%3Cg transform='matrix(1,0,0,1,-105,-5062.5)'%3E%3Cg transform='matrix(4.166667,0,0,4.166667,105,5062.5)'%3E%3Cg%3E%3Cg transform='matrix(1.994959,0,0,1.994959,-537.277835,-537.277893)'%3E%3Cg transform='matrix(1,0,0,1,613.7805,397.0129)'%3E%3Cpath d='M0,285.937C1.478,283.652 3.251,281.422 5.817,280.41C7.009,279.94 8.299,279.765 9.57,279.563C37.241,275.16 67.066,255.577 74.909,228.556C81.434,206.077 75.135,179.305 65.729,158.52C62.483,151.345 61.773,143.642 59.11,136.152C53.701,120.938 43.795,105.23 47.479,88.555C49.976,77.248 58.653,67.598 59.619,56.075C60.788,42.139 51.49,32.203 40.547,24.635C31.206,18.175 21.342,12.242 10.52,8.49C-0.303,4.738-12.202,3.261-23.397,5.807C-38.059,9.141-50.76,19.623-56.416,33.056C-62.072,46.489-60.534,62.519-52.417,74.729C-51.874,75.545-51.293,76.357-50.514,76.971C-48.269,78.739-44.829,78.426-42.358,76.963C-39.679,75.376-38.225,72.636-35.67,70.952C-33.354,69.425-30.295,68.856-27.767,67.751C-26.257,67.091-24.697,66.176-23.055,66.449C-21.443,66.718-20.258,68.133-19.914,69.631C-19.569,71.128-19.914,72.687-20.39,74.153C-22.046,79.252-25.342,84.218-24.498,89.488C-23.218,97.47-11.733,101.08-4.29,101.844C-1.219,102.16 1.947,101.898 4.92,102.649C10.296,104.006 13.932,108.333 17.004,112.468C28.882,128.457 38.204,145.675 45.306,163.679C50.399,176.588 53.703,189.543 52.019,203.456C49.824,221.597 39.106,238.83 23.839,250.633C17.599,255.457 10.748,258.028 3.443,260.886C-1.558,262.843-9.48,265.52-12.282,270.164C-13.47,272.132-13.905,274.546-15.541,276.19C-17.435,278.093-20.496,278.466-23.198,278.031C-25.899,277.596-28.432,276.489-31.091,275.853C-47.3,271.974-55.408,287.251-69.736,287.082C-92.092,286.817-111.98,282.839-132.898,275.495C-138.578,273.501-144.679,271.796-150.118,269.283C-159.705,264.853-169.592,258.182-179.178,253.752C-186.506,250.366-192.341,246.299-198.551,241.329C-237.399,210.232-254.521,173.922-249.714,125.005C-246.355,90.817-237.763,56.536-220.838,25.894C-177.004,-53.463-63.168,-61.557 23.165,-10.268C109.497,41.02 118.416,130.934 108.192,179.205C97.969,227.477 95.807,306.136 0.388,330.272C-40.055,340.502-84.628,347.624-126.77,338.347C-167.338,329.418-204.024,305.618-235.146,281.708C-258.914,263.447-297.221,248.625-323.402,274.46C-332.87,283.804-330.197,289.915-328.52,302.69C-326.305,319.561-317.347,336.034-304.561,348.04C-292.856,359.03-269.192,368.482-281.031,343.012C-285.307,333.812-299.705,314.848-292.392,304.748C-280.213,287.926-196.569,363.17-182.049,370.843C-143.514,391.203-96.097,390.565-53.186,392.419C-19.215,393.887 16.215,390.882 45.767,373.754C99.015,342.892 162.466,303.493 179.227,182.312C185.161,139.416 184.38,100.029 168.465,59.102C153.952,21.781 131.182,-11.204 102.811,-41.329C84.758,-60.498 59.374,-78.627 33.928,-87.921C6.276,-98.021-29.216,-107.95-58.871,-106.658C-137.356,-103.24-210.995,-101.908-269.587,-23.727C-298.327,14.62-310.942,60.898-309.586,107.856C-308.614,141.556-303.969,191.509-281.434,218.735C-269.571,233.068-252.985,247.87-237.068,257.974C-220.766,268.323-202.248,274.9-185.546,284.604C-145.175,308.06-92.223,321.566-46.56,303.265C-41.032,301.049-35.081,299.816-29.096,299.646C-20.79,299.41-11.522,300.603-5.425,293.894C-3.411,291.677-1.956,289.053-0.377,286.531C-0.254,286.333-0.128,286.135 0,285.937' style='fill:rgb(255,59,39);fill-rule:nonzero;'/%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/svg%3E"

const STYLE_ID = "enrola-brand-css"
const GUARD = "__enrolaBrandingActive"

function injectCSS() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
    .enrola-avatar {
      font-size: 0 !important;
      color: transparent !important;
      background-image: url("${ENROLA_LOGO_URL}") !important;
      background-size: 70% 70% !important;
      background-position: center !important;
      background-repeat: no-repeat !important;
      overflow: hidden !important;
    }
    .enrola-avatar > * { visibility: hidden !important; }
  `
  document.head.appendChild(style)
}

function applyBranding() {
  injectCSS()

  // Match any square-ish element with exactly one letter/digit as its only
  // text content. We don't restrict by parent tag because Medusa admin nests
  // the sidebar in deeply generic <div>s without semantic tags. A 20-50px
  // element with a single char + solid background is unique enough.
  const all = document.querySelectorAll<HTMLElement>("div, button, span, a")
  for (const node of all) {
    if (node.classList.contains("enrola-avatar")) continue
    if (node.childElementCount > 1) continue

    const text = (node.textContent || "").trim()
    if (text.length !== 1 || !/^[A-Za-z0-9]$/.test(text)) continue

    const w = node.offsetWidth
    const h = node.offsetHeight
    if (w < 16 || w > 56 || h < 16 || h > 56) continue
    // must be roughly square
    if (Math.abs(w - h) > 8) continue

    const style = window.getComputedStyle(node)
    const bg = style.backgroundColor
    if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") continue

    node.classList.add("enrola-avatar")
  }

  // Replace default store name text
  document.querySelectorAll("aside *, nav *, header *").forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    if (node.children.length > 0) return
    const t = node.textContent || ""
    if (t === "Medusa Store" || t === "Medusa" || t === "RYO Store" || t === "RYO")
      node.textContent = "Enrola"
  })

  // Page title
  if (document.title.includes("Medusa")) {
    document.title = document.title.replace(/Medusa/g, "Enrola")
  }
}

function Branding() {
  useEffect(() => {
    const win = window as unknown as Record<string, unknown>
    if (win[GUARD]) return
    win[GUARD] = true
    applyBranding()
    const obs = new MutationObserver(() => requestAnimationFrame(applyBranding))
    obs.observe(document.body, { childList: true, subtree: true })
    // Never disconnect — branding must persist across SPA navigation
  }, [])
  return null
}

export const config = defineWidgetConfig({
  zone: "product.list.before",
})

export default Branding
