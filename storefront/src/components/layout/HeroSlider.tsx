"use client";
// v2 - BCV price labels
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface HeroSlide {
  slug: string;
  name: string;
  price: number;
  image: string;
}

export default function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    if (slides.length === 0) return;
    setCurrent((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  const slide = slides[current] ?? slides[0];
  if (!slide || slides.length === 0) return null;

  return (
    <div className="relative w-full max-w-[1100px] mx-auto">
      {/* Main card with retro border */}
      <div className="relative aspect-[16/9] md:aspect-[20/9] border-4 border-dark bg-dark overflow-hidden"
        style={{ boxShadow: "8px 8px 0px 0px var(--primary)" }}>
        {/* Slide images */}
        {slides.map((s, i) => (
          <div
            key={s.slug}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === current ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <Image
              src={s.image}
              alt={s.name}
              fill
              className="object-cover"
              priority={i === 0}
              fetchPriority={i === 0 ? "high" : "auto"}
              sizes="(max-width: 768px) 100vw, 1100px"
            />
            {/* Subtle gradient only at the bottom to keep title+price legible */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          </div>
        ))}

        {/* Product info overlay */}
        <div className="relative z-10 h-full px-5 md:px-10 py-5 md:py-8 flex flex-col justify-between">
          <div className="flex justify-start">
            <span className="inline-flex items-center bg-orange text-white px-3 py-1 text-xs font-black uppercase tracking-[0.15em] border-2 border-dark shadow-[3px_3px_0px_0px_#1A1A1A]">
              DESTACADO ENROLA
            </span>
          </div>
          <div className="flex items-end justify-between gap-4 md:gap-10">
            <div className="flex-1 min-w-0 max-w-[70%] md:max-w-[45%] text-left">
              <p
                className="font-bold text-white text-2xl md:text-[36px] leading-tight break-words"
                style={{ textShadow: "0 2px 8px rgba(0,0,0,0.75), 0 1px 3px rgba(0,0,0,0.9)" }}
              >
                {slide.name}
              </p>
              <p
                className="font-black text-white text-3xl md:text-[42px] leading-none mt-1"
                style={{ textShadow: "0 2px 10px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.9)" }}
              >
                €{formatPrice(slide.price)} <span className="text-sm font-bold text-white/70">BCV</span>
              </p>
            </div>
            <Link
              href={`/productos/${slide.slug}`}
              className="bg-orange text-white px-6 md:px-8 py-3 font-black text-sm uppercase tracking-widest rounded-lg border-2 border-dark shadow-[4px_4px_0px_0px_#1A1A1A] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all flex-shrink-0"
            >
              COMPRAR
            </Link>
          </div>
        </div>

      </div>

      {/* Dots + arrows below */}
      <div className="flex items-center justify-between gap-4 mt-5 px-1">
        <button
          onClick={prev}
          className="w-10 h-10 bg-dark text-cream flex items-center justify-center border-2 border-dark shadow-[4px_4px_0px_0px_#FF3B27] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all flex-shrink-0"
          aria-label="Anterior"
        >
          <ChevronLeft size={18} strokeWidth={3} />
        </button>
        <div className="flex items-center gap-2 flex-1 justify-center">
          {slides.map((s, i) => (
            <button
              key={s.slug}
              onClick={() => setCurrent(i)}
              aria-label={`Ver ${s.name}`}
              className={`transition-all duration-300 h-2.5 ${
                i === current
                  ? "w-10 bg-orange border border-dark"
                  : "w-4 bg-dark/25 hover:bg-dark/50"
              }`}
            />
          ))}
        </div>
        <button
          onClick={next}
          className="w-10 h-10 bg-dark text-cream flex items-center justify-center border-2 border-dark shadow-[4px_4px_0px_0px_#FF3B27] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all flex-shrink-0"
          aria-label="Siguiente"
        >
          <ChevronRight size={18} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
