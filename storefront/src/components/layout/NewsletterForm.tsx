"use client";

import { useState } from "react";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setStatus(res.ok ? "ok" : "error");
      if (res.ok) setEmail("");
    } catch {
      setStatus("error");
    }
  };

  if (status === "ok") {
    return <p className="text-white font-bold text-lg">¡Gracias por suscribirte!</p>;
  }

  return (
    <form className="flex w-full md:w-auto max-w-md" onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="tu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={status === "loading"}
        className="flex-1 min-w-0 bg-white text-dark px-4 py-3 font-medium text-sm border-3 border-dark focus:outline-none disabled:opacity-60"
        style={{ borderWidth: "3px" }}
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="bg-dark text-cream px-6 py-3 font-black text-sm uppercase tracking-widest hover:bg-dark/80 hover:scale-105 transition-all flex-shrink-0 disabled:opacity-60"
      >
        {status === "loading" ? "..." : "SUSCRIBIR"}
      </button>
      {status === "error" && (
        <p className="absolute mt-12 text-red-300 text-xs font-medium">
          Error al suscribir, intenta de nuevo.
        </p>
      )}
    </form>
  );
}
