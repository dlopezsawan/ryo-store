"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef, Suspense } from "react";
import { Menu, X, ShoppingBag, ChevronDown, User, LogOut, Package } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useCart } from "@/context/CartContext";
import SearchBar from "@/components/search/SearchBar";

interface Category { id: string; name: string; handle: string; }

const navLinks = [
  { href: "/tienda", label: "TIENDA" },
  { href: "/mayoristas", label: "MAYORISTAS" },
  { href: "/contacto", label: "CONTACTO" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tiendaOpen, setTiendaOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const tiendaRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { cart, openDrawer } = useCart();
  const itemCount = cart?.item_count ?? 0;
  const isLoggedIn = status === "authenticated";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setCategories(d.categories || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-cream border-b-[3px] border-dark">
      <div className="max-w-[1380px] mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-16 md:h-[72px]">
          {/* Logo — wordmark 1805×934 ratio (~1.93:1). Width set to keep
              consistent visual height (42-46px) regardless of viewport. */}
          <Link href="/" className="flex items-center flex-shrink-0 border-2 border-dark px-3 py-1 shadow-[3px_3px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all bg-white">
            <Image
              src="/logo-web-nuevo.svg"
              alt="Enrola"
              width={180}
              height={94}
              sizes="180px"
              className="h-[36px] md:h-[40px] w-auto"
              priority
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 lg:gap-12">
            {navLinks.map((link) =>
              link.href === "/tienda" ? (
                <div
                  key={link.href}
                  ref={tiendaRef}
                  className="relative"
                  onMouseEnter={() => setTiendaOpen(true)}
                  onMouseLeave={() => setTiendaOpen(false)}
                  onFocusCapture={() => setTiendaOpen(true)}
                  onBlurCapture={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setTiendaOpen(false);
                    }
                  }}
                >
                  <Link
                    href={link.href}
                    aria-expanded={tiendaOpen}
                    aria-haspopup="true"
                    className={`flex items-center gap-1 font-black text-sm tracking-[0.08em] uppercase transition-colors pb-0.5 ${
                      pathname === link.href || pathname.startsWith(link.href)
                        ? "text-primary border-b-[3px] border-primary"
                        : "text-dark hover:text-primary border-b-[3px] border-transparent hover:border-primary"
                    }`}
                  >
                    {link.label}
                    <ChevronDown
                      size={14}
                      strokeWidth={2.5}
                      className={`transition-transform duration-200 ${tiendaOpen ? "rotate-180" : ""}`}
                    />
                  </Link>

                  {/* Dropdown */}
                  {tiendaOpen && categories.length > 0 && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50 min-w-[180px]">
                    <div className="bg-cream border-[3px] border-dark shadow-[6px_6px_0px_0px_#1A1A1A]" role="menu">
                      <Link
                        href="/tienda"
                        role="menuitem"
                        className="block px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-dark hover:bg-orange hover:text-white transition-colors border-b-2 border-dark/20"
                      >
                        Todas
                      </Link>
                      {categories.map((cat) => (
                        <Link
                          key={cat.id}
                          href={`/tienda?category=${cat.id}`}
                          role="menuitem"
                          className="block px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-dark hover:bg-orange hover:text-white transition-colors border-b border-dark/10 last:border-0"
                        >
                          {cat.name}
                        </Link>
                      ))}
                    </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`font-black text-sm tracking-[0.08em] uppercase transition-colors pb-0.5 ${
                    pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href))
                      ? "text-primary border-b-[3px] border-primary"
                      : "text-dark hover:text-primary border-b-[3px] border-transparent hover:border-primary"
                  }`}
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>

          {/* Search + User + Cart */}
          <div className="flex items-center gap-2 md:gap-3">
            <Suspense fallback={<div className="w-5 h-5" aria-hidden />}>
              <SearchBar />
            </Suspense>

            {/* User button */}
            <div
              ref={userRef}
              className="relative hidden md:block"
              onMouseEnter={() => setUserOpen(true)}
              onMouseLeave={() => setUserOpen(false)}
              onFocusCapture={() => setUserOpen(true)}
              onBlurCapture={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setUserOpen(false);
                }
              }}
            >
              <button
                className="relative flex items-center gap-2 bg-white text-dark px-4 py-2 font-black text-sm uppercase tracking-widest border-2 border-dark shadow-[3px_3px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                aria-label="Cuenta"
                aria-expanded={userOpen}
                aria-haspopup="true"
              >
                <User size={16} strokeWidth={2.5} />
                {isLoggedIn && session?.user?.name ? (
                  <span className="max-w-[80px] truncate">{session.user.name.split(" ")[0]}</span>
                ) : null}
              </button>

              {userOpen && (
                <div className="absolute top-full right-0 pt-2 z-50 min-w-[180px]">
                  <div className="bg-cream border-[3px] border-dark shadow-[6px_6px_0px_0px_#1A1A1A]" role="menu">
                  {isLoggedIn ? (
                    <>
                      <Link
                        href="/cuenta"
                        role="menuitem"
                        className="flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest text-dark hover:bg-orange hover:text-white transition-colors border-b border-dark/10"
                      >
                        <Package size={14} strokeWidth={2.5} />
                        Mi Cuenta
                      </Link>
                      <button
                        onClick={() => signOut({ callbackUrl: "/" })}
                        role="menuitem"
                        className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest text-dark hover:bg-orange hover:text-white transition-colors"
                      >
                        <LogOut size={14} strokeWidth={2.5} />
                        Cerrar Sesión
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        role="menuitem"
                        className="block px-4 py-3 text-xs font-bold uppercase tracking-widest text-dark hover:bg-orange hover:text-white transition-colors border-b border-dark/10"
                      >
                        Iniciar Sesión
                      </Link>
                      <Link
                        href="/registro"
                        role="menuitem"
                        className="block px-4 py-3 text-xs font-bold uppercase tracking-widest text-dark hover:bg-orange hover:text-white transition-colors"
                      >
                        Registrarse
                      </Link>
                    </>
                  )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={openDrawer}
              className="relative flex items-center gap-2 bg-orange text-white px-4 py-2 font-black text-sm uppercase tracking-widest border-2 border-dark shadow-[3px_3px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
              aria-label="Abrir carrito"
            >
              <ShoppingBag size={16} strokeWidth={2.5} />
              <span className="hidden sm:inline">CARRITO</span>
              {itemCount > 0 && (
                <span key={itemCount} className="absolute -top-2 -right-2 min-w-[20px] h-5 bg-dark text-cream text-[11px] font-black border border-dark flex items-center justify-center px-1 cart-bounce">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </button>

            {/* Mobile toggle */}
            <button
              className="md:hidden text-dark p-1.5 border-2 border-dark shadow-[2px_2px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all bg-white"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              {menuOpen ? <X size={22} strokeWidth={2.5} /> : <Menu size={22} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t-2 border-dark bg-cream">
          <nav className="max-w-[1380px] mx-auto px-4 py-4 flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`font-bold text-lg tracking-wide uppercase py-2 border-b border-secondary/20 ${
                  pathname === link.href ? "text-primary" : "text-dark"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t-2 border-dark/20 pt-3 mt-1 flex flex-col gap-2">
              {isLoggedIn ? (
                <>
                  <Link
                    href="/cuenta"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 font-bold text-base tracking-wide uppercase py-2 text-dark"
                  >
                    <Package size={16} strokeWidth={2.5} />
                    Mi Cuenta
                  </Link>
                  <button
                    onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/" }); }}
                    className="flex items-center gap-2 font-bold text-base tracking-wide uppercase py-2 text-dark text-left"
                  >
                    <LogOut size={16} strokeWidth={2.5} />
                    Cerrar Sesión
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 font-bold text-base tracking-wide uppercase py-2 text-dark"
                  >
                    <User size={16} strokeWidth={2.5} />
                    Iniciar Sesión
                  </Link>
                  <Link
                    href="/registro"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 font-bold text-base tracking-wide uppercase py-2 text-dark"
                  >
                    <User size={16} strokeWidth={2.5} />
                    Registrarse
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
