"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Star, Package, User, MapPin, LogOut, Gift, Plus, Trash2, Check, ChevronDown, ShoppingCart, Users } from "lucide-react";
import Image from "next/image";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ReferralSection from "@/components/account/ReferralSection";
import AddressAutocomplete from "@/components/address/AddressAutocomplete";
import WhatsAppPhoneInput from "@/components/form/WhatsAppPhoneInput";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  display_id: number;
  status: string;
  created_at: string;
  total: number;
  currency_code: string;
  items: { title: string; quantity: number; unit_price: number }[];
}

interface LoyaltyTransaction {
  id: string;
  points: number;
  type: string;
  order_id?: string;
  description?: string;
  created_at: string;
}

interface LoyaltyReward {
  id: string;
  name: string;
  description?: string;
  points_required: number;
  image_url?: string;
  stock?: number | null;
}

interface Address {
  id: string;
  first_name?: string;
  last_name?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  province?: string;
  country_code?: string;
  phone?: string;
  postal_code?: string;
}

type Tab = "club" | "pedidos" | "referidos" | "datos" | "direcciones";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  processing: { label: "En proceso", color: "bg-blue-100 text-blue-800 border-blue-300" },
  shipped: { label: "Enviado", color: "bg-purple-100 text-purple-800 border-purple-300" },
  delivered: { label: "Entregado", color: "bg-green-100 text-green-800 border-green-300" },
  completed: { label: "Completado", color: "bg-green-100 text-green-800 border-green-300" },
  canceled: { label: "Cancelado", color: "bg-red-100 text-red-800 border-red-300" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800 border-red-300" },
};

const PROGRESS_STEPS = [
  { key: "pending", label: "Recibido" },
  { key: "processing", label: "En proceso" },
  { key: "shipped", label: "Enviado" },
  { key: "delivered", label: "Entregado" },
];

const VENEZUELA_STATES = [
  "Amazonas","Anzoátegui","Apure","Aragua","Barinas","Bolívar","Carabobo",
  "Cojedes","Delta Amacuro","Falcón","Guárico","Lara","Mérida","Miranda",
  "Monagas","Nueva Esparta","Portuguesa","Sucre","Táchira","Trujillo",
  "Vargas","Yaracuy","Zulia","Distrito Capital",
];

// ─── Helper components ────────────────────────────────────────────────────────

function Spinner() {
  return <div className="w-8 h-8 border-4 border-orange border-t-transparent rounded-full animate-spin" />;
}

function formatPrice(amount: number, currency: string) {
  const divisor = Number(process.env.NEXT_PUBLIC_PRICE_DIVISOR) || 1;
  const value = amount / divisor;
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(value);
}

