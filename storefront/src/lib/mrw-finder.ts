/**
 * Find the nearest MRW office to a given lat/lng using Google Places
 * (Nearby Search). Runs client-side, requires `google.maps` library to be
 * already loaded (AddressAutocomplete loads it on mount).
 *
 * MRW is the dominant courier in Venezuela; pretty much every populated area
 * has an "Oficina MRW" or "MRW <agencia>" mapped on Google. We pick the
 * closest result and return name + formatted address + a Google Maps URL
 * pointing directly to that place's place_id (so the team gets a clickable
 * pin, not a generic search).
 */

export interface MrwOffice {
  name: string
  address: string
  maps_url: string
  place_id?: string
  lat?: number
  lng?: number
}

/**
 * Returns the closest MRW office to the given coordinates, or null if Google
 * Places isn't loaded / no results were found / the lookup errors out.
 */
export async function findNearestMrwOffice(
  lat: number,
  lng: number,
  radiusMeters = 50_000
): Promise<MrwOffice | null> {
  if (typeof window === "undefined") return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (window as any).google
  if (!g?.maps?.places) {
    console.warn("[mrw-finder] google.maps.places not loaded yet")
    return null
  }

  return new Promise<MrwOffice | null>((resolve) => {
    try {
      // PlacesService needs a DOM node — a detached div works fine, no render.
      const container = document.createElement("div")
      const service = new g.maps.places.PlacesService(container)
      const center = new g.maps.LatLng(lat, lng)

      service.nearbySearch(
        {
          location: center,
          radius: radiusMeters,
          keyword: "MRW",
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (results: any[], status: string) => {
          if (status !== "OK" || !Array.isArray(results) || results.length === 0) {
            console.warn("[mrw-finder] nearbySearch returned", status, "results:", results?.length || 0)
            resolve(null)
            return
          }

          // Filter to ones whose name actually mentions MRW (avoid false matches)
          const candidates = results.filter((r) => {
            const n = String(r.name || "").toLowerCase()
            return n.includes("mrw")
          })
          if (candidates.length === 0) {
            console.warn("[mrw-finder] no result name contained 'MRW'")
            resolve(null)
            return
          }

          // Sort by distance from center
          const withDistance = candidates.map((r) => {
            const loc = r.geometry?.location
            const rLat = typeof loc?.lat === "function" ? loc.lat() : loc?.lat
            const rLng = typeof loc?.lng === "function" ? loc.lng() : loc?.lng
            const dist =
              typeof rLat === "number" && typeof rLng === "number"
                ? haversine(lat, lng, rLat, rLng)
                : Infinity
            return { r, dist, rLat, rLng }
          })
          withDistance.sort((a, b) => a.dist - b.dist)
          const best = withDistance[0]

          const placeId = best.r.place_id as string | undefined
          const name = String(best.r.name || "Oficina MRW")
          const address = String(best.r.vicinity || best.r.formatted_address || "")
          // Build a URL using Google's "Maps URLs" official API. Combining
          // name + place_id gives the richest pin (full info card opens), and
          // even if place_id resolution fails, the name search still works.
          // Reference: https://developers.google.com/maps/documentation/urls/get-started
          let maps_url: string
          if (placeId) {
            const q = encodeURIComponent(`${name} ${address}`.trim())
            maps_url = `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${encodeURIComponent(placeId)}`
          } else if (typeof best.rLat === "number" && typeof best.rLng === "number") {
            // Fallback to lat/lng with name as label
            const q = encodeURIComponent(name)
            maps_url = `https://www.google.com/maps/search/?api=1&query=${q}&query=${best.rLat},${best.rLng}`
          } else {
            maps_url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`
          }

          resolve({
            name,
            address,
            maps_url,
            place_id: placeId,
            lat: best.rLat,
            lng: best.rLng,
          })
        }
      )
    } catch (err) {
      console.error("[mrw-finder] error:", err)
      resolve(null)
    }
  })
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371_000 // meters
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
