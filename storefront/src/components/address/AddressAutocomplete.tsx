"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Crosshair } from "lucide-react";

interface AddressComponents {
  address_1: string;
  city: string;
  province: string;
  postal_code: string;
  country_code: string;
  lat?: number;
  lng?: number;
  maps_url?: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (components: AddressComponents) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";

// Load Google Maps script once
let scriptStatus: "idle" | "loading" | "loaded" | "error" = "idle";
const loadCallbacks: Array<(ok: boolean) => void> = [];

function loadGoogleMaps(): Promise<boolean> {
  if (scriptStatus === "loaded") return Promise.resolve(true);
  if (scriptStatus === "error") return Promise.resolve(false);
  if (!GOOGLE_MAPS_KEY) return Promise.resolve(false);

  return new Promise((resolve) => {
    loadCallbacks.push(resolve);
    if (scriptStatus === "loading") return;
    scriptStatus = "loading";

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places&language=es`;
    script.async = true;
    script.onload = () => {
      if (window.google?.maps?.places?.Autocomplete) {
        scriptStatus = "loaded";
        loadCallbacks.forEach((cb) => cb(true));
      } else {
        scriptStatus = "error";
        loadCallbacks.forEach((cb) => cb(false));
      }
      loadCallbacks.length = 0;
    };
    script.onerror = () => {
      scriptStatus = "error";
      loadCallbacks.forEach((cb) => cb(false));
      loadCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

// Shared geolocation — get once and cache
let cachedLocation: { lat: number; lng: number } | null = null;

function getUserLocation(): Promise<{ lat: number; lng: number } | null> {
  if (cachedLocation) return Promise.resolve(cachedLocation);
  if (!navigator.geolocation) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cachedLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        resolve(cachedLocation);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  });
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Empieza a escribir tu dirección...",
  required,
  className = "vintage-input w-full",
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [gmReady, setGmReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [userBias, setUserBias] = useState<google.maps.LatLngBounds | null>(null);

  // Load Google Maps + get user location for bias
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) return;
    loadGoogleMaps().then((ok) => {
      if (!ok) return;
      setGmReady(true);
      // Silently get location for autocomplete bias (no prompt yet)
      getUserLocation().then((loc) => {
        if (loc && window.google?.maps) {
          const center = new google.maps.LatLng(loc.lat, loc.lng);
          // ~50km radius bias
          const bias = new google.maps.LatLngBounds(
            new google.maps.LatLng(loc.lat - 0.45, loc.lng - 0.45),
            new google.maps.LatLng(loc.lat + 0.45, loc.lng + 0.45)
          );
          setUserBias(bias);
        }
      });
    });
  }, []);

  // Extract address components from a Place result
  const extractComponents = useCallback(
    (place: google.maps.places.PlaceResult): AddressComponents | null => {
      if (!place.address_components) return null;

      const get = (type: string) =>
        place.address_components?.find((c) => c.types.includes(type))?.long_name || "";
      const getShort = (type: string) =>
        place.address_components?.find((c) => c.types.includes(type))?.short_name || "";

      const streetNumber = get("street_number");
      const route = get("route");
      const address1 = streetNumber
        ? `${route} ${streetNumber}`
        : route || place.formatted_address || "";

      const lat = place.geometry?.location?.lat();
      const lng = place.geometry?.location?.lng();

      return {
        address_1: address1,
        city:
          get("locality") ||
          get("administrative_area_level_2") ||
          get("sublocality_level_1") ||
          "",
        province: get("administrative_area_level_1") || "",
        postal_code: get("postal_code") || "",
        country_code: getShort("country").toLowerCase() || "es",
        lat,
        lng,
        maps_url:
          place.url ||
          (lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : undefined),
      };
    },
    []
  );

  // Init autocomplete with location bias
  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || !window.google?.maps?.places || autocompleteRef.current) return;

    try {
      const options: google.maps.places.AutocompleteOptions = {
        types: ["address"],
        fields: ["address_components", "formatted_address", "geometry", "url"],
      };

      if (userBias) {
        options.bounds = userBias;
      }

      const ac = new google.maps.places.Autocomplete(inputRef.current, options);

      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        const components = extractComponents(place);
        if (components) {
          onChange(components.address_1);
          onSelect(components);
        }
      });

      autocompleteRef.current = ac;
    } catch {
      // Fallback to normal input
    }
  }, [onChange, onSelect, extractComponents, userBias]);

  useEffect(() => {
    if (gmReady) initAutocomplete();
  }, [gmReady, initAutocomplete]);

  // Update bounds when userBias changes
  useEffect(() => {
    if (autocompleteRef.current && userBias) {
      autocompleteRef.current.setBounds(userBias);
    }
  }, [userBias]);

  useEffect(() => {
    return () => {
      if (autocompleteRef.current) {
        try {
          google.maps.event.clearInstanceListeners(autocompleteRef.current);
        } catch {}
        autocompleteRef.current = null;
      }
    };
  }, []);

  // "Mi ubicación" button — reverse geocode current position
  const handleUseMyLocation = useCallback(async () => {
    if (!gmReady) return;
    setLocating(true);

    const loc = await getUserLocation();
    if (!loc) {
      setLocating(false);
      return;
    }

    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({
        location: { lat: loc.lat, lng: loc.lng },
      });

      const place = result.results?.[0];
      if (place) {
        const streetNumber =
          place.address_components?.find((c) => c.types.includes("street_number"))
            ?.long_name || "";
        const route =
          place.address_components?.find((c) => c.types.includes("route"))?.long_name ||
          "";
        const addr = streetNumber ? `${route} ${streetNumber}` : route || place.formatted_address || "";

        const get = (type: string) =>
          place.address_components?.find((c) => c.types.includes(type))?.long_name || "";
        const getShort = (type: string) =>
          place.address_components?.find((c) => c.types.includes(type))?.short_name || "";

        const components: AddressComponents = {
          address_1: addr,
          city:
            get("locality") ||
            get("administrative_area_level_2") ||
            get("sublocality_level_1") ||
            "",
          province: get("administrative_area_level_1") || "",
          postal_code: get("postal_code") || "",
          country_code: getShort("country").toLowerCase() || "es",
          lat: loc.lat,
          lng: loc.lng,
          maps_url: `https://www.google.com/maps?q=${loc.lat},${loc.lng}`,
        };

        onChange(addr);
        onSelect(components);
      }
    } catch {
      // Geocode failed — still silently fail
    }

    setLocating(false);
  }, [gmReady, onChange, onSelect]);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`${className} ${gmReady ? "pr-9" : ""}`}
          autoComplete="off"
        />
        {gmReady && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-dark/30">
            <MapPin size={15} strokeWidth={2} />
          </div>
        )}
      </div>
      {gmReady && (
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating}
          className="flex items-center gap-1.5 text-[11px] font-bold text-dark/50 hover:text-dark transition-colors uppercase tracking-wider"
        >
          <Crosshair size={12} strokeWidth={2.5} className={locating ? "animate-spin" : ""} />
          {locating ? "Localizando..." : "Usar mi ubicación"}
        </button>
      )}
    </div>
  );
}
