"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

interface SuggestionProduct {
  id: string;
  title: string;
  handle: string;
  slug: string;
}

interface SuggestionsResponse {
  products: SuggestionProduct[];
  keywords: string[];
}

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 1;

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(qFromUrl);
  const [suggestions, setSuggestions] = useState<SuggestionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  // Controls whether the compact icon is expanded (tablet/mobile)
  const [expanded, setExpanded] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(qFromUrl);
  }, [qFromUrl]);

  // Focus input when expanded on small screens
  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < MIN_QUERY_LENGTH) {
      setSuggestions(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: SuggestionsResponse = await res.json();
        setSuggestions(data);
        setHighlighted(0);
        // Track performed searches with results count (once the suggestions actually load)
        try {
          const { trackSearchPerformed } = await import("@/lib/posthog");
          trackSearchPerformed({
            query: q,
            results_count: (data.products?.length ?? 0) + (data.keywords?.length ?? 0),
            source: "header",
          });
        } catch { /* noop */ }
      } else {
        setSuggestions(null);
      }
    } catch {
      setSuggestions(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions(null);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query);
      setOpen(true);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const totalItems = (suggestions?.products?.length ?? 0) + (suggestions?.keywords?.length ?? 0);
  const hasSuggestions = totalItems > 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); setExpanded(false); return; }
    if (!open || !hasSuggestions) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((i) => (i < totalItems - 1 ? i + 1 : 0)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((i) => (i > 0 ? i - 1 : totalItems - 1)); return; }
    if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      const prodCount = suggestions!.products!.length;
      if (highlighted < prodCount) {
        const p = suggestions!.products![highlighted];
        router.push(`/productos/${p.slug || p.handle}`);
      } else {
        const kw = suggestions!.keywords![highlighted - prodCount];
        router.push(`/tienda?q=${encodeURIComponent(kw)}`);
      }
      setOpen(false);
      setExpanded(false);
    }
  };

  const goToSearch = (kw: string) => {
    router.push(`/tienda?q=${encodeURIComponent(kw)}`);
    setOpen(false);
    setExpanded(false);
    setQuery(kw);
  };

  const suggestions_dropdown = (
    <div
      id="search-suggestions"
      role="listbox"
      className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-dark shadow-[4px_4px_0_0_#1A1A1A] overflow-hidden z-50 max-h-[320px] overflow-y-auto"
    >
      {loading ? (
        <div className="px-4 py-6 text-center text-dark/40 text-sm">Buscando...</div>
      ) : hasSuggestions ? (
        <div className="py-1">
          {suggestions!.products!.length > 0 && (
            <div className="px-3 py-1.5">
              <p className="text-xs font-bold text-dark/40 uppercase tracking-wider">Productos</p>
            </div>
          )}
          {suggestions!.products!.map((p, i) => (
            <Link
              key={p.id}
              href={`/productos/${p.slug || p.handle}`}
              onClick={() => { setOpen(false); setExpanded(false); }}
              role="option"
              aria-selected={highlighted === i}
              className={`block px-4 py-2.5 text-dark font-medium hover:bg-cream transition-colors ${highlighted === i ? "bg-cream" : ""}`}
              onMouseEnter={() => setHighlighted(i)}
            >
              {p.title}
            </Link>
          ))}
          {suggestions!.keywords!.length > 0 && (
            <div className="px-3 py-1.5 mt-1 border-t-2 border-dark/10">
              <p className="text-xs font-bold text-dark/40 uppercase tracking-wider">Sugerencias</p>
            </div>
          )}
          {suggestions!.keywords!.map((kw, i) => {
            const idx = suggestions!.products!.length + i;
            return (
              <button
                key={kw}
                type="button"
                onClick={() => goToSearch(kw)}
                role="option"
                aria-selected={highlighted === idx}
                className={`block w-full text-left px-4 py-2.5 text-dark font-medium hover:bg-cream transition-colors ${highlighted === idx ? "bg-cream" : ""}`}
                onMouseEnter={() => setHighlighted(idx)}
              >
                {kw}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-6 text-center text-dark/40 text-sm">No hay sugerencias</div>
      )}
    </div>
  );

  return (
    <div
      ref={wrapperRef}
      className="relative flex items-center"
    >
      {/* ── DESKTOP (lg+): always visible input ── */}
      <form
        action="/tienda"
        method="get"
        className="relative hidden lg:flex items-center w-[220px] xl:w-[260px]"
        onSubmit={() => setOpen(false)}
      >
        <Search className="text-dark/50 flex-shrink-0 absolute left-2.5 w-3.5 h-3.5 pointer-events-none z-10" />
        <input
          ref={inputRef}
          type="search"
          name="q"
          placeholder="Buscar..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= MIN_QUERY_LENGTH && setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className="w-full bg-white pl-8 pr-2 py-1.5 text-dark placeholder-dark/40 font-bold text-sm focus:outline-none border-2 border-dark shadow-[3px_3px_0px_0px_#1A1A1A] focus:shadow-[3px_3px_0px_0px_var(--primary)] rounded-none transition-shadow"
          aria-label="Buscar productos"
          aria-expanded={open && hasSuggestions}
          aria-controls="search-suggestions"
          role="combobox"
        />
        {open && query.trim().length >= MIN_QUERY_LENGTH && suggestions_dropdown}
      </form>

      {/* ── TABLET + MOBILE (< lg): icon → expands to input ── */}
      <div className="lg:hidden flex items-center">
        {!expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="p-1.5 border-2 border-dark shadow-[2px_2px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all bg-white text-dark"
            aria-label="Abrir búsqueda"
          >
            <Search size={18} strokeWidth={2.5} />
          </button>
        ) : (
          <form
            action="/tienda"
            method="get"
            className="relative flex items-center"
            onSubmit={() => { setOpen(false); setExpanded(false); }}
          >
            <Search className="text-dark/50 flex-shrink-0 absolute left-2.5 w-3.5 h-3.5 pointer-events-none z-10" />
            <input
              ref={inputRef}
              type="search"
              name="q"
              placeholder="Buscar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.length >= MIN_QUERY_LENGTH && setOpen(true)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              className="w-[180px] sm:w-[220px] bg-white pl-8 pr-8 py-1.5 text-dark placeholder-dark/40 font-bold text-sm focus:outline-none border-2 border-dark shadow-[3px_3px_0px_0px_#1A1A1A] rounded-none"
              aria-label="Buscar productos"
            />
            <button
              type="button"
              onClick={() => { setExpanded(false); setOpen(false); setQuery(""); }}
              className="absolute right-2 text-dark/50 hover:text-dark"
              aria-label="Cerrar búsqueda"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
            {open && query.trim().length >= MIN_QUERY_LENGTH && suggestions_dropdown}
          </form>
        )}
      </div>
    </div>
  );
}
