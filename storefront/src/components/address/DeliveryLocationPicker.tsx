"use client";

/* ============================================================
   Enrola — Selector de ubicación de delivery (mapa + autocomplete + GPS).
   Portado del widget de Vovo (apps/storefront/delivery-location.js) a React.
   Mapa Leaflet + OpenStreetMap, autocomplete Photon, reverse-geocode
   Nominatim. SIN Google Maps key. Leaflet se carga desde CDN una sola vez.
   ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Crosshair } from "lucide-react";
import {
  STORE_COORDS,
  searchAddress,
  reverseGeocode,
  mapsLink,
  type AddressSuggestion,
} from "@/lib/delivery";

export interface DeliveryLocation {
  lat: number;
  lng: number;
  address: string;
  shortAddr: string;
  municipality: string;
  city: string;
  state: string;
  postcode: string;
  mapsUrl: string;
}

interface Props {
  onUpdate: (loc: DeliveryLocation) => void;
  className?: string;
}

const LEAFLET_VER = "1.9.4";

// Carga Leaflet (CSS + JS) desde CDN una sola vez para toda la app.
let leafletPromise: Promise<unknown> | null = null;
function loadLeaflet(): Promise<unknown> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  const w = window as unknown as { L?: unknown };
  if (w.L) return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `https://unpkg.com/leaflet@${LEAFLET_VER}/dist/leaflet.css`;
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = `https://unpkg.com/leaflet@${LEAFLET_VER}/dist/leaflet.js`;
    s.async = true;
    s.onload = () => resolve((window as unknown as { L: unknown }).L);
    s.onerror = () => reject(new Error("leaflet_load_failed"));
    document.head.appendChild(s);
  });
  return leafletPromise;
}

export default function DeliveryLocationPicker({ onUpdate, className }: Props) {
  const mapElRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSug, setShowSug] = useState(false);
  const [status, setStatus] = useState<{ text: string; kind?: "err" } | null>(null);
  const [mapError, setMapError] = useState(false);
  const pickedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Aplica un punto: mueve el pin, reverse-geocodea y emite el estado.
  const applyPoint = useCallback(
    async (lat: number, lng: number, opts?: { keepAddress?: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L: any = (window as unknown as { L?: any }).L;
      if (mapRef.current && markerRef.current && L) {
        markerRef.current.setLatLng([lat, lng]);
        mapRef.current.setView([lat, lng], 16);
      }
      setStatus({ text: "Ubicando…" });
      const rev = await reverseGeocode(lat, lng);
      const loc: DeliveryLocation = {
        lat,
        lng,
        address: rev?.address || "",
        shortAddr: rev?.shortAddr || "",
        municipality: rev?.municipality || "",
        city: rev?.city || "",
        state: rev?.state || "",
        postcode: rev?.postcode || "",
        mapsUrl: mapsLink(lat, lng),
      };
      if (rev && !opts?.keepAddress && rev.address) {
        setQuery(rev.address);
      }
      setStatus(null);
      onUpdateRef.current(loc);
    },
    []
  );

  // Inicializa el mapa Leaflet una vez.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((Lraw) => {
        if (cancelled || !mapElRef.current || mapRef.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const L: any = Lraw;
        const start = STORE_COORDS;
        const map = L.map(mapElRef.current).setView([start.lat, start.lng], 14);
        mapRef.current = map;
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(map);
        // Pin de referencia de la tienda.
        L.circleMarker([start.lat, start.lng], {
          radius: 6,
          color: "#BB3B2E",
          fillColor: "#BB3B2E",
          fillOpacity: 1,
        })
          .addTo(map)
          .bindTooltip("Enrola");
        const icon = L.icon({
          iconUrl: `https://unpkg.com/leaflet@${LEAFLET_VER}/dist/images/marker-icon.png`,
          iconRetinaUrl: `https://unpkg.com/leaflet@${LEAFLET_VER}/dist/images/marker-icon-2x.png`,
          shadowUrl: `https://unpkg.com/leaflet@${LEAFLET_VER}/dist/images/marker-shadow.png`,
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        });
        const marker = L.marker([start.lat, start.lng], { draggable: true, icon }).addTo(map);
        markerRef.current = marker;
        marker.on("dragend", () => {
          const p = marker.getLatLng();
          applyPoint(p.lat, p.lng);
        });
        map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
          applyPoint(e.latlng.lat, e.latlng.lng);
        });
        setTimeout(() => map.invalidateSize(), 250);
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [applyPoint]);

  // Autocomplete con debounce.
  const onQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (pickedRef.current) {
      pickedRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setShowSug(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await searchAddress(q);
      setSuggestions(res);
      setShowSug(res.length > 0);
    }, 300);
  }, []);

  const pickSuggestion = useCallback(
    (s: AddressSuggestion) => {
      pickedRef.current = true;
      setQuery(s.label);
      setShowSug(false);
      applyPoint(s.lat, s.lng, { keepAddress: true });
    },
    [applyPoint]
  );

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus({ text: "Tu navegador no soporta ubicación", kind: "err" });
      return;
    }
    setStatus({ text: "Obteniendo tu ubicación…" });
    navigator.geolocation.getCurrentPosition(
      (pos) => applyPoint(pos.coords.latitude, pos.coords.longitude),
      () =>
        setStatus({
          text: "No pudimos obtener tu ubicación. Activa permisos o escribe la dirección.",
          kind: "err",
        }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, [applyPoint]);

  return (
    <div className={className}>
      {/* Buscador con autocomplete */}
      <div className="relative">
        <div className="flex items-center gap-2 border-2 border-dark/20 rounded-md px-3 py-2 bg-white focus-within:border-primary">
          <MapPin className="w-4 h-4 text-muted flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            placeholder="Busca tu dirección (calle, urbanización, sector…)"
            autoComplete="off"
            className="flex-1 outline-none text-sm bg-transparent"
          />
        </div>
        {showSug && suggestions.length > 0 && (
          <ul className="absolute z-[1000] left-0 right-0 mt-1 bg-white border border-dark/15 rounded-md shadow-lg max-h-64 overflow-auto">
            {suggestions.map((s, i) => (
              <li key={`${s.label}-${i}`}>
                <button
                  type="button"
                  // onMouseDown corre antes que onBlur del input.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickSuggestion(s);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-cream flex items-start gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-muted mt-0.5 flex-shrink-0" />
                  <span>{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* GPS + estado */}
      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          onClick={useMyLocation}
          className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 border-2 border-dark/20 rounded-md hover:border-primary transition-colors"
        >
          <Crosshair className="w-4 h-4" />
          Usar mi ubicación
        </button>
        {status && (
          <span className={`text-xs ${status.kind === "err" ? "text-primary" : "text-muted"}`}>
            {status.text}
          </span>
        )}
      </div>

      {/* Mapa */}
      {mapError ? (
        <div className="mt-3 p-4 text-sm text-muted border border-dark/15 rounded-md bg-cream">
          No se pudo cargar el mapa. Escribe tu dirección arriba y usa el botón de ubicación.
        </div>
      ) : (
        <div
          ref={mapElRef}
          className="mt-3 w-full h-64 rounded-md overflow-hidden border border-dark/15 z-0"
        />
      )}
      <p className="text-xs text-muted mt-2">
        Arrastra el pin al punto exacto de entrega (portón, edificio). Esto define la tarifa de
        delivery y ayuda al repartidor.
      </p>
    </div>
  );
}
