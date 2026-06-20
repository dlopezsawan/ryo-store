const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  process.env.MEDUSA_BACKEND_URL ||
  "http://localhost:9000";
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

export const medusaHeaders = (token?: string) => ({
  "Content-Type": "application/json",
  "x-publishable-api-key": PUB_KEY,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export async function medusaLogin(email: string, password: string) {
  const res = await fetch(`${BACKEND_URL}/auth/customer/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.token as string) || null;
}

export async function medusaRegister(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  phone?: string
) {
  // Step 1: create auth
  const authRes = await fetch(`${BACKEND_URL}/auth/customer/emailpass/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!authRes.ok) {
    const err = await authRes.json().catch(() => ({}));
    console.error("[medusaRegister] auth failed:", authRes.status, JSON.stringify(err));
    throw new Error(err?.message || "Error al registrarse");
  }
  const { token } = await authRes.json();

  // Step 2: create customer profile
  // If this call fails the auth identity exists but has no customer record,
  // which causes medusaGetMe to always return null and makes login impossible.
  const profileRes = await fetch(`${BACKEND_URL}/store/customers`, {
    method: "POST",
    headers: medusaHeaders(token),
    body: JSON.stringify({ email, first_name: firstName, last_name: lastName, ...(phone ? { phone } : {}) }),
  });
  if (!profileRes.ok) {
    const err = await profileRes.json().catch(() => ({}));
    console.error("[medusaRegister] profile create failed:", profileRes.status, JSON.stringify(err));
    throw new Error(err?.message || "Error al crear el perfil de cliente");
  }

  return token as string;
}

export async function medusaGetMe(token: string) {
  const res = await fetch(`${BACKEND_URL}/store/customers/me`, {
    headers: medusaHeaders(token),
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  const { customer } = await res.json();
  return customer;
}

export async function medusaGetOrders(token: string) {
  const res = await fetch(`${BACKEND_URL}/store/orders?limit=50&order=-created_at&fields=*items,*fulfillments,status,display_id,created_at,total,currency_code`, {
    headers: medusaHeaders(token),
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  // Medusa v2 doesn't sync order.status with fulfillment state.
  // Derive effective status from fulfillment timestamps.
  return (data.orders || []).map((o: Record<string, unknown>) => {
    const fulfillments = (o.fulfillments || []) as Array<{
      delivered_at?: string | null;
      shipped_at?: string | null;
      canceled_at?: string | null;
    }>;
    const latest = fulfillments[0];
    let effectiveStatus = o.status as string;
    if (latest?.delivered_at) {
      effectiveStatus = "delivered";
    } else if (latest?.shipped_at) {
      effectiveStatus = "shipped";
    } else if (fulfillments.length > 0 && !latest?.canceled_at) {
      effectiveStatus = "processing";
    }
    return { ...o, status: effectiveStatus };
  });
}

export async function medusaUpdateProfile(
  token: string,
  data: { first_name?: string; last_name?: string; phone?: string }
) {
  const res = await fetch(`${BACKEND_URL}/store/customers/me`, {
    method: "POST",
    headers: medusaHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.customer ?? null;
}

export async function medusaGetAddresses(token: string) {
  const res = await fetch(`${BACKEND_URL}/store/customers/me?fields=*addresses`, {
    headers: medusaHeaders(token),
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const { customer } = await res.json();
  return customer?.addresses ?? [];
}

export async function medusaAddAddress(
  token: string,
  address: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2?: string;
    city: string;
    province?: string;
    country_code: string;
    phone?: string;
    postal_code?: string;
    is_default_shipping?: boolean;
  }
) {
  const res = await fetch(`${BACKEND_URL}/store/customers/me/addresses`, {
    method: "POST",
    headers: medusaHeaders(token),
    body: JSON.stringify(address),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || "Error al guardar dirección");
  }
  const data = await res.json();
  return data;
}

export async function medusaDeleteAddress(token: string, addressId: string) {
  const res = await fetch(`${BACKEND_URL}/store/customers/me/addresses/${addressId}`, {
    method: "DELETE",
    headers: medusaHeaders(token),
  });
  return res.ok;
}
