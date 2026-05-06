"use client";

import { useState } from "react";
import Image from "next/image";

const COOKIE_NAME = "enrola_age_verified";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export default function AgeGate() {
  const [show, setShow] = useState(true);
  const [denied, setDenied] = useState(false);

  if (!show) return null;

  const handleAccept = () => {
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "; Secure"
        : "";
    document.cookie = `${COOKIE_NAME}=true; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
    setShow(false);
  };

  const handleDeny = () => {
    setDenied(true);
  };

  return (
    <div
      id="age-gate"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-dark p-4"
    >
      <div
        className="bg-cream border-[3px] border-orange w-full max-w-sm text-center"
        style={{ boxShadow: "4px 4px 0px 0px #E84B2B" }}
      >
        <div className="bg-dark px-6 py-4">
          <Image
            src="/logo-web-nuevo.svg"
            alt="Enrola"
            width={160}
            height={83}
            className="mx-auto brightness-0 invert"
            priority
          />
        </div>

        <div className="px-6 py-6">
          {denied ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-dark/10 flex items-center justify-center border-2 border-dark">
                <span className="text-3xl">🚫</span>
              </div>
              <h2 className="font-black text-dark text-lg uppercase tracking-wider mb-2">
                Acceso restringido
              </h2>
              <p className="text-dark/60 text-sm mb-6">
                Debes ser mayor de 18 para acceder a enrola.shop
              </p>
              <a
                href="https://google.com"
                className="inline-block w-full bg-dark text-white py-3 font-black text-xs uppercase tracking-widest border-2 border-dark hover:bg-dark/80 transition-colors"
              >
                Salir
              </a>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange/10 flex items-center justify-center border-2 border-dark">
                <span className="font-black text-orange text-2xl">18+</span>
              </div>
              <h2 className="font-black text-dark text-lg uppercase tracking-wider mb-2">
                Verificación de edad
              </h2>
              <p className="text-dark/60 text-sm mb-6">
                Este sitio vende productos para mayores de 18 años. ¿Confirmas que eres mayor de edad?
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleAccept}
                  className="w-full bg-orange text-white py-3 font-black text-xs uppercase tracking-widest border-2 border-dark hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                  style={{ boxShadow: "3px 3px 0px 0px #1A1A1A" }}
                >
                  Sí, soy mayor de 18
                </button>
                <button
                  onClick={handleDeny}
                  className="w-full bg-white text-dark py-3 font-black text-xs uppercase tracking-widest border-2 border-dark hover:bg-dark/5 transition-colors"
                >
                  No, soy menor de edad
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