function OrderProgress({ status }: { status: string }) {
  if (status === "cancelled" || status === "canceled") {
    return (
      <div className="mt-4 pt-4 border-t border-dark/10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 border-2 border-dark flex-shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-red-600">Pedido cancelado</span>
        </div>
      </div>
    );
  }
  const currentIdx = PROGRESS_STEPS.findIndex((s) => s.key === status);
  const activeIdx = currentIdx === -1 ? 0 : currentIdx;
  return (
    <div className="mt-4 pt-4 border-t border-dark/10">
      <div className="flex items-center">
        {PROGRESS_STEPS.map((step, i) => {
          const isDone = i <= activeIdx;
          const isActive = i === activeIdx;
          return (
            <div key={step.key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-4 h-4 border-2 border-dark flex-shrink-0 ${isDone ? "bg-orange" : "bg-white"} ${isActive ? "shadow-[2px_2px_0px_0px_#1A1A1A]" : ""}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wide mt-1 whitespace-nowrap ${isActive ? "text-orange" : isDone ? "text-dark/70" : "text-dark/30"}`}>
                  {step.label}
                </span>
              </div>
              {i < PROGRESS_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < activeIdx ? "bg-orange" : "bg-dark/15"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab: Club Enrola ─────────────────────────────────────────────────────────

function ClubRYOTab({ token }: { token: string }) {
  const [points, setPoints] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemWarning, setRedeemWarning] = useState(false);
  const router = useRouter();

  const handleCanjear = async () => {
    setRedeemWarning(false);
    try {
      const cartId = typeof window !== "undefined" ? localStorage.getItem("ryo_cart_id") : null;
      if (cartId) {
        const res = await fetch(`/api/cart?cartId=${encodeURIComponent(cartId)}`);
        const data = await res.json();
        if (data?.cart?.items?.length > 0) {
          router.push("/checkout");
          return;
        }
      }
    } catch {
      // si falla la verificación, mostramos la advertencia
    }
    setRedeemWarning(true);
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/cuenta/loyalty", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/cuenta/rewards").then((r) => r.json()),
    ])
      .then(([loyaltyData, rewardsData]) => {
        setPoints(loyaltyData.points ?? 0);
        setTransactions(loyaltyData.transactions ?? []);
        setRewards(rewardsData.rewards ?? []);
      })
      .catch(() => { setPoints(0); })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-8">
      {/* Points balance */}
      <div className="border-[3px] border-dark bg-orange shadow-[8px_8px_0px_0px_#1A1A1A] p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Star size={24} strokeWidth={3} fill="white" />
          <span className="font-black text-sm uppercase tracking-widest">Club Enrola</span>
        </div>
        <p className="font-black text-6xl md:text-7xl leading-none mt-2">
          {(points ?? 0).toLocaleString("es-VE")}
        </p>
        <p className="font-bold text-white/80 text-sm mt-1 uppercase tracking-wider">puntos acumulados</p>
        <p className="text-white/70 text-xs mt-3">
          ✦ Gana 10 puntos por cada $1 de compra · Canjéalos por recompensas exclusivas
        </p>
      </div>

      {/* Rewards catalog */}
      <div>
        <h3 className="font-black text-dark text-lg uppercase tracking-widest mb-4 flex items-center gap-2">
          <Gift size={20} strokeWidth={2.5} />
          Catálogo de Recompensas
        </h3>
        {redeemWarning && (
          <div className="flex items-start gap-2.5 bg-dark text-cream border-2 border-primary p-3 mb-4" style={{ boxShadow: "3px 3px 0px 0px var(--primary)" }}>
            <span className="text-primary font-black text-lg leading-none flex-shrink-0 mt-0.5">!</span>
            <div>
              <p className="text-xs font-black uppercase tracking-wide mb-0.5">Carrito vacío</p>
              <p className="text-xs font-medium text-cream/80 leading-snug">
                Debes tener al menos un producto en tu carrito antes de canjear puntos.{" "}
                <Link href="/tienda" className="text-primary underline">Ir a la tienda →</Link>
              </p>
            </div>
          </div>
        )}
        {rewards.length === 0 ? (
          <div className="border-[3px] border-dark bg-white shadow-[4px_4px_0px_0px_#1A1A1A] p-6 text-center">
            <p className="text-dark/50 text-sm">Próximamente nuevas recompensas. ¡Sigue acumulando!</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {rewards.map((reward) => {
              const canRedeem = (points ?? 0) >= reward.points_required;
              return (
                <div
                  key={reward.id}
                  className={`border-[3px] border-dark bg-white shadow-[4px_4px_0px_0px_#1A1A1A] p-4 flex gap-4 ${!canRedeem ? "opacity-60" : ""}`}
                >
                  {reward.image_url ? (
                    <img src={reward.image_url} alt={reward.name} className="w-16 h-16 object-cover border-2 border-dark flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 bg-cream border-2 border-dark flex items-center justify-center flex-shrink-0">
                      <Gift size={28} className="text-dark/30" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-dark text-sm uppercase tracking-wide">{reward.name}</p>
                    {reward.description && (
                      <p className="text-dark/60 text-xs mt-0.5">{reward.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                      <span className={`inline-flex items-center gap-1 font-black text-sm px-2.5 py-1 border-2 border-dark ${canRedeem ? "bg-orange text-white" : "bg-cream text-dark"}`}>
                        <Star size={12} strokeWidth={3} fill={canRedeem ? "white" : "none"} />
                        {reward.points_required.toLocaleString("es-VE")} pts
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {reward.stock !== null && reward.stock !== undefined && (
                          <span className="text-xs text-dark/40 font-medium">
                            {reward.stock} disponibles
                          </span>
                        )}
                        {canRedeem && (
                          <button
                            type="button"
                            onClick={handleCanjear}
                            className="inline-flex items-center gap-1 bg-dark text-cream px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-2 border-dark shadow-[2px_2px_0px_0px_var(--primary)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                          >
                            <Gift size={10} strokeWidth={3} />
                            Canjear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-dark/50 mt-4 font-medium">
          ✦ Selecciona tus premios directamente en el checkout al confirmar tu próxima compra.
        </p>
      </div>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div>
          <h3 className="font-black text-dark text-lg uppercase tracking-widest mb-4">
            Historial de Puntos
          </h3>
          <div className="border-[3px] border-dark bg-white shadow-[4px_4px_0px_0px_#1A1A1A] divide-y-2 divide-dark/10">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-dark truncate">{t.description ?? (t.type === "earned" ? "Puntos ganados" : "Puntos canjeados")}</p>
                  <p className="text-xs text-dark/40 mt-0.5">
                    {new Date(t.created_at).toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className={`font-black text-base flex-shrink-0 ${(t.points ?? 0) > 0 ? "text-green-600" : "text-red-500"}`}>
                  {(t.points ?? 0) > 0 ? "+" : ""}{t.points ?? 0} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Pedidos ─────────────────────────────────────────────────────────────

function PedidosTab({ token }: { token: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/cuenta/orders", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  if (orders.length === 0) {
    return (
      <div className="border-[3px] border-dark bg-white shadow-[6px_6px_0px_0px_#1A1A1A] p-8 text-center">
        <p className="text-dark/60 text-sm mb-4">Aún no tienes pedidos.</p>
        <Link href="/tienda" className="inline-block bg-orange text-white px-6 py-2.5 font-black text-sm uppercase tracking-widest border-2 border-dark shadow-[4px_4px_0px_0px_#1A1A1A] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all">
          Ir a la Tienda
        </Link>
      </div>
    );
  }

  // Get unique statuses for filter
  const availableStatuses = Array.from(new Set(orders.map((o) => o.status)));
  const filteredOrders = statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);

  return (
    <div className="space-y-4">
      {/* Status filter */}
      {availableStatuses.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-2 transition-all ${
              statusFilter === "all"
                ? "bg-dark text-cream border-dark shadow-[2px_2px_0px_0px_var(--orange)]"
                : "bg-white text-dark/60 border-dark/20 hover:border-dark/50"
            }`}
          >
            Todos ({orders.length})
          </button>
          {availableStatuses.map((s) => {
            const st = STATUS_LABELS[s] ?? { label: s, color: "bg-gray-100 text-gray-800 border-gray-300" };
            const count = orders.filter((o) => o.status === s).length;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-2 transition-all ${
                  statusFilter === s
                    ? "bg-dark text-cream border-dark shadow-[2px_2px_0px_0px_var(--orange)]"
                    : "bg-white text-dark/60 border-dark/20 hover:border-dark/50"
                }`}
              >
                {st.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <div className="border-[3px] border-dark bg-white shadow-[6px_6px_0px_0px_#1A1A1A] p-8 text-center">
          <p className="text-dark/60 text-sm">No hay pedidos con este estado.</p>
        </div>
      ) : filteredOrders.map((order) => {
        const st = STATUS_LABELS[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-800 border-gray-300" };
        return (
          <div key={order.id} className="border-[3px] border-dark bg-white shadow-[6px_6px_0px_0px_#1A1A1A] p-5">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
              <div>
                <p className="font-black text-dark text-base uppercase tracking-wider">Pedido #{order.display_id}</p>
                <p className="text-xs text-dark/50 mt-0.5">
                  {new Date(order.created_at).toLocaleDateString("es-VE", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold uppercase tracking-wider border px-2.5 py-1 ${st.color}`}>{st.label}</span>
                <span className="font-black text-dark text-base">{formatPrice(order.total, order.currency_code)}</span>
              </div>
            </div>
            <OrderProgress status={order.status} />
            {order.items && order.items.length > 0 && (
              <ul className="border-t border-dark/10 pt-3 mt-4 space-y-1">
                {order.items.map((item, i) => (
                  <li key={i} className="flex justify-between text-sm text-dark/70">
                    <span>{item.title} <span className="text-dark/40">×{item.quantity}</span></span>
                    <span>{formatPrice(item.unit_price * item.quantity, order.currency_code)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Mis Datos ───────────────────────────────────────────────────────────

function MisDatosTab({ token }: { token: string }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/cuenta/profile", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const c = d.customer;
        if (c) {
          setFirstName(c.first_name ?? "");
          setLastName(c.last_name ?? "");
          setPhone(c.phone ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);
    const res = await fetch("/api/cuenta/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() }),
    }).catch(() => null);
    if (res?.ok) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError("Error al guardar. Intenta de nuevo.");
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="border-[3px] border-dark bg-white shadow-[6px_6px_0px_0px_#1A1A1A] p-6">
      <p className="text-sm text-dark/60 mb-6">
        Estos datos se utilizarán para pre-rellenar tu próximo checkout automáticamente.
      </p>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-dark mb-1.5">Nombre</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="vintage-input w-full" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-dark mb-1.5">Apellido</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="vintage-input w-full" />
          </div>
        </div>
        <div>
          <WhatsAppPhoneInput value={phone} onChange={setPhone} required={false} showHelper />
        </div>

        {error && <p className="text-red-600 text-sm font-medium bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-orange text-white px-6 py-3 font-black text-sm uppercase tracking-widest border-2 border-dark shadow-[4px_4px_0px_0px_#1A1A1A] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all disabled:opacity-60"
        >
          {success ? <><Check size={16} strokeWidth={3} /> Guardado</> : saving ? "Guardando..." : "Guardar Cambios"}
        </button>
      </form>
    </div>
  );
}

// ─── Tab: Mis Direcciones ─────────────────────────────────────────────────────

function MisDireccionesTab({ token }: { token: string }) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    first_name: "", last_name: "", address_1: "", address_2: "",
    city: "", province: "", country_code: "VE", phone: "",
  });

  const loadAddresses = () => {
    setLoading(true);
    fetch("/api/cuenta/addresses", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setAddresses(d.addresses ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAddresses(); }, [token]); // eslint-disable-line

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    const res = await fetch("/api/cuenta/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ...form,
        country_code: form.country_code.toLowerCase(),
        postal_code: "",
      }),
    }).catch(() => null);
    if (res?.ok) {
      setShowForm(false);
      setForm({ first_name: "", last_name: "", address_1: "", address_2: "", city: "", province: "", country_code: "VE", phone: "" });
      loadAddresses();
    } else {
      const err = await res?.json().catch(() => ({}));
      setFormError(err?.error || "Error al guardar la dirección.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await fetch(`/api/cuenta/addresses/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    setDeletingId(null);
    loadAddresses();
  };

  const setField = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-4">
      {addresses.length === 0 && !showForm && (
        <div className="border-[3px] border-dark bg-white shadow-[4px_4px_0px_0px_#1A1A1A] p-6 text-center">
          <MapPin size={32} className="text-dark/30 mx-auto mb-2" />
          <p className="text-dark/60 text-sm">Aún no tienes direcciones guardadas.</p>
        </div>
      )}

      {addresses.map((addr) => (
        <div key={addr.id} className="border-[3px] border-dark bg-white shadow-[4px_4px_0px_0px_#1A1A1A] p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-black text-dark text-sm uppercase tracking-wide">
              {addr.first_name} {addr.last_name}
            </p>
            <p className="text-sm text-dark/70 mt-0.5">{addr.address_1}{addr.address_2 ? `, ${addr.address_2}` : ""}</p>
            <p className="text-sm text-dark/70">{addr.city}{addr.province ? `, ${addr.province}` : ""}</p>
            {addr.phone && <p className="text-sm text-dark/50 mt-0.5">{addr.phone}</p>}
          </div>
          <button
            onClick={() => handleDelete(addr.id)}
            disabled={deletingId === addr.id}
            className="flex-shrink-0 p-2 text-dark/40 hover:text-red-500 transition-colors disabled:opacity-40"
            title="Eliminar dirección"
          >
            <Trash2 size={16} strokeWidth={2.5} />
          </button>
        </div>
      ))}

      {showForm ? (
        <form onSubmit={handleSaveAddress} className="border-[3px] border-dark bg-white shadow-[6px_6px_0px_0px_#1A1A1A] p-5 space-y-4">
          <h4 className="font-black text-dark text-sm uppercase tracking-widest">Nueva Dirección</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-dark mb-1.5">Nombre *</label>
              <input required type="text" value={form.first_name} onChange={(e) => setField("first_name", e.target.value)} className="vintage-input w-full" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-dark mb-1.5">Apellido</label>
              <input type="text" value={form.last_name} onChange={(e) => setField("last_name", e.target.value)} className="vintage-input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-dark mb-1.5">Dirección *</label>
            <AddressAutocomplete
              value={form.address_1}
              onChange={(v) => setField("address_1", v)}
              onSelect={(components) => {
                setField("address_1", components.address_1);
                if (components.city) setField("city", components.city);
                if (components.province) setField("province", components.province);
                if (components.country_code) setField("country_code", components.country_code.toLowerCase());
              }}
              required
              placeholder="Empieza a escribir tu dirección..."
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-dark/60 mb-1.5">Referencia (opcional)</label>
            <input type="text" value={form.address_2} onChange={(e) => setField("address_2", e.target.value)} placeholder="Punto de referencia" className="vintage-input w-full" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-dark mb-1.5">Ciudad *</label>
              <input required type="text" value={form.city} onChange={(e) => setField("city", e.target.value)} className="vintage-input w-full" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-dark mb-1.5">Estado</label>
              <div className="relative">
                <select value={form.province} onChange={(e) => setField("province", e.target.value)} className="vintage-input w-full appearance-none pr-8">
                  <option value="">Seleccionar...</option>
                  {VENEZUELA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-dark/50" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-dark/60 mb-1.5">Teléfono</label>
            <input type="tel" value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="04XX-XXXXXXX" className="vintage-input w-full" />
          </div>

          {formError && <p className="text-red-600 text-sm font-medium bg-red-50 border border-red-200 px-3 py-2">{formError}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="bg-orange text-white px-6 py-2.5 font-black text-sm uppercase tracking-widest border-2 border-dark shadow-[4px_4px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-60">
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 font-black text-sm uppercase tracking-widest border-2 border-dark hover:bg-cream transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 border-[3px] border-dark bg-white px-5 py-3 font-black text-sm uppercase tracking-widest hover:bg-cream transition-colors shadow-[4px_4px_0px_0px_#1A1A1A] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none"
        >
          <Plus size={16} strokeWidth={3} />
          Agregar Dirección
        </button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CuentaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("club");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center"><Spinner /></main>
        <Footer />
      </div>
    );
  }

  const user = session?.user;
  const token = (session as unknown as Record<string, unknown>)?.medusaToken as string;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "club", label: "Club Enrola", icon: <Star size={16} strokeWidth={2.5} /> },
    { key: "pedidos", label: "Mis Pedidos", icon: <Package size={16} strokeWidth={2.5} /> },
    { key: "referidos", label: "Referidos", icon: <Users size={16} strokeWidth={2.5} /> },
    { key: "datos", label: "Mis Datos", icon: <User size={16} strokeWidth={2.5} /> },
    { key: "direcciones", label: "Mis Direcciones", icon: <MapPin size={16} strokeWidth={2.5} /> },
  ];

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Header />
      <main className="flex-1 max-w-[920px] mx-auto w-full px-4 py-10 md:py-14">

        {/* Profile header */}
        <div className="border-[3px] border-dark bg-secondary shadow-[8px_8px_0px_0px_#1A1A1A] p-5 mb-8 flex items-center justify-between flex-wrap gap-4 overflow-hidden relative">
          {/* Mascota decorativa */}
          <div className="absolute -right-4 -bottom-4 opacity-15 pointer-events-none select-none">
            <Image
              src="/mascota-ryo-blanca.png"
              alt=""
              width={140}
              height={140}
              className="w-32 h-auto"
              aria-hidden="true"
            />
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <Image
              src="/mascota-ryo-blanca.png"
              alt="Club Enrola"
              width={64}
              height={64}
              className="w-14 h-auto flex-shrink-0"
            />
            <div>
              <h1 className="font-black text-2xl uppercase tracking-widest text-cream">Mi Cuenta</h1>
              {user?.name && <p className="text-cream font-semibold mt-0.5">{user.name}</p>}
              <p className="text-cream/60 text-sm mt-0.5">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2 border-2 border-cream/50 text-cream px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-cream hover:text-dark transition-colors relative z-10"
          >
            <LogOut size={16} strokeWidth={2.5} />
            Salir
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-6 border-[3px] border-dark bg-white shadow-[4px_4px_0px_0px_#1A1A1A] overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-wider whitespace-nowrap flex-1 justify-center transition-colors border-r-2 border-dark last:border-r-0 ${
                activeTab === tab.key
                  ? "bg-orange text-white"
                  : "text-dark hover:bg-cream"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "club" && <ClubRYOTab token={token} />}
          {activeTab === "pedidos" && <PedidosTab token={token} />}
          {activeTab === "referidos" && <ReferralSection userEmail={user?.email} userName={user?.name} />}
          {activeTab === "datos" && <MisDatosTab token={token} />}
          {activeTab === "direcciones" && <MisDireccionesTab token={token} />}
        </div>
      </main>
      <Footer />
    </div>
  );
}
