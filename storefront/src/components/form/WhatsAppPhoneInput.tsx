"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle } from "lucide-react";

const COUNTRY_CODES = [
  { code: "+58", flag: "🇻🇪", name: "Venezuela", iso: "VE" },
  { code: "+34", flag: "🇪🇸", name: "España", iso: "ES" },
  { code: "+1", flag: "🇺🇸", name: "EE.UU.", iso: "US" },
  { code: "+52", flag: "🇲🇽", name: "México", iso: "MX" },
  { code: "+57", flag: "🇨🇴", name: "Colombia", iso: "CO" },
  { code: "+56", flag: "🇨🇱", name: "Chile", iso: "CL" },
  { code: "+54", flag: "🇦🇷", name: "Argentina", iso: "AR" },
  { code: "+51", flag: "🇵🇪", name: "Perú", iso: "PE" },
  { code: "+593", flag: "🇪🇨", name: "Ecuador", iso: "EC" },
  { code: "+507", flag: "🇵🇦", name: "Panamá", iso: "PA" },
  { code: "+506", flag: "🇨🇷", name: "Costa Rica", iso: "CR" },
  { code: "+55", flag: "🇧🇷", name: "Brasil", iso: "BR" },
  { code: "+44", flag: "🇬🇧", name: "Reino Unido", iso: "GB" },
  { code: "+33", flag: "🇫🇷", name: "Francia", iso: "FR" },
  { code: "+49", flag: "🇩🇪", name: "Alemania", iso: "DE" },
  { code: "+39", flag: "🇮🇹", name: "Italia", iso: "IT" },
  { code: "+351", flag: "🇵🇹", name: "Portugal", iso: "PT" },
];

/**
 * Normalize phone for WaSender format:
 * - Strip leading 0 for Venezuelan numbers (0412 → 412)
 * - Remove spaces, dashes, parentheses
 * - Prepend country code without +
 */
export function normalizePhone(countryCode: string, localNumber: string): string {
  let num = localNumber.replace(/[\s\-()]/g, "");

  // Venezuela: strip leading 0
  if (countryCode === "+58" && num.startsWith("0")) {
    num = num.substring(1);
  }

  const code = countryCode.replace("+", "");
  return `${code}${num}`;
}

interface WhatsAppPhoneInputProps {
  value: string;
  onChange: (fullNumber: string) => void;
  required?: boolean;
  showHelper?: boolean;
}

export default function WhatsAppPhoneInput({
  value,
  onChange,
  required = true,
  showHelper = false,
}: WhatsAppPhoneInputProps) {
  const [countryCode, setCountryCode] = useState("+58");
  const [localNumber, setLocalNumber] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Auto-detect country from browser locale/timezone (first mount only)
  useEffect(() => {
    if (initialized) return;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const locale = navigator.language || "";

    let detected = "+58";
    if (tz.includes("Madrid") || tz.includes("Europe/Madrid") || locale.startsWith("es-ES")) detected = "+34";
    else if (tz.includes("America/Bogota")) detected = "+57";
    else if (tz.includes("America/Mexico")) detected = "+52";
    else if (tz.includes("America/Santiago")) detected = "+56";
    else if (tz.includes("America/Argentina")) detected = "+54";
    else if (tz.includes("America/Lima")) detected = "+51";
    else if (tz.includes("America/New_York") || tz.includes("America/Chicago") || tz.includes("America/Los_Angeles")) detected = "+1";
    else if (tz.includes("Europe/London")) detected = "+44";
    else if (tz.includes("Europe/Paris")) detected = "+33";
    else if (tz.includes("Europe/Berlin")) detected = "+49";
    else if (tz.includes("Europe/Rome")) detected = "+39";
    else if (tz.includes("Europe/Lisbon")) detected = "+351";
    else if (tz.includes("America/Sao_Paulo")) detected = "+55";
    else if (tz.includes("America/Guayaquil")) detected = "+593";
    else if (tz.includes("America/Panama")) detected = "+507";
    else if (tz.includes("America/Costa_Rica")) detected = "+506";

    setCountryCode(detected);

    if (value) {
      const clean = value.replace(/[\s\-()]/g, "");
      const match = COUNTRY_CODES.find((c) => clean.startsWith(c.code.replace("+", "")));
      if (match) {
        setCountryCode(match.code);
        setLocalNumber(clean.substring(match.code.replace("+", "").length));
      } else {
        setLocalNumber(clean);
      }
    }

    setInitialized(true);
  }, [value, initialized]);

  // Re-parse when value changes from empty to filled (e.g. profile data loaded async)
  useEffect(() => {
    if (!initialized || !value || localNumber) return;
    const clean = value.replace(/[\s\-()]/g, "");
    if (!clean) return;
    const match = COUNTRY_CODES.find((c) => clean.startsWith(c.code.replace("+", "")));
    if (match) {
      setCountryCode(match.code);
      setLocalNumber(clean.substring(match.code.replace("+", "").length));
    } else {
      setLocalNumber(clean);
    }
  }, [value, initialized, localNumber]);

  const handleLocalChange = useCallback(
    (num: string) => {
      // Only allow digits
      const clean = num.replace(/\D/g, "");
      setLocalNumber(clean);
      onChange(normalizePhone(countryCode, clean));
    },
    [countryCode, onChange]
  );

  const handleCodeChange = useCallback(
    (code: string) => {
      setCountryCode(code);
      onChange(normalizePhone(code, localNumber));
    },
    [localNumber, onChange]
  );

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === countryCode) || COUNTRY_CODES[0];

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-bold text-dark uppercase tracking-wider">
        <MessageCircle size={13} strokeWidth={2.5} className="text-[#25D366]" />
        Número de WhatsApp {required && "*"}
      </label>
      <div className="flex gap-0">
        {/* Country code selector */}
        <select
          value={countryCode}
          onChange={(e) => handleCodeChange(e.target.value)}
          className="vintage-input rounded-r-none border-r-0 w-[100px] text-sm font-bold bg-cream pr-1 appearance-none"
          style={{ backgroundImage: "none" }}
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code}
            </option>
          ))}
        </select>
        {/* Phone number */}
        <input
          type="tel"
          required={required}
          value={localNumber}
          onChange={(e) => handleLocalChange(e.target.value)}
          placeholder={countryCode === "+58" ? "4121234567" : "612345678"}
          className="vintage-input rounded-l-none flex-1"
          inputMode="numeric"
        />
      </div>
      {showHelper && (
        <p className="text-[10px] text-dark/40 leading-snug">
          Recibirás actualizaciones de tu pedido por WhatsApp. Asegúrate de que el número sea correcto.
        </p>
      )}
      {countryCode === "+58" && localNumber.startsWith("0") && (
        <p className="text-[10px] text-orange font-bold">
          El 0 inicial se eliminará automáticamente al guardar
        </p>
      )}
    </div>
  );
}
