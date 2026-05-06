"use client";

import { useEffect, useState } from "react";

const WORDS = ["ARMAR", "ENROLAR", "QUEMAR", "FACHAR", "VOLAR"];
const DISPLAY_MS = 2000;
const EXIT_MS    = 300;
const ENTER_MS   = 500;

export default function HeroTitle() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"enter" | "show" | "exit">("enter");

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (phase === "enter") {
      timeout = setTimeout(() => setPhase("show"), ENTER_MS);
    } else if (phase === "show") {
      timeout = setTimeout(() => setPhase("exit"), DISPLAY_MS);
    } else {
      timeout = setTimeout(() => {
        setIndex((i) => (i + 1) % WORDS.length);
        setPhase("enter");
      }, EXIT_MS);
    }
    return () => clearTimeout(timeout);
  }, [phase]);

  const animClass =
    phase === "enter" ? "hero-word-enter" :
    phase === "exit"  ? "hero-word-exit"  : "";

  return (
    <h1 className="hidden md:block font-black text-dark text-[clamp(1.55rem,6.2vw,5.4rem)] leading-[0.95] tracking-tight mb-7 md:mb-10">
      EL ARTE DE{" "}
      <span
        key={`${index}-${phase}`}
        className={`inline-flex items-baseline border-[3px] border-dark px-[0.18em] pt-[0.04em] pb-[0.14em] bg-white ${animClass}`}
        style={{
          color: "var(--orange)",
          boxShadow: "4px 4px 0px 0px #1A1A1A",
        }}
      >
        {WORDS[index]}
      </span>
    </h1>
  );
}
