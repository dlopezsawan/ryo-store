"use client";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/context/CartContext";
import { centsToDisplay } from "@/lib/price";
import { formatPrice } from "@/lib/format";
import * as cartApi from "@/lib/cart";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, Star, UserPlus, MapPin, Plus, Gift } from "lucide-react";
import AddressAutocomplete from "@/components/address/AddressAutocomplete";
import DeliveryLocationPicker from "@/components/address/DeliveryLocationPicker";
import { computeFee, quoteByDistance, geocodeAddress, reverseGeocode, FREE_MIN_EUR, type DeliveryQuote } from "@/lib/delivery";
import WhatsAppPhoneInput from "@/components/form/WhatsAppPhoneInput";
import { useSession } from "next-auth/react";
import ComboTierBanner from "@/components/combo/ComboTierBanner";
import { applyComboDiscount } from "@/lib/combo-tiers";
import { findNearestMrwOffice } from "@/lib/mrw-finder";
import { compareNameToCne } from "@/lib/cedula-name-match";
import {
  trackCheckoutStarted,
  trackCheckoutStep,
  trackOrderPlaced,
  trackPaymentProofUploaded,
  trackPaymentMethodSelected,
  trackCouponApplied,
  trackCouponFailed,
  identifyCustomer,
} from "@/lib/posthog";

type LoyaltyReward = {
  id: string;
  name: string;
  description?: string;
  points_required: number;
  image_url?: string;
  stock?: number | null;
};

type ShippingOption = {
  id: string;
  name?: string;
  shipping_option_type?: { code?: string };
  type?: { code?: string };
  amount?: number;
  calculated_price?: { calculated_amount?: number };
};

/**
 * Cutoff de pedidos inmediatos en Valencia. Después de las 21:15 hora
 * de Caracas (UTC-4), un inmediato ya no puede salir esa noche — el
 * cliente debe aceptar entrega next-day o cambiar a MRW nacional.
 *
 * El grace de 15 min sobre las 9pm es para clientes que llevan rato
 * en el checkout: no queremos kickearlos por completar a las 21:03.
 *
 * Computado client-side con Intl.DateTimeFormat (zona explícita en
 * vez de fiarnos del reloj del cliente, que puede estar mal o estar
 * en otro huso). La hora exacta del servidor no nos importa: el
 * mensajero opera por el reloj del operador y aceptamos cierto
 * skew para que el cliente no vea inconsistencias raras según
 * dónde tenga el celular.
 */
function isAfterImmediateCutoff(now: Date = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  // Parts gives us numeric hour + minute in Caracas tz.
  const parts = fmt.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  // After 21:15 OR any time after 22:00, OR before 6am (madrugada).
  // 6am cutoff on the morning side prevents someone at 3am ordering
  // "inmediato" expecting same-night delivery from the night before.
  if (hour < 6) return true;
  if (hour > 21) return true;
  if (hour === 21 && minute >= 15) return true;
  return false;
}

function selectShippingOption(
  options: ShippingOption[],
  shippingType: "inmediato" | "mrw",
  subtotal: number
): ShippingOption | null {
  const getCode = (o: ShippingOption) =>
    o.shipping_option_type?.code ?? o.type?.code ?? "";
  const getName = (o: ShippingOption) => (o.name ?? "").toLowerCase();
  const getAmount = (o: ShippingOption) => {
    const a = o.amount ?? o.calculated_price?.calculated_amount;
    return a != null ? Number(a) : 0;
  };
  const isMrw = (o: ShippingOption) =>
    getName(o).includes("mrw") || getCode(o) === "mrw";
  const isInmediato = (o: ShippingOption) =>
    getName(o).includes("inmediato") ||
    getName(o).includes("valencia") ||
    getCode(o).startsWith("inmediato");

  if (shippingType === "mrw") {
    return options.find(isMrw) ?? null;
  }
  if (shippingType === "inmediato") {
    const immediatoOptions = options.filter((o) => !isMrw(o));
    if (immediatoOptions.length === 0) return null;
    const useGratis = subtotal >= 10;
    const preferAmount = useGratis ? 0 : 300;
    const match =
      immediatoOptions.find((o) => getAmount(o) === preferAmount) ??
      immediatoOptions.find((o) => getAmount(o) === (useGratis ? 0 : 3)) ??
      immediatoOptions.find((o) =>
        useGratis ? getName(o).includes("gratis") : getName(o).includes("$3")
      );
    return match ?? immediatoOptions[0];
  }
  return options[0] ?? null;
}

const PAGO_MOVIL_INSTRUCTIONS = [
  {
    step: 1,
    text: "Realiza tu pago a",
    details: (
      <>
        <p className="font-bold text-dark">Banco de Venezuela</p>
        <p className="text-base font-medium">21028734</p>
        <p className="text-base font-medium">04244043276</p>
      </>
    ),
  },
  {
    step: 2,
    text: "Completa los datos del formulario y sube la captura del pago",
  },
  {
    step: 3,
    text: "Verificaremos el pago y recibirás actualizaciones del pedido por correo",
  },
];

