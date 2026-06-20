/* ============================================================
   Enrola — Cálculo de tarifa de delivery por distancia + geo helpers.
   Portado del motor de Vovo (apps/storefront/delivery-pricing.js).
   Todo con APIs gratis (Photon / Nominatim / OSM), SIN API key
   (esto evita la dependencia de Google Maps que rompía el checkout).

   Reglas de negocio (Valencia, Venezuela):
     • Valencia        → tarifa por distancia (km); GRATIS si el pedido ≥ FREE_MIN_EUR.
     • San Diego       → EXCLUIDO del envío gratis; siempre cobra por distancia.
     • Fuera de zona   → usar MRW/Tealca (cobro a destino), sin tarifa local.

   Las constantes de tarifa y el pin de la tienda son configurables por env
   (NEXT_PUBLIC_STORE_LAT / NEXT_PUBLIC_STORE_LNG) para no hardcodear el local.
   ============================================================ */

export interface Coords {
  lat: number;
  lng: number;
}

export type DeliveryZone = "valencia" | "san_diego" | "outside" | "unknown";

export interface DeliveryQuote {
  /** Tarifa en EUR (la moneda de orden de Enrola). */
  fee: number;
  /** true si el envío quedó gratis por superar el umbral. */
  free: boolean;
  /** true si el operador debe confirmar manualmente (fuera de zona / sin datos). */
  toConfirm: boolean;
  zone: DeliveryZone;
  /** Distancia de ruta estimada en km (null si no aplica). */
  roadKm: number | null;
  /** Etiqueta lista para mostrar en el resumen. */
  label: string;
}

// ── Pin de la tienda ────────────────────────────────────────────────────
// Default: CC Las Chimeneas, Valencia (origen de los deliveries de Enrola).
// Override opcional vía NEXT_PUBLIC_STORE_LAT / NEXT_PUBLIC_STORE_LNG en build.
const STORE_LAT = Number(process.env.NEXT_PUBLIC_STORE_LAT) || 10.2020523;
const STORE_LNG = Number(process.env.NEXT_PUBLIC_STORE_LNG) || -68.0001945;
export const STORE_COORDS: Coords = { lat: STORE_LAT, lng: STORE_LNG };

// ── Constantes de tarifa (EUR) ──────────────────────────────────────────
/** Monto del pedido (EUR) desde el cual el delivery en Valencia es gratis. */
export const FREE_MIN_EUR = Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_EUR) || 10;

const ROAD_FACTOR = 1.3; // ruta real ≈ línea recta × 1.3
const BASE = 1.0; // piso de tarifa
const NEAR_RATE = 0.5; // EUR por km hasta el quiebre
const FAR_RATE = 0.25; // EUR por km después del quiebre
const BREAKPOINT_KM = 3;
const INCREMENT = 0.5; // redondeo de la tarifa
const FALLBACK_FEE = 3.0; // cuando no se pudo calcular distancia

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function feeForKm(roadKm: number): number {
  const near = Math.min(roadKm, BREAKPOINT_KM);
  const far = Math.max(0, roadKm - BREAKPOINT_KM);
  const raw = BASE + NEAR_RATE * near + FAR_RATE * far;
  const rounded = Math.round(raw / INCREMENT) * INCREMENT;
  return Math.max(BASE, Number(rounded.toFixed(2)));
}

/** Distancia + tarifa base por distancia (sin reglas de municipio). */
export function quoteByDistance(coords: Coords): {
  straightKm: number;
  roadKm: number;
  feeEur: number;
} {
  const straightKm = haversineKm(STORE_COORDS, coords);
  const roadKm = straightKm * ROAD_FACTOR;
  return {
    straightKm: +straightKm.toFixed(2),
    roadKm: +roadKm.toFixed(2),
    feeEur: feeForKm(roadKm),
  };
}

/** Link de Google Maps a un punto exacto (solo para mostrar al repartidor). */
export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/** ¿El nombre de municipio corresponde a San Diego? */
export function isSanDiego(muni?: string | null): boolean {
  return /san\s*diego/i.test(muni || "");
}
export function isValencia(muni?: string | null): boolean {
  return /valencia/i.test(muni || "");
}

function fmtEur(n: number): string {
  return `€${Number(n).toFixed(2)}`;
}

/* -------------------- Tarifa final según reglas -------------------- */
/**
 * Calcula la tarifa de delivery según zona y monto del pedido.
 *
 * Reglas pedidas para Enrola:
 *  - San Diego  → EXCLUIDO del envío gratis; cobra por distancia siempre.
 *  - Valencia   → por distancia; GRATIS si cartTotal ≥ FREE_MIN_EUR.
 *  - Otra zona  → fuera de delivery local (MRW/Tealca).
 */
