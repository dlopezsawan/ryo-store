"use client";
import { SessionProvider } from "next-auth/react";
import { CartProvider } from "@/context/CartContext";
import { QuickViewProvider } from "@/context/QuickViewContext";
import CartDrawer from "@/components/cart/CartDrawer";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import ComboToast from "@/components/combo/ComboToast";
import UtmCapture from "@/components/UtmCapture";
import AttributionSync from "@/components/AttributionSync";
import ReferralCookieToast from "@/components/ReferralCookieToast";
import PosthogIdentify from "@/components/PosthogIdentify";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>
        <QuickViewProvider>
          <UtmCapture />
          <AttributionSync />
          <PosthogIdentify />
          {children}
          <CartDrawer />
          <ComboToast />
          <ReferralCookieToast />
          <MobileBottomNav />
        </QuickViewProvider>
      </CartProvider>
    </SessionProvider>
  );
}