export default function CheckoutPage() {
  const { cart, loading: cartLoading, refresh } = useCart();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const isLoggedIn = authStatus === "authenticated";
  const [fullCart, setFullCart] = useState<{
    id: string;
    region_id: string;
    payment_collection?: { id: string };
    email?: string;
    shipping_address?: Record<string, unknown>;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState("VE");
  const [province, setProvince] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  // Municipio detectado por reverse-geocode (Valencia / San Diego / …).
  // Necesario para la tarifa de delivery por km y la exclusión de San Diego.
  const [addressMunicipality, setAddressMunicipality] = useState("");
  // Acepta entrega mañana cuando el cliente marca inmediato después
  // de las 21:15 hora Venezuela. Sin esta aceptación bloqueamos el
  // submit — ver handleSubmit.
  const [acceptedScheduledNextDay, setAcceptedScheduledNextDay] = useState(false);

  // ─── MRW recipient + cedula validation (only relevant when shippingType=mrw) ─
  // The buyer (logged-in account / payer) and the recipient (who picks up at MRW)
  // can be different people. MRW rejects shipments when the cedula registered
  // doesn't match the receiver's name, so we capture both pieces and verify
  // against CNE before submission.
  const [recipientType, setRecipientType] = useState<"self" | "other">("self");
  const [nationality, setNationality] = useState<"V" | "E">("V");
  const [cedula, setCedula] = useState("");          // own cedula (when recipient=self)
  const [recipientFirstName, setRecipientFirstName] = useState("");
  const [recipientLastName, setRecipientLastName] = useState("");
  const [recipientNationality, setRecipientNationality] = useState<"V" | "E">("V");
  const [recipientCedula, setRecipientCedula] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [cedulaCheck, setCedulaCheck] = useState<{
    status: "idle" | "loading" | "match" | "partial" | "mismatch" | "not_found" | "unavailable";
    cneName?: string;
  }>({ status: "idle" });
  // Verificación de la cédula del RECEPTOR (solo MRW + "para otra persona").
  // La cédula del comprador usa cedulaCheck y se pide siempre.
  const [recipientCedulaCheck, setRecipientCedulaCheck] = useState<{
    status: "idle" | "loading" | "match" | "partial" | "mismatch" | "not_found" | "unavailable";
    cneName?: string;
  }>({ status: "idle" });
  const [shippingType, setShippingType] = useState<"inmediato" | "mrw">("inmediato");

  // Saved addresses (logged-in users)
  type SavedAddress = {
    id: string;
    first_name?: string;
    last_name?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    province?: string;
    phone?: string;
    country_code?: string;
    // Coords guardadas (cohesión con el mapa Leaflet del checkout).
    metadata?: { lat?: number; lng?: number; municipality?: string; maps_url?: string } | null;
  };
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  // Seed para re-centrar el mapa del picker al elegir una dirección guardada.
  const [pickerSeed, setPickerSeed] = useState<{ lat: number; lng: number; key: string } | null>(null);

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [wrongRegion, setWrongRegion] = useState<boolean | null>(null);
  const [bcvRate, setBcvRate] = useState<number | null>(null);

  // Tarifa de delivery por distancia (solo "inmediato"). Gratis si el
  // subtotal ≥ €10 EXCEPTO San Diego (siempre cobra por km). Desacoplado
  // del pago: solo alimenta el total mostrado + la metadata de la orden,
  // igual que en Vovo — no toca payment-collection ni pago_movil.
  const deliveryQuote: DeliveryQuote | null = useMemo(() => {
    if (shippingType !== "inmediato") return null;
    return computeFee({
      coords: addressCoords,
      municipality: addressMunicipality,
      cartTotal: cart?.subtotal ?? 0,
    });
  }, [shippingType, addressCoords, addressMunicipality, cart?.subtotal]);

  // Aplica una dirección guardada: rellena los campos Y resuelve coords +
  // municipio para que el mapa se re-centre y el delivery se calcule de una
  // (no "por calcular"). Usa las coords guardadas en metadata; si la dirección
  // es vieja y no las tiene, geocodifica el texto como fallback.
  const applySavedAddress = useCallback(async (addr: SavedAddress) => {
    setSelectedAddressId(addr.id);
    if (addr.first_name) setFirstName(addr.first_name);
    if (addr.last_name) setLastName(addr.last_name);
    if (addr.address_1) setAddress1(addr.address_1);
    setAddress2(addr.address_2 ?? "");
    if (addr.city) setCity(addr.city);
    setProvince(addr.province ?? "");
    if (addr.phone) setPhone(addr.phone);

    const md = addr.metadata || {};
    if (typeof md.lat === "number" && typeof md.lng === "number") {
      setAddressCoords({ lat: md.lat, lng: md.lng });
      setMapsUrl(md.maps_url || `https://www.google.com/maps?q=${md.lat},${md.lng}`);
      setPickerSeed({ lat: md.lat, lng: md.lng, key: addr.id });
      if (md.municipality) setAddressMunicipality(md.municipality);
      else {
        const rev = await reverseGeocode(md.lat, md.lng);
        if (rev?.municipality) setAddressMunicipality(rev.municipality);
      }
    } else {
      // Dirección sin coords (legacy): geocodificar el texto para ubicar el pin.
      const q = [addr.address_1, addr.city, addr.province].filter(Boolean).join(", ");
      const geo = await geocodeAddress(q);
      if (geo) {
        setAddressCoords(geo);
        setMapsUrl(`https://www.google.com/maps?q=${geo.lat},${geo.lng}`);
        setPickerSeed({ lat: geo.lat, lng: geo.lng, key: addr.id });
        const rev = await reverseGeocode(geo.lat, geo.lng);
        if (rev?.municipality) setAddressMunicipality(rev.municipality);
      }
    }
  }, []);

  const formLoadTime = useRef<number>(Date.now());
  const [honeypot, setHoneypot] = useState("");
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(true);
  const [acceptedTos, setAcceptedTos] = useState(false);

  // Discount code
  const [discountCode, setDiscountCode] = useState("");
  const [discountApplied, setDiscountApplied] = useState<string | null>(null);
  const [discountError, setDiscountError] = useState("");
  const [discountLoading, setDiscountLoading] = useState(false);

  // Loyalty reward warning
  const [rewardWarning, setRewardWarning] = useState(false);

  // Loyalty rewards
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | null>(null);
  const [loyaltyRewards, setLoyaltyRewards] = useState<LoyaltyReward[]>([]);
  const [selectedRewards, setSelectedRewards] = useState<LoyaltyReward[]>([]);
  const checkoutTrackedRef = useRef(false);
  const identifiedEmailRef = useRef<string | null>(null);

  // Track checkout_started once per session (on first load with a populated cart)
  useEffect(() => {
    if (checkoutTrackedRef.current || !cart?.id || !cart.item_count) return;
    checkoutTrackedRef.current = true;
    trackCheckoutStarted({
      item_count: cart.item_count,
      subtotal: cart.subtotal ?? 0,
    });
  }, [cart?.id, cart?.item_count, cart?.subtotal]);

  // Identify the visitor in PostHog as soon as we have a syntactically
  // valid email — for guest checkouts (no NextAuth session) this is the
  // only chance to tie the anonymous distinct_id back to a person we
  // can find later by email in /admin/remarketing/user360. Without this,
  // every guest order shows up as "Usuario no identificado en PostHog"
  // even though we have all their behavioral data tied to the cookie
  // distinct_id. Calling identify with email-as-distinct-id merges the
  // anonymous person into the email-keyed person on PostHog's side.
  // Idempotent — we only call once per unique email per page load.
  useEffect(() => {
    const e = email?.trim().toLowerCase();
    if (!e) return;
    // Cheap email shape check — don't fire identify on every keystroke
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return;
    if (identifiedEmailRef.current === e) return;
    identifiedEmailRef.current = e;
    identifyCustomer({
      id: e,
      email: e,
      first_name: firstName?.trim() || undefined,
      last_name: lastName?.trim() || undefined,
      phone: phone?.trim() || undefined,
    });
  }, [email, firstName, lastName, phone]);

  // NOTA: la auto-aplicación de códigos COMBO/WHOLESALE fue removida.
  // Ahora el backend aplica los descuentos como line-item adjustments
  // automáticamente vía POST /store/carts/:id/recalculate-combos, llamado
  // por el cliente en `cart.ts` después de cada add/update/remove. Esa ruta
  // es la única autoritativa: cuenta SKUs únicos, aplica 10/15/20% a 1
  // unidad de cada línea no-mayorista, y 30% a todas las unidades de
  // líneas mayoristas (qty ≥ 24).

  useEffect(() => {
    if (!cart?.id) return;
    const loadFullCart = (attempt = 1) => {
      Promise.all([
        fetch(`/api/cart?cartId=${encodeURIComponent(cart.id)}`).then((r) => r.json()),
        cartApi.getRegionId("ve"),
      ])
        .then(([data, venezuelaRegionId]) => {
          const c = data.cart ?? data;
          // If region_id is missing and we have retries left, try again
          if (!c?.region_id && attempt < 3) {
            setTimeout(() => loadFullCart(attempt + 1), 800);
            return;
          }
          setFullCart(c);
          if (c.email) setEmail(c.email);
          if (c.shipping_address) {
            const a = c.shipping_address;
            // Only fill non-empty values so saved-address auto-fill isn't overwritten
            if (a.first_name) setFirstName(a.first_name);
            if (a.last_name) setLastName(a.last_name);
            if (a.phone) setPhone(a.phone);
            if (a.address_1) setAddress1(a.address_1);
            if (a.address_2) setAddress2(a.address_2);
            if (a.city) setCity(a.city);
            if (a.country_code) setCountryCode(a.country_code);
            if (a.province) setProvince(a.province);
          }
          setWrongRegion(
            venezuelaRegionId != null &&
              c.region_id != null &&
              c.region_id !== venezuelaRegionId
          );
        })
        .catch(() => {
          if (attempt < 3) setTimeout(() => loadFullCart(attempt + 1), 800);
          else setFullCart(null);
        });
    };
    loadFullCart();
  }, [cart?.id]);

  useEffect(() => {
    if (!cart?.id && !cartLoading) {
      router.replace("/carrito");
    }
  }, [cart, cartLoading, router]);

  // Load loyalty points + available rewards for logged-in users
  useEffect(() => {
    if (!isLoggedIn) return;
    Promise.all([
      fetch("/api/cuenta/loyalty").then((r) => r.json()),
      fetch("/api/cuenta/rewards").then((r) => r.json()),
    ])
      .then(([loyalty, rewardsData]) => {
        setLoyaltyPoints(loyalty.points ?? 0);
        setLoyaltyRewards(rewardsData.rewards ?? []);
      })
      .catch(() => {});
  }, [isLoggedIn]);

  useEffect(() => {
    fetch("/api/bcv-rate")
      .then((r) => r.json())
      .then((data) => {
        const factor = Number(data?.usdToBs ?? data?.usd);
        if (factor > 0) setBcvRate(factor);
      })
      .catch(() => {});
  }, []);

  // ─── CNE cedula validator ─────────────────────────────────────────────────
  // Consulta el API y compara contra el nombre escrito. Debounced 600ms.
  // Resultado = bloque advisory; nunca bloquea el submit por sí solo.
  type CedulaStatus = {
    status: "idle" | "loading" | "match" | "partial" | "mismatch" | "not_found" | "unavailable";
    cneName?: string;
  };
  const fetchCedulaStatus = async (
    ced: string,
    nat: "V" | "E",
    fullName: string,
    signal: AbortSignal,
  ): Promise<CedulaStatus> => {
    const r = await fetch(
      `/api/checkout/verify-cedula?nacionalidad=${nat}&cedula=${ced}`,
      { signal },
    );
    const data = (await r.json()) as { valid: boolean | null; name?: string; reason?: string };
    if (data.valid === true && data.name) {
      const result = compareNameToCne(fullName, data.name);
      return {
        status: result === "match" ? "match" : result === "partial" ? "partial" : "mismatch",
        cneName: data.name,
      };
    }
    if (data.valid === false && data.reason === "not_found") return { status: "not_found" };
    // null → no soportado (E) o servicio caído: no alarmar al usuario.
    return { status: "unavailable" };
  };

  // Cédula del COMPRADOR — se verifica SIEMPRE (vs nombre + apellido del comprador).
  useEffect(() => {
    const ced = cedula.replace(/\D/g, "");
    const fullName = `${firstName} ${lastName}`.trim();
    if (!ced || ced.length < 6 || !fullName) {
      setCedulaCheck({ status: "idle" });
      return;
    }
    setCedulaCheck({ status: "loading" });
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetchCedulaStatus(ced, nationality, fullName, controller.signal);
        if (!controller.signal.aborted) setCedulaCheck(res);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setCedulaCheck({ status: "unavailable" });
      }
    }, 600);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cedula, nationality, firstName, lastName]);

  // Cédula del RECEPTOR — solo cuando MRW + "para otra persona".
  useEffect(() => {
    if (shippingType !== "mrw" || recipientType !== "other") {
      setRecipientCedulaCheck({ status: "idle" });
      return;
    }
    const ced = recipientCedula.replace(/\D/g, "");
    const fullName = `${recipientFirstName} ${recipientLastName}`.trim();
    if (!ced || ced.length < 6 || !fullName) {
      setRecipientCedulaCheck({ status: "idle" });
      return;
    }
    setRecipientCedulaCheck({ status: "loading" });
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetchCedulaStatus(ced, recipientNationality, fullName, controller.signal);
        if (!controller.signal.aborted) setRecipientCedulaCheck(res);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setRecipientCedulaCheck({ status: "unavailable" });
      }
    }, 600);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingType, recipientType, recipientCedula, recipientNationality, recipientFirstName, recipientLastName]);

  // Auto-fill from logged-in customer profile (only if fields are still empty)
  useEffect(() => {
    if (!isLoggedIn) return;
    const token = (session as unknown as Record<string, unknown>)?.medusaToken as string;
    if (!token) return;
    fetch("/api/cuenta/profile", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const c = d.customer;
        if (!c) return;
        if (!email && c.email) setEmail(c.email);
        if (!firstName && c.first_name) setFirstName(c.first_name);
        if (!lastName && c.last_name) setLastName(c.last_name);
        const customerPhone = c.phone || "";
        if (!phone && customerPhone) setPhone(customerPhone);
        // Cédula guardada en metadata del customer (formato "V-12345678").
        // Se rellena solo si el campo está vacío; el cliente puede editarla.
        const savedCedula = (c.metadata?.cedula as string | undefined) || "";
        if (!cedula && savedCedula) {
          const m = savedCedula.match(/^([VE])-?(\d+)$/i);
          if (m) {
            setNationality(m[1].toUpperCase() as "V" | "E");
            setCedula(m[2]);
          }
        }
        // Pre-fill from default/first saved address — always auto-select on load.
        // applySavedAddress además resuelve coords (de metadata o geocodificando)
        // → el mapa se centra y el delivery se calcula sin quedar "por calcular".
        const addrs = (c.addresses ?? []) as SavedAddress[];
        if (addrs.length > 0) {
          setSavedAddresses(addrs);
          // Solo auto-aplicar si el usuario aún no escribió un teléfono propio,
          // para no pisar datos que ya venían del perfil.
          void applySavedAddress(addrs[0]);
        }
      })
      .catch(() => {});
  }, [isLoggedIn, session]); // eslint-disable-line

  const handleProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/jpg", "image/png"].includes(f.type)) {
      setError("Solo se permiten archivos JPG o PNG");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("La imagen no debe superar 5MB");
      return;
    }
    setError(null);
    setProofFile(f);
    // payment_method_selected: pago_movil es el único método hoy; lo marcamos
    // al subir el comprobante (señal fuerte de elección de método) para que el
    // funnel tenga el paso de selección de pago.
    trackPaymentMethodSelected({ method: "pago_movil", total: cart?.subtotal });
    trackPaymentProofUploaded({ method: "pago_movil", file_size_kb: Math.round(f.size / 1024) });
    const reader = new FileReader();
    reader.onload = () => setProofPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const removeProof = () => {
    setProofFile(null);
    setProofPreview(null);
  };

  // Loyalty computed values
  const pointsUsed = selectedRewards.reduce((s, r) => s + r.points_required, 0);
  const remainingPoints = (loyaltyPoints ?? 0) - pointsUsed;

  const toggleReward = (reward: LoyaltyReward) => {
    const isSelected = selectedRewards.some((r) => r.id === reward.id);
    if (isSelected) {
      setRewardWarning(false);
      setSelectedRewards((prev) => prev.filter((r) => r.id !== reward.id));
    } else {
      if (!cart?.items?.length) {
        setRewardWarning(true);
        return;
      }
      setRewardWarning(false);
      if (remainingPoints >= reward.points_required) {
        setSelectedRewards((prev) => [...prev, reward]);
      }
    }
  };

  const handleApplyDiscount = async () => {
    if (!discountCode.trim() || !cart?.id) return;
    setDiscountLoading(true);
    setDiscountError("");
    try {
      const res = await fetch("/api/checkout/discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId: cart.id, code: discountCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Código inválido");
      setDiscountApplied(discountCode.trim().toUpperCase());
      setDiscountError("");
      trackCouponApplied({
        code: discountCode.trim().toUpperCase(),
        discount_pct: data.discount_pct,
        discount_amount: data.discount_amount,
      });
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Código inválido";
      setDiscountError(msg);
      trackCouponFailed({ code: discountCode.trim().toUpperCase(), reason: msg });
    } finally {
      setDiscountLoading(false);
    }
  };

  const handleRemoveDiscount = async () => {
    if (!cart?.id || !discountApplied) return;
    try {
      await fetch("/api/checkout/discount", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId: cart.id, code: discountApplied }),
      });
    } catch {}
    setDiscountApplied(null);
    setDiscountCode("");
    setDiscountError("");
    await refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wrongRegion) return;
    if (!cart?.id) {
      setError("No se encontró el carrito. Recarga la página.");
      return;
    }
    if (!fullCart?.region_id) {
      setError("Cargando datos del carrito, espera un momento e intenta de nuevo.");
      return;
    }
    // Inmediato Valencia: ubicación exacta es obligatoria. Sin coords
    // el mensajero pierde tiempo buscando la casa y los pedidos se
    // atrasan — política que pidió el dueño. El cliente puede tipear
    // la dirección y elegir una sugerencia (que devuelve lat/lng) o
    // usar el botón "Compartir mi ubicación GPS" del autocomplete.
    if (shippingType === "inmediato" && !addressCoords) {
      setError(
        "Para envío inmediato en Valencia necesitamos tu ubicación exacta. " +
        "Escribe tu dirección y selecciona una sugerencia del mapa, o usa el " +
        "botón 'Compartir mi ubicación GPS'."
      );
      return;
    }
    // 21:15 cutoff con alternativa: si el cliente marca inmediato
    // después de las 21:15 (hora Venezuela), pedirle que confirme
    // explícitamente que su pedido se entregará MAÑANA, no esta
    // noche. Sin esa confirmación, no dejamos pasar — para que un
    // cliente apurado no descubra a las 10pm que su pedido no llega.
    if (
      shippingType === "inmediato" &&
      isAfterImmediateCutoff() &&
      !acceptedScheduledNextDay
    ) {
      setError(
        "Los pedidos inmediatos se entregan hasta las 9pm. Como ya pasó esa hora, " +
        "tu pedido se programará para mañana después de las 9am. Marca la casilla " +
        '"Acepto entrega mañana" o cambia a envío nacional (MRW).'
      );
      return;
    }
    if (!proofFile) {
      setError("Debes subir la captura del pago");
      return;
    }
    if (!acceptedTos) {
      setError("Debes aceptar los Términos y Condiciones para continuar");
      return;
    }
    // Bot protection: honeypot filled or form submitted too fast
    if (honeypot || Date.now() - formLoadTime.current < 3000) return;

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", proofFile);
      const uploadRes = await fetch("/api/checkout/upload-proof", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Error al subir la imagen");
      }
      const { url } = await uploadRes.json();

      // For MRW + recipient=other, the shipping address must show the RECEIVER's
      // name/cedula/phone (because that's what MRW validates against), not the
      // buyer's. Buyer details remain on the order/customer side via metadata.
      const isMrwOther = shippingType === "mrw" && recipientType === "other";
      const shipFirst = isMrwOther ? recipientFirstName.trim() : firstName.trim();
      const shipLast = isMrwOther ? recipientLastName.trim() : lastName.trim();
      const shipPhone = isMrwOther ? recipientPhone.trim() : phone.trim();

      const address = {
        first_name: shipFirst,
        last_name: shipLast,
        phone: shipPhone,
        address_1: address1.trim(),
        address_2: address2?.trim() || undefined,
        city: city.trim(),
        country_code: (countryCode || "ve").toLowerCase(),
        province: province?.trim() || undefined,
        postal_code: "",
      };

      // Cédula en la orden. La del COMPRADOR se guarda SIEMPRE (ahora se pide
      // en todos los pedidos). Para MRW + "otra persona" la cédula que MRW
      // validará es la del receptor, y guardamos ambas + datos del receptor.
      const buyerCed = cedula.replace(/\D/g, "");
      let mrwIdMeta: Record<string, unknown> = {};
      if (buyerCed) {
        mrwIdMeta = {
          cedula: `${nationality}-${buyerCed}`,
          cedula_owner: "self",
        };
      }
      if (shippingType === "mrw" && recipientType === "other") {
        const rCed = recipientCedula.replace(/\D/g, "");
        mrwIdMeta = {
          ...mrwIdMeta,
          // MRW valida contra el receptor → esa es la cédula "operativa" del envío.
          cedula: rCed ? `${recipientNationality}-${rCed}` : mrwIdMeta.cedula,
          cedula_owner: "other",
          recipient_first_name: recipientFirstName.trim(),
          recipient_last_name: recipientLastName.trim(),
          recipient_phone: recipientPhone.trim(),
          recipient_cedula: rCed ? `${recipientNationality}-${rCed}` : "",
          // Cédula del comprador preservada aparte para admin/Telegram.
          buyer_cedula: buyerCed ? `${nationality}-${buyerCed}` : "",
          buyer_first_name: firstName.trim(),
          buyer_last_name: lastName.trim(),
          buyer_phone: phone.trim(),
          buyer_email: email.trim(),
        };
      }

      // Inmediato shipping ahora cobra por DISTANCIA (delivery por km),
      // calculado client-side en `deliveryQuote` (lib/delivery). Reglas:
      //   - Valencia  → tarifa por km; GRATIS si subtotal ≥ €10.
      //   - San Diego → EXCLUIDO del envío gratis; siempre cobra por km.
      // El fee va al total mostrado + a la metadata (igual que Vovo); el
      // operador reconcilia el pago_movil contra ese total. NO toca el
      // pipeline de pago. La metadata alimenta Telegram + finanzas.
      const FREE_SHIPPING_THRESHOLD_EUR = FREE_MIN_EUR;
      const isInmediatoFree = shippingType === "inmediato" && (deliveryQuote?.free ?? false);
      const shippingCost =
        shippingType === "inmediato" ? Number(deliveryQuote?.fee ?? 0) : 0;

      // For MRW orders: try to find the closest MRW office to the customer's
      // address so the team in Telegram sees a clickable pin (with agency name
      // when available) right next to the shipping address.
      let mrwOfficeMeta: Record<string, unknown> = {};
      if (shippingType === "mrw" && addressCoords) {
        try {
          const office = await findNearestMrwOffice(addressCoords.lat, addressCoords.lng);
          if (office) {
            mrwOfficeMeta = {
              mrw_office_name: office.name,
              mrw_office_address: office.address,
              mrw_office_url: office.maps_url,
              ...(office.place_id ? { mrw_office_place_id: office.place_id } : {}),
            };
          }
        } catch (err) {
          console.warn("[checkout] MRW office lookup failed:", err);
        }
      }

      // Inmediato: persist coords + maps URL on the order so the
      // Telegram notification (order-whatsapp-notify subscriber) can
      // render a "📍 Ver en Maps" link for the courier. The MRW path
      // already saves these via mrw_office_*, but inmediato hits a
      // different metadata block.
      const inmediatoLocationMeta: Record<string, unknown> =
        shippingType === "inmediato" && addressCoords
          ? {
              delivery_lat: addressCoords.lat,
              delivery_lng: addressCoords.lng,
              delivery_maps_url: `https://www.google.com/maps?q=${addressCoords.lat},${addressCoords.lng}`,
              // Delivery por km: fee + zona + municipio para que el operador
              // cobre el monto correcto y finanzas lo concilie.
              delivery_fee: Number(deliveryQuote?.fee ?? 0),
              delivery_zone: deliveryQuote?.zone ?? "unknown",
              delivery_municipality: addressMunicipality || "",
              delivery_road_km: deliveryQuote?.roadKm ?? null,
              delivery_label: deliveryQuote?.label ?? "",
            }
          : {};

      // Next-day flag — surfaced by Telegram + the operator panel so a
      // pedido placed at 22:30 doesn't get expedited by mistake. The
      // submit gate ahead enforces that the customer accepted this
      // explicitly when `isAfterImmediateCutoff()` is true.
      const scheduledMeta: Record<string, unknown> =
        shippingType === "inmediato" && isAfterImmediateCutoff()
          ? {
              scheduled_for_next_day: true,
              scheduled_delivery_window: "next_day_after_9am",
            }
          : {};

      const updateRes = await fetch("/api/checkout/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartId: cart.id,
          email: email.trim(),
          shipping_address: address,
          billing_address: address,
          metadata: {
            payment_proof_url: url,
            shipping_type: shippingType,
            shipping_cost: shippingCost,
            tos_accepted_at: new Date().toISOString(),
            ...(mapsUrl ? { maps_url: mapsUrl } : {}),
            ...mrwOfficeMeta,
            ...inmediatoLocationMeta,
            ...scheduledMeta,
            ...mrwIdMeta,
            // Free-shipping promo flags — surfaced by the bot + finance module.
            // savings = la tarifa por km que se habría cobrado de no superar
            // el umbral (ahorro real del cliente).
            ...(isInmediatoFree
              ? {
                  free_shipping_applied: true,
                  free_shipping_threshold_eur: FREE_SHIPPING_THRESHOLD_EUR,
                  free_shipping_savings_eur:
                    addressCoords ? quoteByDistance(addressCoords).feeEur : 0,
                }
              : {}),
            ...(selectedRewards.length > 0 ? {
              redeemed_rewards: selectedRewards.map((r) => ({ id: r.id, name: r.name, points: r.points_required })),
              total_points_redeemed: pointsUsed,
            } : {}),
          },
        }),
      });
      const updateData = await updateRes.json().catch(() => ({}));
      if (!updateRes.ok) {
        const msg =
          updateData?.message ||
          updateData?.error ||
          (typeof updateData === "string" ? updateData : null);
        throw new Error(
          msg
            ? `Error al actualizar datos: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`
            : "Error al actualizar datos"
        );
      }

      let collectionId = fullCart.payment_collection?.id;
      if (!collectionId) {
        const pcRes = await fetch("/api/checkout/payment-collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart_id: cart.id }),
        });
        if (!pcRes.ok) throw new Error("Error al crear sesión de pago");
        const pcData = await pcRes.json();
        collectionId = pcData.payment_collection?.id;
      }
      if (!collectionId) throw new Error("No se pudo obtener la colección de pago");

      const shippingOptionsRes = await fetch(
        `/api/checkout/shipping-options?cartId=${encodeURIComponent(cart.id)}`
      );
      const shippingData = await shippingOptionsRes.json();
      const raw = shippingData.shipping_options ?? shippingData.options ?? [];
      const options = Array.isArray(raw) ? raw : [];
      if (options.length === 0) {
        throw new Error(
          "No hay opciones de envío. Prueba: 1) Vacía el carrito (abajo), vuelve a la tienda, añade productos y repite el checkout. 2) En Medusa Admin: Settings → Stock Locations → Valencia → activa Manual en Fulfillment Providers."
        );
      }
      const selectedOption = selectShippingOption(options, shippingType, cart.subtotal);
      if (!selectedOption) {
        throw new Error(
          "No se encontró la opción de envío seleccionada. Intenta de nuevo."
        );
      }
      const shipRes = await fetch("/api/checkout/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId: cart.id, option_id: selectedOption.id }),
      });
      if (!shipRes.ok) {
        const errData = await shipRes.json().catch(() => ({}));
        throw new Error(errData?.message || errData?.error || "Error al aplicar el envío");
      }

      const providersRes = await fetch(
        `/api/checkout/payment-providers?regionId=${encodeURIComponent(fullCart.region_id)}`
      );
      const providersData = await providersRes.json();
      const providers = providersData.payment_providers ?? providersData ?? [];
      const providerId = Array.isArray(providers)
        ? providers[0]?.id ?? "pp_system_default"
        : "pp_system_default";

      const sessionRes = await fetch("/api/checkout/payment-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionId,
          provider_id: providerId,
          data: { payment_proof_url: url },
        }),
      });
      if (!sessionRes.ok) {
        const err = await sessionRes.json().catch(() => ({}));
        throw new Error(err?.message || err?.error || "Error al crear sesión de pago");
      }

      // Redeem loyalty rewards before completing order
      if (selectedRewards.length > 0 && isLoggedIn) {
        const redeemRes = await fetch("/api/cuenta/loyalty/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reward_ids: selectedRewards.map((r) => r.id) }),
        });
        if (!redeemRes.ok) {
          const redeemErr = await redeemRes.json().catch(() => ({}));
          throw new Error(redeemErr.error || "Error al canjear los puntos");
        }
      }

      const completeRes = await fetch("/api/checkout/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId: cart.id }),
      });
      const completeData = await completeRes.json();

      if (completeData.type === "order" && completeData.order) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("ryo_cart_id");
        }
        const order = completeData.order;
        const emailToUse = order?.email ?? email?.trim();
        // Last-chance identify — covers visitors who reached order
        // placement without having triggered the email-typed-in
        // useEffect above (paste from password manager into a hidden
        // field, autofilled in one shot, etc.). No-op if we already
        // identified them earlier this session.
        if (emailToUse) {
          const e = emailToUse.toLowerCase();
          identifyCustomer({
            id: e,
            email: e,
            first_name: firstName?.trim() || undefined,
            last_name: lastName?.trim() || undefined,
            phone: phone?.trim() || undefined,
          });
        }
        // Orden del funnel: el step "completed" va ANTES de order_placed
        // para que los funnels de orden estricto (started → step → placed)
        // no se rompan por timestamps invertidos.
        trackCheckoutStep({ step: "completed", item_count: cart?.item_count, subtotal: cart?.subtotal });
        trackOrderPlaced({
          order_id: order.id,
          total: order.total ?? cart?.subtotal ?? 0,
          items: cart?.item_count ?? 0,
          payment_method: "pago_movil",
        });
        // Recordar la cédula del comprador en su perfil → auto-rellena la
        // próxima compra. Best-effort: si falla, no afecta el pedido.
        if (isLoggedIn && buyerCed) {
          fetch("/api/cuenta/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ metadata: { cedula: `${nationality}-${buyerCed}` } }),
          }).catch(() => {});
        }
        if (emailToUse) {
          fetch("/api/checkout/send-confirmation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order,
              email: emailToUse,
              bcvRate: bcvRate ?? undefined,
              paymentProofUrl: url,
              shippingType,
              redeemedRewards: selectedRewards.length > 0 ? selectedRewards : undefined,
              totalPointsRedeemed: pointsUsed > 0 ? pointsUsed : undefined
            }),
          }).catch(() => {});
          if (subscribeNewsletter) {
            fetch("/api/newsletter", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: emailToUse, name: `${firstName} ${lastName}`.trim() }),
            }).catch(() => {});
          }
        }
        await refresh();
        router.push(`/checkout/gracias?order=${completeData.order.id}`);
      } else {
        throw new Error(
          completeData.error?.message || completeData.message || "Error al completar el pedido"
        );
      }
    } catch (err) {
      // If we already redeemed rewards but order failed, reverse the redemption
      if (selectedRewards.length > 0 && isLoggedIn) {
        fetch("/api/cuenta/loyalty/redeem", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reward_ids: selectedRewards.map((r) => r.id) }),
        }).catch(() => {});
      }
      setError(err instanceof Error ? err.message : "Error al procesar el pedido");
    } finally {
      setSubmitting(false);
    }
  };

  if (cartLoading || (!cart && !cartLoading)) {
    return (
      <div className="min-h-screen bg-cream">
        <Header />
        <main className="max-w-[1380px] mx-auto px-4 py-8">
          <p className="text-muted">Cargando...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!cart?.items?.length) {
    return (
      <div className="min-h-screen bg-cream">
        <Header />
        <main className="max-w-[1380px] mx-auto px-4 py-8 text-center">
          <p className="text-muted text-lg mb-4">Tu carrito está vacío</p>
          <Link
            href="/tienda"
            className="inline-block bg-primary text-white px-8 py-3 font-bold text-sm uppercase tracking-wide border-2 border-dark hover:bg-primary/80 transition-colors"
          >
            IR A LA TIENDA
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const handleClearCartAndRetry = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("ryo_cart_id");
    }
    refresh();
    router.push("/carrito");
  };

  return (
    <div className="min-h-screen bg-cream">
      <Header />

      <main className="max-w-[1380px] mx-auto px-4 py-8 md:py-12 overflow-x-clip">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm mb-6 font-medium">
          <Link href="/carrito" className="text-muted hover:text-primary transition-colors">Carrito</Link>
          <span className="text-primary font-bold">&rarr;</span>
          <span className="text-dark font-bold">Envío & Pago</span>
        </nav>

        <div className="flex items-center gap-4 mb-8">
          <div className="h-1 w-12 bg-primary" />
          <h1 className="font-black text-dark text-4xl md:text-6xl uppercase tracking-tight">
            Checkout
          </h1>
        </div>

        {/* Club Enrola banner — only for guests */}
        {!isLoggedIn && (
          <div className="mb-8 border-[3px] border-dark p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 mr-1.5"
            style={{ background: "var(--secondary)", boxShadow: "6px 6px 0px 0px #1A1A1A" }}>
            <div className="flex-shrink-0 w-12 h-12 bg-orange border-2 border-dark flex items-center justify-center shadow-[2px_2px_0px_0px_#1A1A1A]">
              <Star size={24} strokeWidth={3} className="text-white" fill="white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-base uppercase tracking-wide text-cream">¡Únete al Club Enrola y gana puntos!</p>
              <p className="text-cream/80 text-sm mt-0.5">
                Regístrate gratis y acumula <strong className="text-orange">10 puntos por cada $1</strong> de compra. Canjéalos por recompensas exclusivas.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0 flex-wrap">
              <Link
                href={`/registro?redirect=/checkout`}
                className="flex items-center gap-2 bg-orange text-white px-5 py-2.5 font-black text-sm uppercase tracking-widest border-2 border-dark shadow-[3px_3px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all whitespace-nowrap"
              >
                <UserPlus size={16} strokeWidth={2.5} />
                Crear Cuenta
              </Link>
              <Link
                href={`/login?callbackUrl=/checkout`}
                className="bg-transparent text-cream px-5 py-2.5 font-black text-sm uppercase tracking-widest border-2 border-cream/60 hover:border-orange hover:text-orange transition-colors whitespace-nowrap"
              >
                Iniciar Sesión
              </Link>
            </div>
          </div>
        )}

        {wrongRegion && (
          <div className="mb-8 border-3 border-dark bg-amber-50 p-6" style={{ borderWidth: "3px", boxShadow: "4px 4px 0 0 var(--primary)" }}>
            <h3 className="font-bold text-amber-900 text-lg mb-2">
              Tu carrito usa otra region
            </h3>
            <p className="text-amber-800 mb-4 text-sm">
              Este carrito fue creado con una región que no incluye Venezuela. Para enviar a
              Venezuela, vacía el carrito y vuelve a añadir los productos.
            </p>
            <button
              type="button"
              onClick={handleClearCartAndRetry}
              className="bg-primary text-white px-6 py-3 font-bold text-sm uppercase border-2 border-dark hover:bg-primary/80 transition"
            >
              Vaciar carrito e ir a la tienda
            </button>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="grid md:grid-cols-3 gap-4 md:gap-8 w-full"
          style={{ opacity: wrongRegion ? 0.6 : 1, pointerEvents: wrongRegion ? "none" : "auto" }}
        >
          {/* Honeypot — hidden from humans, bots fill this */}
          <div style={{ position: "absolute", left: "-9999px", opacity: 0, pointerEvents: "none" }} aria-hidden="true">
            <input
              type="text"
              name="_hp"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-4 md:space-y-6 min-w-0 overflow-hidden">
            {/* Shipping form */}
            <div className="border-3 border-dark bg-white p-4 md:p-6 shadow-[3px_3px_0_0_var(--secondary)] md:shadow-[6px_6px_0_0_var(--secondary)]" style={{ borderWidth: "3px" }}>
              <h2 className="font-black text-dark text-lg uppercase tracking-wide mb-4 md:mb-5 pb-3 border-b-2 border-dark">
                Datos de Envío
              </h2>

              {/* Saved address selector — only for logged-in users with addresses */}
              {isLoggedIn && savedAddresses.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-bold text-dark uppercase tracking-wider mb-3 flex items-center gap-2">
                    <MapPin size={14} strokeWidth={2.5} />
                    Tus direcciones guardadas
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {savedAddresses.map((addr) => {
                      const isSelected = selectedAddressId === addr.id;
                      return (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => { void applySavedAddress(addr); }}
                          className={`text-left p-2.5 border-2 transition-all flex flex-col gap-1.5 ${
                            isSelected
                              ? "border-orange bg-orange/5 shadow-[3px_3px_0px_0px_var(--orange)]"
                              : "border-dark/20 hover:border-dark bg-cream/40"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${isSelected ? "border-orange bg-orange" : "border-dark/30"}`}>
                              {isSelected && <div className="w-1 h-1 rounded-full bg-white" />}
                            </div>
                            <p className="font-black text-xs text-dark truncate">
                              {addr.first_name} {addr.last_name}
                            </p>
                          </div>
                          <p className="text-[10px] text-muted leading-tight line-clamp-2 pl-[18px]">
                            {addr.address_1}{addr.city ? `, ${addr.city}` : ""}
                          </p>
                        </button>
                      );
                    })}
                    {/* Option to enter a new address — spans full row */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAddressId(null);
                        setAddress1(""); setAddress2(""); setCity(""); setProvince("");
                        // Limpiar coords/municipio → el usuario marcará el punto en el mapa.
                        setAddressCoords(null);
                        setAddressMunicipality("");
                        setPickerSeed(null);
                      }}
                      className={`col-span-2 text-left p-2.5 border-2 transition-all flex items-center gap-2 ${
                        selectedAddressId === null
                          ? "border-orange bg-orange/5 shadow-[3px_3px_0px_0px_var(--orange)]"
                          : "border-dashed border-dark/20 hover:border-dark bg-cream/20"
                      }`}
                    >
                      <Plus size={14} strokeWidth={2.5} className="text-muted flex-shrink-0" />
                      <span className="text-xs font-bold text-muted uppercase tracking-wide">Usar otra dirección</span>
                    </button>
                  </div>
                  <div className="border-b-2 border-dashed border-dark/10 mt-5 mb-4" />
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-dark uppercase tracking-wider mb-2">Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="vintage-input w-full"
                  />
                  <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={subscribeNewsletter}
                      onChange={(e) => setSubscribeNewsletter(e.target.checked)}
                      className="w-4 h-4 accent-orange"
                    />
                    <span className="text-xs text-dark/70 font-medium">Suscribirme al newsletter de Enrola para recibir novedades y ofertas</span>
                  </label>
                </div>
                <div>
                  <WhatsAppPhoneInput
                    value={phone}
                    onChange={setPhone}
                    showHelper
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-dark uppercase tracking-wider mb-2">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="vintage-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-dark uppercase tracking-wider mb-2">Apellido *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="vintage-input w-full"
                  />
                </div>
                {/* Cédula del comprador — siempre requerida + verificación CNE */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-dark uppercase tracking-wider mb-2">Cédula *</label>
                  <div className="flex gap-2">
                    <select
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value as "V" | "E")}
                      className="vintage-input w-20 flex-shrink-0"
                      aria-label="Nacionalidad"
                    >
                      <option value="V">V</option>
                      <option value="E">E</option>
                    </select>
                    <input
                      type="text"
                      required
                      inputMode="numeric"
                      value={cedula}
                      onChange={(e) => setCedula(e.target.value.replace(/\D/g, ""))}
                      placeholder="12345678"
                      className="vintage-input w-full"
                    />
                  </div>
                  {/* Estado de verificación (advisory, no bloquea el submit) */}
                  {cedulaCheck.status === "loading" && (
                    <p className="mt-1.5 text-xs text-muted">Verificando cédula…</p>
                  )}
                  {cedulaCheck.status === "match" && (
                    <p className="mt-1.5 text-xs text-emerald-700 font-medium">✅ Cédula verificada{cedulaCheck.cneName ? ` · ${cedulaCheck.cneName}` : ""}</p>
                  )}
                  {cedulaCheck.status === "partial" && (
                    <p className="mt-1.5 text-xs text-amber-700 font-medium">⚠️ El nombre coincide parcialmente con el registrado{cedulaCheck.cneName ? ` (${cedulaCheck.cneName})` : ""}. Revisa que esté bien.</p>
                  )}
                  {cedulaCheck.status === "mismatch" && (
                    <p className="mt-1.5 text-xs text-primary font-medium">⚠️ El nombre no coincide con el registrado para esa cédula{cedulaCheck.cneName ? ` (${cedulaCheck.cneName})` : ""}.</p>
                  )}
                  {cedulaCheck.status === "not_found" && (
                    <p className="mt-1.5 text-xs text-primary font-medium">⚠️ No encontramos esa cédula. Verifica el número.</p>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-xs font-bold text-dark uppercase tracking-wider mb-2">
                  Dirección *
                  {shippingType === "inmediato" && (
                    <span className="ml-1.5 text-orange font-normal normal-case tracking-normal">
                      con ubicación exacta
                    </span>
                  )}
                </label>
                {shippingType === "inmediato" ? (
                  /* Mapa Leaflet + autocomplete + GPS (sin Google key).
                     Setea coords + municipio → habilita la tarifa por km y
                     la exclusión de San Diego del envío gratis. */
                  <DeliveryLocationPicker
                    seed={pickerSeed}
                    onUpdate={(loc) => {
                      setAddress1(loc.shortAddr || loc.address || address1);
                      if (loc.city) setCity(loc.city);
                      if (loc.state) setProvince(loc.state);
                      setCountryCode("VE");
                      setMapsUrl(loc.mapsUrl);
                      setAddressCoords({ lat: loc.lat, lng: loc.lng });
                      setAddressMunicipality(loc.municipality);
                    }}
                  />
                ) : (
                  <AddressAutocomplete
                    value={address1}
                    onChange={setAddress1}
                    onSelect={(components) => {
                      setAddress1(components.address_1);
                      if (components.city) setCity(components.city);
                      if (components.province) setProvince(components.province);
                      if (components.country_code) setCountryCode(components.country_code.toUpperCase());
                      if (components.maps_url) setMapsUrl(components.maps_url);
                      if (
                        typeof components.lat === "number" &&
                        typeof components.lng === "number"
                      ) {
                        setAddressCoords({ lat: components.lat, lng: components.lng });
                      } else {
                        setAddressCoords(null);
                      }
                    }}
                    required
                    placeholder="Empieza a escribir tu dirección..."
                  />
                )}
                {/* Inmediato Valencia — ubicación obligatoria. Banner
                    rojo cuando falta, verde cuando ya tenemos coords.
                    El cliente tiene dos formas de cumplir: tipear la
                    dirección y elegir una sugerencia (devuelve coords)
                    o el botón "Mi ubicación" del autocomplete que usa
                    navigator.geolocation. */}
                {shippingType === "inmediato" && (
                  <div
                    className={`mt-2 p-2.5 text-xs font-medium border-2 ${
                      addressCoords
                        ? "border-secondary/40 bg-secondary/10 text-dark"
                        : "border-primary bg-primary/5 text-primary"
                    }`}
                  >
                    {addressCoords ? (
                      <>
                        ✓ Ubicación confirmada — el mensajero te ubicará en el mapa
                        <a
                          href={`https://www.google.com/maps?q=${addressCoords.lat},${addressCoords.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 underline hover:text-orange"
                        >
                          Ver pin
                        </a>
                        {deliveryQuote && (
                          <span className="block mt-1 font-bold normal-case">
                            🛵 Delivery: {deliveryQuote.label}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        Para envío inmediato necesitamos tu ubicación exacta.
                        Elige una sugerencia del mapa o usa el botón
                        <strong> &quot;Mi ubicación&quot; </strong>
                        arriba.
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-4">
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Referencia (opcional)</label>
                <input
                  type="text"
                  value={address2}
                  onChange={(e) => setAddress2(e.target.value)}
                  placeholder="Punto de referencia"
                  className="vintage-input w-full"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-xs font-bold text-dark uppercase tracking-wider mb-2">Ciudad *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="vintage-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-dark uppercase tracking-wider mb-2">Estado</label>
                  <input
                    type="text"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="vintage-input w-full"
                  />
                </div>
              </div>
              <div className="mt-5">
                <label className="block text-xs font-bold text-dark uppercase tracking-wider mb-2">Tipo de Envío *</label>
                <div className="flex gap-3">
                  <label className={`flex-1 flex items-center gap-3 p-3 border-2 cursor-pointer transition-all ${shippingType === "inmediato" ? "border-primary bg-primary/5" : "border-dark/20 hover:border-dark"}`}>
                    <input
                      type="radio"
                      name="shippingType"
                      value="inmediato"
                      checked={shippingType === "inmediato"}
                      onChange={() => setShippingType("inmediato")}
                      className="accent-primary"
                    />
                    <div>
                      <p className="font-bold text-sm text-dark">
                        Inmediato
                        {isAfterImmediateCutoff() && shippingType === "inmediato" && (
                          <span className="ml-1 text-orange normal-case">· mañana</span>
                        )}
                      </p>
                      <p className="text-xs text-muted">
                        Solo Valencia
                        {isAfterImmediateCutoff() && " · hasta 9pm"}
                      </p>
                    </div>
                  </label>
                  <label className={`flex-1 flex items-center gap-3 p-3 border-2 cursor-pointer transition-all ${shippingType === "mrw" ? "border-primary bg-primary/5" : "border-dark/20 hover:border-dark"}`}>
                    <input
                      type="radio"
                      name="shippingType"
                      value="mrw"
                      checked={shippingType === "mrw"}
                      onChange={() => setShippingType("mrw")}
                      className="accent-primary"
                    />
                    <div>
                      <p className="font-bold text-sm text-dark">Por MRW</p>
                      <p className="text-xs text-muted">Cobro a destino</p>
                    </div>
                  </label>
                </div>

                {/* 21:15 cutoff. Si seleccionó inmediato fuera del
                    horario válido (después de 21:15 o antes de 6am
                    hora Caracas), exigir confirmación explícita de
                    que su pedido se entrega MAÑANA. Sin checkbox
                    marcado, handleSubmit bloquea. Ofrece también la
                    salida alternativa (cambiar a MRW). */}
                {shippingType === "inmediato" && isAfterImmediateCutoff() && (
                  <div
                    className="mt-3 p-3 border-2 border-orange bg-orange/5"
                    role="alert"
                  >
                    <p className="text-sm font-bold text-dark mb-2">
                      ⏰ Pedidos inmediatos hasta las 9:00pm
                    </p>
                    <p className="text-xs text-dark/80 mb-3 leading-relaxed">
                      Ya cerramos por hoy. Tu pedido inmediato se
                      programará para mañana después de las 9am, o
                      puedes cambiar a envío nacional MRW.
                    </p>
                    <label className="flex items-start gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={acceptedScheduledNextDay}
                        onChange={(e) =>
                          setAcceptedScheduledNextDay(e.target.checked)
                        }
                        className="mt-0.5 w-4 h-4 accent-orange flex-shrink-0"
                      />
                      <span className="text-xs text-dark font-medium">
                        Acepto que mi pedido se entregue{" "}
                        <strong>mañana después de 9am</strong>
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* MRW recipient + cedula block — only shown when MRW selected */}
              {shippingType === "mrw" && (
                <div className="mt-5 border-2 border-dark/15 bg-amber-50/40 p-4">
                  <p className="text-xs font-bold text-dark uppercase tracking-wider mb-3">
                    🪪 Datos para retirar en MRW
                  </p>
                  <p className="text-xs text-muted mb-3">
                    MRW exige cédula y nombre que coincidan con el receptor del envío. Si no coinciden, rechazan la entrega.
                  </p>

                  {/* Recipient toggle */}
                  <div className="flex gap-3 mb-4">
                    <label className={`flex-1 flex items-center gap-2 p-2 border-2 cursor-pointer text-sm ${recipientType === "self" ? "border-primary bg-primary/5" : "border-dark/20 hover:border-dark"}`}>
                      <input
                        type="radio"
                        name="recipientType"
                        value="self"
                        checked={recipientType === "self"}
                        onChange={() => setRecipientType("self")}
                        className="accent-primary"
                      />
                      <span className="font-medium text-dark">El envío es para mí</span>
                    </label>
                    <label className={`flex-1 flex items-center gap-2 p-2 border-2 cursor-pointer text-sm ${recipientType === "other" ? "border-primary bg-primary/5" : "border-dark/20 hover:border-dark"}`}>
                      <input
                        type="radio"
                        name="recipientType"
                        value="other"
                        checked={recipientType === "other"}
                        onChange={() => setRecipientType("other")}
                        className="accent-primary"
                      />
                      <span className="font-medium text-dark">Para otra persona</span>
                    </label>
                  </div>

                  {recipientType === "self" ? (
                    <p className="text-xs text-muted">
                      Usaremos la cédula <span className="font-bold text-dark">{cedula ? `${nationality}-${cedula}` : "que ingresaste arriba"}</span> y tu nombre para el retiro en MRW.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-muted uppercase mb-1">Nombre receptor *</label>
                        <input
                          type="text"
                          required
                          value={recipientFirstName}
                          onChange={(e) => setRecipientFirstName(e.target.value)}
                          className="vintage-input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-muted uppercase mb-1">Apellido receptor *</label>
                        <input
                          type="text"
                          required
                          value={recipientLastName}
                          onChange={(e) => setRecipientLastName(e.target.value)}
                          className="vintage-input w-full"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs font-bold text-muted uppercase mb-1">Tipo</label>
                          <select
                            value={recipientNationality}
                            onChange={(e) => setRecipientNationality(e.target.value as "V" | "E")}
                            className="vintage-input w-full"
                          >
                            <option value="V">V</option>
                            <option value="E">E</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-muted uppercase mb-1">Cédula receptor *</label>
                          <input
                            type="text"
                            required
                            inputMode="numeric"
                            value={recipientCedula}
                            onChange={(e) => setRecipientCedula(e.target.value.replace(/\D/g, ""))}
                            placeholder="12345678"
                            className="vintage-input w-full"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-muted uppercase mb-1">Teléfono receptor *</label>
                        <input
                          type="tel"
                          required
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(e.target.value)}
                          placeholder="04241234567"
                          className="vintage-input w-full"
                        />
                      </div>
                    </div>
                  )}

                  {/* Validación de la cédula del RECEPTOR (solo "para otra persona").
                       Para "self" el estado ya se muestra arriba en Datos de Envío. */}
                  {recipientType === "other" && recipientCedulaCheck.status === "match" && (
                    <p className="mt-3 text-xs text-emerald-700 font-medium">
                      ✅ Cédula del receptor verificada
                    </p>
                  )}
                  {recipientType === "other" && recipientCedulaCheck.status === "partial" && (
                    <div className="mt-3 p-2 bg-amber-100 border border-amber-300 text-xs text-amber-900">
                      ⚠️ El nombre del receptor coincide solo parcialmente con la cédula
                      {recipientCedulaCheck.cneName ? ` (registro: "${recipientCedulaCheck.cneName}")` : ""}.
                      Verifica los datos para evitar problemas con MRW.
                    </div>
                  )}
                  {recipientType === "other" && recipientCedulaCheck.status === "mismatch" && (
                    <div className="mt-3 p-2 bg-red-100 border border-red-400 text-xs text-red-900">
                      🚫 El nombre del receptor <strong>no coincide</strong> con la cédula
                      {recipientCedulaCheck.cneName ? ` (registro: "${recipientCedulaCheck.cneName}")` : ""}.
                      MRW probablemente rechazará el envío. Revisa el nombre o la cédula antes de continuar.
                    </div>
                  )}
                  {recipientType === "other" && recipientCedulaCheck.status === "not_found" && (
                    <div className="mt-3 p-2 bg-red-100 border border-red-400 text-xs text-red-900">
                      🚫 La cédula del receptor no está registrada. Verifica el número.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Payment */}
            <div className="border-3 border-dark bg-white p-4 md:p-6 shadow-[3px_3px_0_0_var(--secondary)] md:shadow-[6px_6px_0_0_var(--secondary)]" style={{ borderWidth: "3px" }}>
              <h2 className="font-black text-dark text-lg uppercase tracking-wide mb-5 pb-3 border-b-2 border-dark">
                Pago Móvil
              </h2>
              <div className="space-y-5 text-dark">
                {PAGO_MOVIL_INSTRUCTIONS.map((item) => (
                  <div
                    key={item.step}
                    className={item.step === 1 ? "sm:flex sm:items-start sm:gap-3 sm:flex-nowrap" : "flex gap-4"}
                  >
                    <div className={`flex gap-4 ${item.step === 1 ? "sm:flex-shrink-0" : ""}`}>
                      <span className="w-8 h-8 bg-primary text-white flex items-center justify-center font-black flex-shrink-0 text-sm">
                        {item.step}
                      </span>
                      <div>
                        <p className="font-bold text-sm">{item.text}</p>
                        {item.details}
                      </div>
                    </div>
                    {item.step === 1 && (
                      <div className="mt-3 sm:mt-0 sm:flex-shrink-0">
                        <Image
                          src="/pago-movil-qr.png"
                          alt="QR Pago Móvil"
                          width={140}
                          height={140}
                          className="block border-2 border-dark"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <label className="block text-xs font-bold text-dark uppercase tracking-wider mb-2">
                  Captura del pago * (JPG o PNG)
                </label>
                {!proofPreview ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-secondary cursor-pointer hover:border-primary transition-colors bg-cream/50">
                    <Upload className="w-8 h-8 text-muted mb-2" strokeWidth={2} />
                    <span className="text-sm text-muted font-medium">
                      Haz clic para subir la captura
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={handleProofChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative inline-block">
                    <img
                      src={proofPreview}
                      alt="Captura de pago"
                      className="max-h-48 border-2 border-dark"
                    />
                    <button
                      type="button"
                      onClick={removeProof}
                      className="absolute -top-2 -right-2 w-8 h-8 bg-primary text-white flex items-center justify-center border-2 border-dark hover:bg-primary/80"
                    >
                      <X size={16} strokeWidth={3} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="border-2 border-primary bg-primary/5 px-4 py-3 text-primary text-sm font-medium">
                {error}
              </div>
            )}
          </div>

          {/* Summary sidebar */}
          <div className="min-w-0 overflow-hidden">
            <div className="border-3 border-dark bg-white p-4 md:p-6 sticky top-24 shadow-[3px_3px_0px_0px_var(--primary)] md:shadow-[6px_6px_0px_0px_var(--primary)]" style={{ borderWidth: "3px" }}>
              <h2 className="font-black text-dark text-lg uppercase tracking-wide mb-5 pb-3 border-b-2 border-dark">
                Resumen
              </h2>
              <div className="space-y-3 mb-5">
                {cart.items.map((item) => {
                const thumbUrl = item.thumbnail?.startsWith("http")
                  ? item.thumbnail
                  : item.thumbnail && process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
                    ? `${process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL.replace(/\/$/, "")}${item.thumbnail.startsWith("/") ? "" : "/"}${item.thumbnail}`
                    : null;
                return (
                  <div key={item.id} className="flex gap-3 items-center">
                    <div className="w-14 h-14 border-2 border-dark overflow-hidden bg-cream flex-shrink-0 relative">
                      {thumbUrl ? (
                        <Image src={thumbUrl} alt={item.title} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted text-xs">&mdash;</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-dark text-sm truncate">{item.title}</p>
                      <p className="text-xs text-muted">
                        {item.quantity} &times; €{formatPrice(centsToDisplay(item.unit_price))}
                      </p>
                    </div>
                  </div>
                );
                })}
              </div>
              {/* Loyalty rewards redemption */}
              {isLoggedIn && loyaltyPoints !== null && loyaltyPoints > 0 && loyaltyRewards.length > 0 && (
                <div className="mb-4 pb-4 border-b border-dashed border-dark/15">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Star size={13} className="text-orange" fill="currentColor" />
                      <span className="text-xs font-black text-dark uppercase tracking-wider">Canjear Premios</span>
                    </div>
                    <span className="text-xs font-bold text-orange">{remainingPoints.toLocaleString()} pts disponibles</span>
                  </div>
                  {rewardWarning && (
                    <div className="flex items-start gap-2 bg-dark text-cream border-2 border-primary p-2.5 mb-2.5" style={{ boxShadow: "3px 3px 0px 0px var(--primary)" }}>
                      <span className="text-primary font-black text-base leading-none flex-shrink-0">!</span>
                      <p className="text-xs font-bold leading-snug">
                        Debes tener al menos un producto en tu carrito antes de canjear puntos.
                      </p>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {loyaltyRewards
                      .filter((r) => r.stock === null || r.stock === undefined || r.stock > 0)
                      .map((reward) => {
                        const isSelected = selectedRewards.some((r) => r.id === reward.id);
                        const canAfford = isSelected || remainingPoints >= reward.points_required;
                        return (
                          <button
                            key={reward.id}
                            type="button"
                            onClick={() => toggleReward(reward)}
                            disabled={!canAfford}
                            className={`w-full text-left p-2.5 border-2 flex items-center gap-2.5 transition-all ${
                              isSelected
                                ? "border-orange bg-orange/5 shadow-[2px_2px_0px_0px_var(--orange)]"
                                : canAfford
                                  ? "border-dark/20 hover:border-dark/50 bg-cream/30"
                                  : "border-dark/10 bg-cream/10 opacity-40 cursor-not-allowed"
                            }`}
                          >
                            <div className={`w-3.5 h-3.5 border-2 flex-shrink-0 flex items-center justify-center ${isSelected ? "border-orange bg-orange" : "border-dark/30"}`}>
                              {isSelected && <div className="w-1.5 h-1.5 bg-white" />}
                            </div>
                            {reward.image_url ? (
                              <img src={reward.image_url} alt={reward.name} className="w-8 h-8 object-cover border border-dark/20 flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 bg-cream border border-dark/20 flex items-center justify-center flex-shrink-0">
                                <Gift size={14} className="text-dark/40" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-xs text-dark truncate">{reward.name}</p>
                              {reward.description && (
                                <p className="text-[10px] text-muted truncate">{reward.description}</p>
                              )}
                            </div>
                            <span className={`text-xs font-black flex-shrink-0 ${isSelected ? "text-orange" : canAfford ? "text-dark/60" : "text-dark/30"}`}>
                              {reward.points_required.toLocaleString()} pts
                            </span>
                          </button>
                        );
                    })}
                  </div>
                  {selectedRewards.length > 0 && (
                    <p className="text-[10px] text-dark/50 mt-2 font-medium">
                      {pointsUsed.toLocaleString()} pts se canjearán al confirmar el pedido
                    </p>
                  )}
                </div>
              )}

              {/* Discount code */}
              <div className="mb-4 pb-4 border-b border-dashed border-dark/15">
                <label className="block text-xs font-bold text-dark uppercase tracking-wider mb-2">Código de descuento</label>
                {discountApplied ? (
                  <div className="flex items-center gap-2 bg-green-50 border-2 border-green-600 px-3 py-2">
                    <span className="text-green-700 text-xs font-black uppercase tracking-wide flex-1">✓ {discountApplied} aplicado</span>
                    <button type="button" onClick={handleRemoveDiscount} className="text-green-600 hover:text-red-500 text-xs font-bold transition-colors">✕</button>
                  </div>
                ) : (
                  <div className="flex gap-2 min-w-0 w-full">
                    <input
                      type="text"
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                      placeholder="CÓDIGO"
                      className="vintage-input min-w-0 flex-1 text-sm uppercase"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleApplyDiscount(); } }}
                    />
                    <button
                      type="button"
                      onClick={handleApplyDiscount}
                      disabled={discountLoading || !discountCode.trim()}
                      className="bg-dark text-cream px-3 py-2 font-black text-xs uppercase border-2 border-dark shadow-[3px_3px_0px_0px_#FF3B27] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 w-14"
                    >
                      {discountLoading ? "..." : "OK"}
                    </button>
                  </div>
                )}
                {discountError && <p className="text-primary text-xs mt-1.5 font-medium">{discountError}</p>}
              </div>

              {/* Combo discount banner */}
              <div className="mb-4">
                <ComboTierBanner compact />
              </div>

              <div className="border-t-2 border-dashed border-secondary/40 pt-4 space-y-2 mb-6">
                {selectedRewards.map((r) => (
                  <div key={r.id} className="flex justify-between items-center text-sm">
                    <span className="text-dark font-medium flex items-center gap-1.5 min-w-0">
                      <Gift size={12} className="text-orange flex-shrink-0" />
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className="font-black text-green-600 uppercase text-xs flex-shrink-0 ml-2">GRATIS</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm">
                  <span className="text-muted font-medium uppercase">Subtotal</span>
                  <span className="font-bold">€{cart.subtotal.toFixed(2)}</span>
                </div>
                {(() => {
                  const combo = applyComboDiscount(cart.subtotal, cart.item_count, cart.items.map(i => ({ quantity: i.quantity, unit_price: centsToDisplay(i.unit_price), variant_id: i.variant_id })));
                  return (
                    <>
                      {combo.activeTier && (
                        <div className="flex justify-between text-sm">
                          <span className="text-secondary font-bold uppercase">Dto. Combo {combo.activeTier.label}</span>
                          <span className="font-black text-secondary">-€{(combo.discount - combo.wholesaleDiscount).toFixed(2)}</span>
                        </div>
                      )}
                      {combo.hasWholesale && (
                        <div className="flex justify-between text-sm">
                          <span className="text-orange font-bold uppercase">Dto. Mayorista 30%</span>
                          <span className="font-black text-orange">-€{combo.wholesaleDiscount.toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
                {(() => {
                  // Delivery por km (inmediato). Para MRW el envío se cobra a
                  // destino. Si aún no hay ubicación, mostramos "por calcular".
                  const deliveryFee =
                    shippingType === "inmediato" ? Number(deliveryQuote?.fee ?? 0) : 0;
                  const envioText =
                    shippingType === "mrw"
                      ? "—"
                      : !addressCoords
                        ? "por calcular"
                        : deliveryQuote?.free
                          ? "€0.00"
                          : `€${deliveryFee.toFixed(2)}`;
                  const envioNote =
                    shippingType === "mrw"
                      ? " (cobro a destino)"
                      : deliveryQuote?.free
                        ? " (gratis)"
                        : deliveryQuote?.zone === "san_diego"
                          ? " (San Diego · por km)"
                          : " (por km)";
                  return (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted font-medium uppercase">
                        Envío
                        {shippingType === "inmediato" && envioNote}
                        {shippingType === "mrw" && envioNote}
                      </span>
                      <span className="font-bold">{envioText}</span>
                    </div>
                  );
                })()}
                {(() => {
                  const combo = applyComboDiscount(cart.subtotal, cart.item_count, cart.items.map(i => ({ quantity: i.quantity, unit_price: centsToDisplay(i.unit_price), variant_id: i.variant_id })));
                  const base = combo.activeTier ? combo.discountedTotal : cart.subtotal;
                  const shipping = shippingType === "inmediato" ? Number(deliveryQuote?.fee ?? 0) : 0;
                  return (
                    <div className="flex justify-between text-lg font-black pt-2 border-t border-dark/10">
                      <span className="uppercase">Total</span>
                      <span className={combo.activeTier ? "text-orange" : ""}>
                        €{(base + shipping).toFixed(2)}
                      </span>
                    </div>
                  );
                })()}
                {bcvRate && (() => {
                  const combo = applyComboDiscount(cart.subtotal, cart.item_count, cart.items.map(i => ({ quantity: i.quantity, unit_price: centsToDisplay(i.unit_price), variant_id: i.variant_id })));
                  const base = combo.activeTier ? combo.discountedTotal : cart.subtotal;
                  const shipping = shippingType === "inmediato" ? Number(deliveryQuote?.fee ?? 0) : 0;
                  const totalEur = base + shipping;
                  const totalBs = totalEur * bcvRate;
                  return (
                    <div className="pt-3 mt-2 border-t border-dark/10">
                      <p className="text-xs text-muted mb-1">Equivalente en bolívares (tasa EUR alcamb.io)</p>
                      <p className="text-base font-bold text-dark">
                        €{totalEur.toFixed(2)} EUR &asymp;{" "}
                        {totalBs.toLocaleString("es-VE", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        Bs
                      </p>
                    </div>
                  );
                })()}
              </div>
              <label className="flex items-start gap-2 mb-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acceptedTos}
                  onChange={(e) => setAcceptedTos(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-orange flex-shrink-0"
                />
                <span className="text-xs text-dark/80 font-medium leading-snug">
                  He leído y acepto los{" "}
                  <Link href="/terminos" target="_blank" className="font-bold underline hover:text-primary">
                    Términos y Condiciones
                  </Link>{" "}
                  y la{" "}
                  <Link href="/privacidad" target="_blank" className="font-bold underline hover:text-primary">
                    Política de Privacidad
                  </Link>
                  .
                </span>
              </label>
              <button
                type="submit"
                disabled={
                  submitting ||
                  !proofFile ||
                  wrongRegion === true ||
                  !acceptedTos ||
                  !fullCart?.region_id ||
                  (shippingType === "inmediato" && !addressCoords)
                }
                className="block w-full text-center bg-orange text-white py-4 font-black text-sm uppercase tracking-widest border-2 border-dark retro-shadow hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Procesando..." : "CONFIRMAR PEDIDO"}
              </button>
              <Link
                href="/carrito"
                className="block text-center mt-4 text-muted text-sm font-medium hover:text-dark uppercase"
              >
                Volver al carrito
              </Link>
              <button
                type="button"
                onClick={handleClearCartAndRetry}
                className="block w-full text-center mt-2 text-muted text-xs hover:text-primary underline"
              >
                Vaciar carrito e iniciar de nuevo
              </button>
            </div>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
}
