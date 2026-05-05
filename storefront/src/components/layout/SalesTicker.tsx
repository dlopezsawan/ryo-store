"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";

const NICKNAMES = [
  "Iguana Sigilosa", "Capybara Relajado", "Tucán Nocturno", "Pereza Zen",
  "Guacamaya Veloz", "Morrocoy Sabio", "Colibrí Inquieto", "Jaguar Tranquilo",
  "Delfín Curioso", "Mono Aullador Feliz", "Caimán Elegante", "Flamenco Audaz",
];

const NOTIFICATIONS = [
  { product: "Conos Hemp King Size", time: "hace 2 min" },
  { product: "Grinder Eléctrico USB", time: "hace 5 min" },
  { product: "Papers Celulosa Trip", time: "hace 8 min" },
  { product: "Filtros Carbón Activo", time: "hace 12 min" },
  { product: "Combo Starter Enrola", time: "hace 15 min" },
  { product: "Conos Celulosa Orgánica", time: "hace 18 min" },
  { product: "Papers Rolling Clásico", time: "hace 22 min" },
  { product: "Grinder Vidrio Azul", time: "hace 25 min" },
];

const STORAGE_KEY = "ryo-sales-ticker-dismissed";

/**
 * Subtle social-proof notification — fixed bottom-left,
 * flat design matching the Enrola vintage aesthetic.
 */
export default function SalesTicker() {
  const [dismissed, setDismissed] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY) === "true") return;
    setDismissed(false);
    // First notification after 5 seconds
    const timer = setTimeout(() => setVisible(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Cycle through notifications
  useEffect(() => {
    if (dismissed) return;
    if (!visible) return;

    // Show for 4s, then hide for 2s, then show next
    const hideTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % NOTIFICATIONS.length);
        setVisible(true);
      }, 2500);
    }, 4500);

    return () => clearTimeout(hideTimer);
  }, [visible, dismissed, currentIndex]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setVisible(false);
    if (typeof window !== "undefined") sessionStorage.setItem(STORAGE_KEY, "true");
  }, []);

  if (dismissed) return null;

  const notification = NOTIFICATIONS[currentIndex];
  const nickname = NICKNAMES[currentIndex % NICKNAMES.length];

  return (
    <div
      className={`fixed bottom-20 md:bottom-4 left-3 md:left-4 z-[60] transition-all duration-500 ease-out ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-3 opacity-0 pointer-events-none"
      }`}
    >
      <div className="flex items-center gap-2.5 bg-cream border-2 border-dark px-3.5 py-2 max-w-[280px] md:max-w-[300px]">
        <button
          onClick={handleDismiss}
          className="absolute -top-2 -right-2 w-5 h-5 bg-dark text-cream flex items-center justify-center hover:bg-dark/80 transition-colors"
          aria-label="Cerrar"
        >
          <X size={10} strokeWidth={3} />
        </button>
        <p className="text-[11px] md:text-xs leading-snug text-dark/70">
          <span className="font-bold text-dark">{nickname}</span>{" "}
          compró{" "}
          <span className="font-bold text-dark">{notification.product}</span>
          <span className="text-dark/35 ml-1.5 text-[10px]">{notification.time}</span>
        </p>
      </div>
    </div>
  );
}