export function computeFee(o: {
  coords?: Coords | null;
  municipality?: string | null;
  cartTotal: number;
}): DeliveryQuote {
  const cartTotal = Number(o.cartTotal || 0);
  const muni = o.municipality || "";

  // San Diego → por distancia, NUNCA gratis (excluido del umbral).
  if (isSanDiego(muni)) {
    if (o.coords) {
      const q = quoteByDistance(o.coords);
      return {
        fee: q.feeEur,
        free: false,
        toConfirm: false,
        zone: "san_diego",
        roadKm: q.roadKm,
        label: `San Diego · ${fmtEur(q.feeEur)} (${q.roadKm.toFixed(1)} km) · sin envío gratis`,
      };
    }
    return {
      fee: FALLBACK_FEE,
      free: false,
      toConfirm: true,
      zone: "san_diego",
      roadKm: null,
      label: `San Diego · ${fmtEur(FALLBACK_FEE)} (por confirmar)`,
    };
  }

  // Valencia (o coords sin municipio detectado) → por distancia.
  if (o.coords && (isValencia(muni) || !muni)) {
    const q = quoteByDistance(o.coords);
    if (cartTotal >= FREE_MIN_EUR) {
      return {
        fee: 0,
        free: true,
        toConfirm: false,
        zone: "valencia",
        roadKm: q.roadKm,
        label: `Gratis (pedido ≥ ${fmtEur(FREE_MIN_EUR)})`,
      };
    }
    return {
      fee: q.feeEur,
      free: false,
      toConfirm: false,
      zone: "valencia",
      roadKm: q.roadKm,
      label: `Valencia · ${fmtEur(q.feeEur)} (${q.roadKm.toFixed(1)} km)`,
    };
  }

  // Municipio fuera de Valencia/San Diego → fuera de zona local.
  if (muni) {
    return {
      fee: 0,
      free: false,
      toConfirm: true,
      zone: "outside",
      roadKm: null,
      label: "Fuera de zona de delivery local — usa MRW/Tealca",
    };
  }

  // Sin datos suficientes.
  return {
    fee: FALLBACK_FEE,
    free: false,
    toConfirm: true,
    zone: "unknown",
    roadKm: null,
    label: `Por confirmar · ${fmtEur(FALLBACK_FEE)}`,
  };
}

/* -------------------- Geo (Photon / Nominatim, sin key) -------------------- */

export interface AddressSuggestion {
  label: string;
  lat: number;
  lng: number;
}

export interface ReverseGeocodeResult {
  address: string;
  shortAddr: string;
  municipality: string;
  city: string;
  state: string;
  postcode: string;
}

// Sesgo hacia el Gran Valencia.
const BIAS = { lat: 10.1875, lon: -68.0125 };
const VIEWBOX = "-68.20,10.32,-67.80,10.00";

/** Autocompletar direcciones (Photon/OSM). Devuelve sugerencias en Venezuela. */
export async function searchAddress(query: string): Promise<AddressSuggestion[]> {
  const q = (query || "").trim();
  if (q.length < 3) return [];
  const url =
    "https://photon.komoot.io/api/?" +
    new URLSearchParams({
      q,
      lat: String(BIAS.lat),
      lon: String(BIAS.lon),
      limit: "8",
    });
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const data = await r.json();
    const skip = new Set(["water", "waterway", "natural"]);
    const out: AddressSuggestion[] = [];
    const seen = new Set<string>();
    for (const f of data.features || []) {
      const p = f.properties || {};
      const c = f.geometry && f.geometry.coordinates;
      if (!c) continue;
      const [lon, lat] = c;
      if (!isFinite(lat) || !isFinite(lon)) continue;
      const cc = (p.countrycode || "").toUpperCase();
      if (cc && cc !== "VE") continue;
      if (skip.has(p.osm_key)) continue;
      const parts: string[] = [];
      if (p.name) parts.push(p.name);
      if (p.street) parts.push(p.housenumber ? `${p.street} ${p.housenumber}` : p.street);
      const loc = p.district || p.city || p.county;
      if (loc && !parts.includes(loc)) parts.push(loc);
      if (p.state && !parts.includes(p.state)) parts.push(p.state);
      const label = parts.filter(Boolean).join(", ");
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push({ label, lat, lng: lon });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Reverse geocode (Nominatim). Devuelve dirección + municipio.
 * NOTA Venezuela: en Carabobo, Nominatim pone el MUNICIPIO en `county`
 * ("Municipio Valencia", "Municipio San Diego"). `municipality` trae la
 * PARROQUIA — no sirve para detectar la zona. El orden de prioridad de
 * abajo es lo que hace funcionar la exclusión de San Diego.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult | null> {
  const url =
    "https://nominatim.openstreetmap.org/reverse?" +
    new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: "json",
      zoom: "14",
      addressdetails: "1",
    });
  try {
    const r = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const a = d.address || {};
    const municipality = a.county || a.city || a.town || a.municipality || "";
    const city = a.city || a.town || a.village || a.municipality || "";
    const road = a.road || a.pedestrian || a.footway || "";
    const suburb = a.suburb || a.neighbourhood || a.quarter || a.residential || "";
    const shortAddr = [[road, a.house_number].filter(Boolean).join(" "), suburb]
      .filter(Boolean)
      .join(", ");
    return {
      address: d.display_name || "",
      shortAddr,
      municipality,
      city,
      state: a.state || "",
      postcode: a.postcode || "",
    };
  } catch {
    return null;
  }
}

/** Forward geocode de una dirección escrita (Nominatim). Devuelve coords o null. */
export async function geocodeAddress(address: string): Promise<Coords | null> {
  const q = (address || "").trim();
  if (q.length < 4) return null;
  async function tryQ(query: string): Promise<Coords | null> {
    const url =
      "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({
        q: query,
        format: "json",
        limit: "1",
        countrycodes: "ve",
        viewbox: VIEWBOX,
      });
    try {
      const r = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return null;
      const data = await r.json();
      const hit = data && data[0];
      if (!hit || !hit.lat || !hit.lon) return null;
      return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) };
    } catch {
      return null;
    }
  }
  return (
    (await tryQ(`${q}, Valencia, Carabobo, Venezuela`)) || (await tryQ(`${q}, Venezuela`))
  );
}
