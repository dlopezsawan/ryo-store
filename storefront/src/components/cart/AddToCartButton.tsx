"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";

interface Props {
  variantId: string;
  label?: string;
  className?: string;
  /** Si true, redirige al carrito tras agregar. Si false, solo agrega */
  redirectToCart?: boolean;
}

export default function AddToCartButton({
  variantId,
  label = "AGREGAR AL CARRITO",
  className = "block w-full text-center bg-orange text-white py-4 font-black text-base uppercase tracking-widest border-2 border-dark retro-shadow hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all",
  redirectToCart = false,
}: Props) {
  const { addItem } = useCart();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    setErrorMsg(null);
    const { ok, error } = await addItem(variantId, 1);
    setLoading(false);
    if (ok) {
      if (redirectToCart) {
        router.push("/carrito");
      } else {
        setFeedback("success");
        setTimeout(() => setFeedback(null), 2000);
      }
    } else {
      setFeedback("error");
      setErrorMsg(error || "No se pudo añadir");
      setTimeout(() => { setFeedback(null); setErrorMsg(null); }, 5000);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`${className}${feedback === "success" ? " animate-check" : ""}${feedback === "error" ? " animate-shake" : ""}`}
      >
        {loading ? "Añadiendo..." : feedback === "success" ? "Añadido ✓" : label}
      </button>
      {feedback === "error" && errorMsg && (
        <p className="absolute left-0 right-0 top-full mt-2 text-center text-sm text-red-600 animate-fade-in-up">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
