"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { identifyCustomer, resetPosthog } from "@/lib/posthog";

/**
 * Mounts once; every time auth status changes, identifies the customer in
 * PostHog (and resets on logout so the next anonymous session starts clean).
 */
export default function PosthogIdentify() {
  const { data: session, status } = useSession();
  const lastIdentifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const u = session.user as Record<string, unknown>;
      const id = String(u.id || u.customer_id || u.email || "");
      if (!id || id === lastIdentifiedRef.current) return;
      lastIdentifiedRef.current = id;
      identifyCustomer({
        id,
        email: typeof u.email === "string" ? u.email : undefined,
        first_name: typeof u.first_name === "string" ? u.first_name : undefined,
        last_name: typeof u.last_name === "string" ? u.last_name : undefined,
        phone: typeof u.phone === "string" ? u.phone : undefined,
      });
    } else if (status === "unauthenticated" && lastIdentifiedRef.current) {
      lastIdentifiedRef.current = null;
      resetPosthog();
    }
  }, [status, session?.user]);

  return null;
}
