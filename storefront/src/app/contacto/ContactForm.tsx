"use client";

import Script from "next/script";
import { useState, useRef, useEffect } from "react";

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export default function ContactForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const formLoadTime = useRef<number>(Date.now());

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!RECAPTCHA_SITE_KEY) {
      setErrorMessage("reCAPTCHA no configurado. Añade NEXT_PUBLIC_RECAPTCHA_SITE_KEY.");
      setStatus("error");
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = (formData.get("name") as string)?.trim();
    const contact = (formData.get("contact") as string)?.trim();
    const message = (formData.get("message") as string)?.trim();

    if (!name || !contact || !message) {
      setErrorMessage("Completa todos los campos.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const win = window as Window & {
        grecaptcha?: {
          ready: (cb: () => void) => void;
          execute: (siteKey: string, options: { action: string }) => Promise<string>;
        };
      };

      if (!win.grecaptcha) {
        throw new Error("reCAPTCHA aún no ha cargado. Espera unos segundos e intenta de nuevo.");
      }

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("reCAPTCHA tardó demasiado. Desactiva bloqueadores de anuncios o inténtalo de nuevo.")),
          15000
        );
        win.grecaptcha!.ready(() => {
          clearTimeout(timeout);
          resolve();
        });
      });

      const token = await win.grecaptcha.execute(RECAPTCHA_SITE_KEY, {
        action: "contact",
      });

      if (!token) {
        throw new Error("No se pudo obtener el token reCAPTCHA");
      }

      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          contact,
          message,
          recaptchaToken: token,
          _hp: (formData.get("_hp") as string) || "",
          _ft: formLoadTime.current,
        }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Error al enviar");
      }

      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Error al enviar. Intenta de nuevo."
      );
    }
  }

  return (
    <>
      {RECAPTCHA_SITE_KEY && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
          strategy="afterInteractive"
        />
      )}

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        {/* Honeypot — hidden from humans, bots fill this */}
        <div style={{ position: "absolute", left: "-9999px", opacity: 0, pointerEvents: "none" }} aria-hidden="true">
          <input name="_hp" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="name" className="text-xs font-bold text-dark uppercase tracking-wider mb-2 block">
            Nombre
          </label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="Tu nombre"
            required
            disabled={status === "loading"}
            className="vintage-input w-full disabled:opacity-60"
          />
        </div>
        <div>
          <label htmlFor="contact" className="text-xs font-bold text-dark uppercase tracking-wider mb-2 block">
            Email o Instagram
          </label>
          <input
            id="contact"
            name="contact"
            type="text"
            placeholder="tu@email.com o @usuario"
            required
            disabled={status === "loading"}
            className="vintage-input w-full disabled:opacity-60"
          />
        </div>
        <div>
          <label htmlFor="message" className="text-xs font-bold text-dark uppercase tracking-wider mb-2 block">
            Mensaje
          </label>
          <textarea
            id="message"
            name="message"
            rows={4}
            placeholder="En que te podemos ayudar?"
            required
            disabled={status === "loading"}
            className="vintage-input w-full resize-none disabled:opacity-60"
          />
        </div>

        {status === "success" && (
          <div className="border-2 border-secondary bg-secondary/5 px-4 py-3 text-secondary text-sm font-bold">
            Mensaje enviado! Te responderemos pronto.
          </div>
        )}
        {status === "error" && errorMessage && (
          <div className="border-2 border-primary bg-primary/5 px-4 py-3 text-primary text-sm font-bold">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-orange text-white py-3.5 font-black text-sm uppercase tracking-widest border-2 border-dark retro-shadow hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {status === "loading" ? "Enviando..." : "ENVIAR MENSAJE"}
        </button>

        {/* reCAPTCHA disclosure — Google's own ToS require this when
            the v3 invisible badge is hidden, which we do via global
            CSS. Compliance reference: docs/compliance/02-WEB.md §8.2. */}
        <p className="text-[11px] text-dark/55 leading-relaxed mt-1">
          Este sitio está protegido por reCAPTCHA y se aplican la{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-orange"
          >
            Política de Privacidad
          </a>{" "}
          y los{" "}
          <a
            href="https://policies.google.com/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-orange"
          >
            Términos de Servicio
          </a>{" "}
          de Google.
        </p>
      </form>
    </>
  );
}
