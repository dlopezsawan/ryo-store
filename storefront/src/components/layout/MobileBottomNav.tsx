"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Store, ShoppingBag, User } from "lucide-react";
import { useCart } from "@/context/CartContext";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { cart, openDrawer } = useCart();
  const itemCount = cart?.item_count ?? 0;

  // Hide on product pages (StickyBuyBar replaces it) and maintenance
  if (pathname.startsWith("/productos/") || pathname === "/mantenimiento") return null;

  const tabs = [
    { href: "/", label: "Home", icon: Home },
    { href: "/tienda", label: "Tienda", icon: Store },
    { href: "#carrito", label: "Carrito", icon: ShoppingBag, isCart: true },
    { href: "/cuenta", label: "Cuenta", icon: User },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "#carrito") return false;
    return pathname === href || pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-cream border-t-[3px] border-dark md:hidden">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const Icon = tab.icon;

          if (tab.isCart) {
            return (
              <button
                key={tab.href}
                onClick={openDrawer}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative transition-colors ${
                  active ? "text-orange" : "text-dark/60"
                }`}
              >
                <div className="relative">
                  <Icon size={20} strokeWidth={2.5} />
                  {itemCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 bg-orange text-white text-[9px] font-black border border-dark flex items-center justify-center px-0.5">
                      {itemCount > 99 ? "99+" : itemCount}
                    </span>
                  )}
                </div>
                <span className="font-black text-[9px] uppercase tracking-wider">
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                active ? "text-orange" : "text-dark/60"
              }`}
            >
              <Icon size={20} strokeWidth={2.5} />
              <span className="font-black text-[9px] uppercase tracking-wider">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
