"use client";

import { useState, useCallback, useEffect } from "react";
import { Copy, Share2, Users, Star, CheckCircle } from "lucide-react";

interface ReferralSectionProps {
  userEmail?: string | null;
  userName?: string | null;
}

interface ReferralStats {
  code: string | null;
  link: string | null;
  friends_invited: number;
  points_earned: number;
}

export default function ReferralSection({ userName }: ReferralSectionProps) {
  const [copied, setCopied] = useState(false);
  const [, setShareError] = useState(false);
  const [stats, setStats] = useState<ReferralStats>({
    code: null,
    link: null,
    friends_invited: 0,
    points_earned: 0,
  });
  const [loading, setLoading] = useState(true);

  // Pull canonical code + real stats from the backend on mount.
  useEffect(() => {
    let alive = true;
    fetch("/api/cuenta/referrals", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setStats({
          code: d.code ?? null,
          link: d.link ?? (d.code ? `https://enrola.shop/?ref=${d.code}` : null),
          friends_invited: Number(d.friends_invited ?? 0),
          points_earned: Number(d.points_earned ?? 0),
        });
      })
      .catch(() => { /* non-fatal — UI shows placeholders */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const referralCode = stats.code ?? (loading ? "..." : "ENR-XXXXX");
  const referralLink = stats.link ?? "https://enrola.shop/";

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = referralLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [referralLink]);

  const handleShare = useCallback(async () => {
    setShareError(false);
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Enrola Shop",
          text: `${userName || "Un amigo"} te invita a Enrola Shop. Usa este enlace para tu primera compra y ambos ganan 200 puntos de lealtad!`,
          url: referralLink,
        });
      } catch {
        // User cancelled share - no action needed
      }
    } else {
      // Fallback: copy to clipboard
      handleCopy();
    }
  }, [referralLink, userName, handleCopy]);

  const friendsInvited = stats.friends_invited;
  const pointsEarned = stats.points_earned;

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <div
        className="border-[3px] border-dark bg-dark text-cream p-6 md:p-8 relative overflow-hidden"
        style={{ boxShadow: "8px 8px 0px 0px var(--primary)" }}
      >
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-4 right-4 text-[120px] font-black leading-none select-none">
            &amp;
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange border-2 border-cream/30 flex items-center justify-center flex-shrink-0">
              <Users size={20} strokeWidth={2.5} />
            </div>
            <h2 className="font-black text-xl md:text-2xl uppercase tracking-wider">
              Invita Amigos, Gana Puntos
            </h2>
          </div>
          <p className="text-cream/70 text-sm md:text-base leading-relaxed max-w-lg">
            Comparte tu enlace. Cuando un amigo haga su primera compra, ambos ganan{" "}
            <span className="text-orange font-black">200 puntos</span> de lealtad.
          </p>
        </div>
      </div>

      {/* Referral link */}
      <div
        className="border-[3px] border-dark bg-white p-5"
        style={{ boxShadow: "6px 6px 0px 0px #1A1A1A" }}
      >
        <label className="block text-xs font-black uppercase tracking-widest text-dark mb-2">
          Tu enlace de referido
        </label>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              readOnly
              value={referralLink}
              className="vintage-input w-full text-sm font-mono bg-cream/50 cursor-text select-all"
              onFocus={(e) => e.target.select()}
            />
          </div>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-2 font-black text-xs uppercase tracking-widest border-2 border-dark transition-all ${
              copied
                ? "bg-green-500 text-white shadow-none translate-x-[2px] translate-y-[2px]"
                : "bg-orange text-white shadow-[4px_4px_0px_0px_#1A1A1A] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none"
            }`}
          >
            {copied ? (
              <>
                <CheckCircle size={14} strokeWidth={3} />
                <span className="hidden sm:inline">Copiado!</span>
              </>
            ) : (
              <>
                <Copy size={14} strokeWidth={2.5} />
                <span className="hidden sm:inline">Copiar enlace</span>
              </>
            )}
          </button>
        </div>

        {/* Referral code display */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-dark/50 font-medium">Tu codigo:</span>
          <span className="font-mono font-black text-sm bg-cream border-2 border-dark/20 px-2.5 py-0.5 tracking-wider">
            {referralCode}
          </span>
        </div>
      </div>

      {/* Share buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-2 bg-white text-dark px-5 py-3.5 font-black text-sm uppercase tracking-widest border-[3px] border-dark shadow-[5px_5px_0px_0px_#1A1A1A] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
        >
          <Copy size={16} strokeWidth={2.5} />
          Copiar Enlace
        </button>
        <button
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-2 bg-orange text-white px-5 py-3.5 font-black text-sm uppercase tracking-widest border-[3px] border-dark shadow-[5px_5px_0px_0px_#1A1A1A] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
        >
          <Share2 size={16} strokeWidth={2.5} />
          Compartir
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className="border-[3px] border-dark bg-white p-4 text-center"
          style={{ boxShadow: "4px 4px 0px 0px #1A1A1A" }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Users size={16} strokeWidth={2.5} className="text-orange" />
            <span className="text-xs font-black uppercase tracking-widest text-dark/60">
              Amigos Invitados
            </span>
          </div>
          <p className="font-black text-4xl text-dark">{friendsInvited}</p>
        </div>
        <div
          className="border-[3px] border-dark bg-white p-4 text-center"
          style={{ boxShadow: "4px 4px 0px 0px #1A1A1A" }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Star size={16} strokeWidth={2.5} className="text-orange" fill="currentColor" />
            <span className="text-xs font-black uppercase tracking-widest text-dark/60">
              Puntos por Referidos
            </span>
          </div>
          <p className="font-black text-4xl text-dark">{pointsEarned}</p>
        </div>
      </div>

      {/* How it works */}
      <div
        className="border-[3px] border-dark bg-cream p-5"
        style={{ boxShadow: "4px 4px 0px 0px var(--secondary)" }}
      >
        <h3 className="font-black text-sm uppercase tracking-widest text-dark mb-4">
          Como funciona
        </h3>
        <div className="space-y-3">
          {[
            { step: "1", text: "Comparte tu enlace unico con amigos y familiares" },
            { step: "2", text: "Tu amigo se registra y hace su primera compra" },
            { step: "3", text: "Ambos reciben 200 puntos de lealtad automaticamente" },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-7 h-7 bg-orange text-white border-2 border-dark flex items-center justify-center flex-shrink-0 font-black text-xs">
                {item.step}
              </div>
              <p className="text-sm text-dark/80 font-medium pt-1">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
