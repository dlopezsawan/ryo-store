import { getSession } from "./auth"

/**
 * Cliente tipado MUY mínimo para la Admin API de Medusa.
 *
 * No usamos @medusajs/js-sdk porque queremos:
 *   1. Cero dependencia client-side (todas las llamadas son server-side)
 *   2. Control total sobre auth → reusamos el bearer guardado en la sesión
 *   3. Tree-shaking agresivo — solo importamos las rutas que necesitamos
 *
 * Cada función helper hace fetch contra `MEDUSA_ADMIN_URL/admin/...`
 * inyectando el bearer de la sesión.
 */

const BASE = process.env.MEDUSA_ADMIN_URL ?? "http://localhost:9000"

// resolveMediaUrl + MEDUSA_PUBLIC_URL viven en `lib/media.ts` (client-safe)
export { resolveMediaUrl, MEDUSA_PUBLIC_URL } from "./media"

export class MedusaError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message)
    this.name = "MedusaError"
  }
}

interface RequestOptions {
  /** Bearer token explícito (login flow). Si se omite usa la sesión. */
  token?: string
  body?: unknown
  next?: NextFetchRequestConfig
  query?: Record<string, string | number | boolean | undefined | null | string[]>
  /** Headers adicionales (ej. x-webmail-token). Merged sobre los defaults. */
  headers?: Record<string, string>
}

/** Fetch base contra Medusa con bearer auth. Server-side only. */
export async function medusaFetch<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  opts: RequestOptions = {}
): Promise<T> {
  let token = opts.token
  if (!token) {
    const session = await getSession()
    if (!session) throw new MedusaError(401, "no_session")
    token = session.medusaToken
  }

  const url = new URL(`/admin${path.startsWith("/") ? path : `/${path}`}`, BASE)
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null || v === "") continue
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, String(item))
      } else {
        url.searchParams.set(k, String(v))
      }
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    next: opts.next ?? { revalidate: 0 },
    cache: "no-store",
  })

  if (!res.ok) {
    let details: unknown
    try { details = await res.json() } catch { /* ignore */ }
    throw new MedusaError(res.status, `medusa ${method} ${path} failed (${res.status})`, details)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ─── Auth ─────────────────────────────────────────────────────────────

export interface MedusaAdminAuthResponse {
  token: string
}

export async function medusaLogin(email: string, password: string): Promise<MedusaAdminAuthResponse> {
  const url = new URL("/auth/user/emailpass", BASE)
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  })
  if (!res.ok) {
    let details: unknown
    try { details = await res.json() } catch { /* ignore */ }
    throw new MedusaError(res.status, "login_failed", details)
  }
  return res.json()
}

export async function medusaMe(token?: string) {
  return medusaFetch<{ user: { id: string; email: string; first_name?: string | null; last_name?: string | null } }>(
    "GET",
    "/users/me",
    { token }
  )
}

// ─── Domain types — Orders ────────────────────────────────────────────

export interface AdminOrderListItem {
  id: string
  display_id: number
  email: string | null
  currency_code: string
  status: string
  payment_status?: string | null
  fulfillment_status?: string | null
  total: number
  subtotal: number
  discount_total?: number | null
  shipping_total?: number | null
  created_at: string
  updated_at?: string
  metadata?: Record<string, unknown> | null
  customer?: {
    id: string
    email: string
    first_name?: string | null
    last_name?: string | null
  } | null
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
    city?: string | null
    province?: string | null
    address_1?: string | null
    postal_code?: string | null
    country_code?: string | null
    phone?: string | null
  } | null
  items?: Array<{
    id: string
    title: string
    quantity: number
    unit_price: number
    subtotal?: number
    thumbnail?: string | null
    product_id?: string | null
    variant?: {
      id: string
      title?: string
      sku?: string | null
      product?: { id: string; title: string }
    } | null
  }> | null
}

export interface MedusaOrderListResponse {
  orders: AdminOrderListItem[]
  count: number
  offset: number
  limit: number
}

export interface AdminOrderDetail extends AdminOrderListItem {
  items: Array<{
    id: string
    title: string
    subtitle?: string | null
    thumbnail?: string | null
    variant_id?: string | null
    product_id?: string | null
    quantity: number
    unit_price: number
    subtotal?: number
    total?: number
    discount_total?: number
    adjustments?: Array<{
      id: string
      code?: string | null
      amount: number
      description?: string | null
    }> | null
    variant?: {
      id: string
      title: string
      sku?: string | null
      product?: { id: string; title: string; handle?: string | null }
    }
  }>
  payment_collections?: Array<{
    id: string
    amount: number
    status: string
    payments?: Array<{ id: string; amount: number; provider_id: string; created_at: string }>
  }>
  fulfillments?: Array<{
    id: string
    created_at: string
    shipped_at?: string | null
    delivered_at?: string | null
    canceled_at?: string | null
    location_id?: string | null
    provider_id?: string | null
    items?: Array<{
      id: string
      title?: string
      quantity: number
      line_item_id?: string | null
    }>
    labels?: Array<{
      id: string
      tracking_number: string
      tracking_url?: string | null
      label_url?: string | null
    }>
  }>
}

/**
 * GET /admin/orders
 * Soporta query params estándar de Medusa v2.
 * Por defecto trae los 50 más recientes.
 */
export async function listOrders(args?: {
  offset?: number
  limit?: number
  q?: string
  status?: string[]
  payment_status?: string[]
  fulfillment_status?: string[]
  created_at_gte?: string
  created_at_lte?: string
  order?: string
  fields?: string
}): Promise<MedusaOrderListResponse> {
  return medusaFetch<MedusaOrderListResponse>("GET", "/orders", {
    query: {
      offset: args?.offset ?? 0,
      limit: args?.limit ?? 50,
      q: args?.q,
      status: args?.status,
      payment_status: args?.payment_status,
      fulfillment_status: args?.fulfillment_status,
      "created_at[gte]": args?.created_at_gte,
      "created_at[lte]": args?.created_at_lte,
      order: args?.order ?? "-created_at",
      fields: args?.fields ?? "id,display_id,email,status,payment_status,fulfillment_status,total,subtotal,discount_total,currency_code,created_at,metadata,*customer,*shipping_address,*items,*items.variant,*items.variant.product",
    },
  })
}

/** GET /admin/orders/:id */
export async function retrieveOrder(id: string): Promise<{ order: AdminOrderDetail }> {
  return medusaFetch<{ order: AdminOrderDetail }>("GET", `/orders/${id}`, {
    query: {
      fields: "*items,*items.adjustments,*items.variant,*items.variant.product,*customer,*shipping_address,*billing_address,*payment_collections,*payment_collections.payments,*fulfillments,*fulfillments.items,*fulfillments.labels",
    },
  })
}

// ─── Order mutations (acciones operativas del día a día) ──────────────

/** POST /admin/orders/:id/fulfillments — crea un fulfillment con todos los items pendientes. */
export async function createFulfillment(orderId: string, items: Array<{ id: string; quantity: number }>) {
  return medusaFetch<{ order: AdminOrderDetail }>("POST", `/orders/${orderId}/fulfillments`, {
    body: { items },
  })
}

/** POST /admin/orders/:id/cancel — cancela la orden completa. */
export async function cancelOrder(orderId: string) {
  return medusaFetch<{ order: AdminOrderDetail }>("POST", `/orders/${orderId}/cancel`)
}

interface AddressInput {
  first_name?: string
  last_name?: string
  address_1?: string
  address_2?: string
  city?: string
  province?: string
  postal_code?: string
  country_code?: string
  phone?: string
}

/** POST /admin/orders/:id — update genérico (email, addresses, metadata) */
export async function updateOrder(orderId: string, body: {
  email?: string
  metadata?: Record<string, unknown>
  shipping_address?: AddressInput
  billing_address?: AddressInput
}) {
  return medusaFetch<{ order: AdminOrderDetail }>("POST", `/orders/${orderId}`, { body })
}

// ─── Order line items: add / update / delete ─────────────────────────
//
// Medusa v2: edits a una orden ya colocada se hacen via "Order Edit"
// flow que crea un draft, modifica items, y commit. Endpoints:
//   POST /admin/orders/:id/edits          → crea order edit draft
//   POST /admin/orders/:id/edits/items    → añade item
//   POST /admin/orders/:id/edits/items/:lineId    → update qty/price
//   DELETE /admin/orders/:id/edits/items/:lineId  → quitar
//   POST /admin/orders/:id/edits/request          → pide confirmación al cliente
//   POST /admin/orders/:id/edits/confirm          → confirma sin cliente (admin)
//
// Para flujos simples sin pasar por el order-edit dance, usamos
// los endpoints directos a line-items que sólo aplican a draft orders
// abiertos (status=draft o requires_action). Si la orden ya está
// completed, hay que usar order edits.
//

export async function addOrderLineItem(orderId: string, body: {
  variant_id?: string
  title: string
  quantity: number
  unit_price: number
  metadata?: Record<string, unknown>
}) {
  return medusaFetch<{ order: AdminOrderDetail }>(
    "POST",
    `/orders/${orderId}/line-items`,
    { body },
  )
}

export async function updateOrderLineItem(orderId: string, lineItemId: string, body: {
  quantity?: number
  unit_price?: number
  title?: string
}) {
  return medusaFetch<{ order: AdminOrderDetail }>(
    "POST",
    `/orders/${orderId}/line-items/${lineItemId}`,
    { body },
  )
}

export async function deleteOrderLineItem(orderId: string, lineItemId: string) {
  return medusaFetch<{ id: string; deleted: boolean }>(
    "DELETE",
    `/orders/${orderId}/line-items/${lineItemId}`,
  )
}

/** POST /admin/payment-collections/:id/mark-as-paid — marca pago como capturado.
 *  Útil para el flujo Pago Móvil que se confirma manualmente fuera del gateway. */
export async function markPaymentPaid(paymentCollectionId: string, orderId: string) {
  return medusaFetch<{ payment_collection: { id: string; status: string } }>(
    "POST",
    `/payment-collections/${paymentCollectionId}/mark-as-paid`,
    { body: { order_id: orderId } }
  )
}

/** POST /admin/orders/:id/refunds — refunde un monto. */
export async function refundPayment(args: { orderId: string; paymentId: string; amount: number; note?: string; reason?: string }) {
  return medusaFetch<{ order: AdminOrderDetail }>("POST", `/orders/${args.orderId}/refunds`, {
    body: {
      payment_id: args.paymentId,
      amount: args.amount,
      note: args.note,
      refund_reason_id: args.reason,
    },
  })
}

// ─── Customer detail + customer's orders ──────────────────────────────

export interface AdminCustomerDetail extends AdminCustomer {
  addresses?: Array<{
    id: string
    first_name?: string | null
    last_name?: string | null
    address_1?: string | null
    address_2?: string | null
    city?: string | null
    province?: string | null
    postal_code?: string | null
    country_code?: string | null
    phone?: string | null
    company?: string | null
    is_default_shipping?: boolean
    is_default_billing?: boolean
  }>
  groups?: Array<{ id: string; name: string }>
}

export async function retrieveCustomer(id: string) {
  return medusaFetch<{ customer: AdminCustomerDetail }>("GET", `/customers/${id}`, {
    query: { fields: "id,email,first_name,last_name,phone,has_account,created_at,metadata,*addresses,*groups" },
  })
}

/** Pedidos del cliente — usa el filter `customer_id` del listOrders normal. */
export async function listOrdersByCustomer(customerId: string, limit = 50) {
  return medusaFetch<MedusaOrderListResponse>("GET", "/orders", {
    query: {
      customer_id: customerId,
      limit,
      order: "-created_at",
      fields: "id,display_id,email,status,payment_status,fulfillment_status,total,currency_code,created_at,*items",
    },
  })
}

// ─── Product detail ──────────────────────────────────────────────────

export interface AdminProductDetail extends AdminProduct {
  options?: Array<{ id: string; title: string; values?: Array<{ id: string; value: string }> }>
  images?: Array<{ id: string; url: string; rank?: number }>
  sales_channels?: Array<{ id: string; name: string }>
}

export async function retrieveProduct(id: string) {
  return medusaFetch<{ product: AdminProductDetail }>("GET", `/products/${id}`, {
    query: { fields: "*variants,*variants.prices,*options,*options.values,*images,*categories,*collection,*sales_channels" },
  })
}

/**
 * Crea un producto desde cero. Medusa v2 requiere al menos `title`.
 * Si `options` está vacío, Medusa crea un option "Default option" con
 * value "Default" para que la primera variant tenga sentido.
 */
export async function createProduct(body: {
  title: string
  handle?: string
  description?: string
  status?: "draft" | "published" | "proposed" | "rejected"
  thumbnail?: string | null
  collection_id?: string | null
  category_ids?: string[]
  options?: Array<{ title: string; values: string[] }>
  variants?: Array<{
    title: string
    sku?: string
    manage_inventory?: boolean
    options?: Record<string, string>
    prices?: Array<{ amount: number; currency_code: string }>
  }>
  sales_channels?: Array<{ id: string }>
}) {
  return medusaFetch<{ product: AdminProductDetail }>("POST", "/products", { body })
}

export async function deleteProduct(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/products/${id}`)
}

// ─── Mutations — Catalog ────────────────────────────────────────────

export async function updateProduct(id: string, body: {
  title?: string
  handle?: string
  description?: string | null
  status?: "draft" | "published" | "proposed" | "rejected"
  thumbnail?: string | null
  collection_id?: string | null
  categories?: Array<{ id: string }>
  sales_channels?: Array<{ id: string }>
  /** Reemplaza el array completo de imágenes del producto. */
  images?: Array<{ url: string }>
}) {
  return medusaFetch<{ product: AdminProductDetail }>("POST", `/products/${id}`, { body })
}

export async function updateVariant(productId: string, variantId: string, body: {
  title?: string
  sku?: string | null
  manage_inventory?: boolean
  prices?: Array<{ id?: string; amount: number; currency_code: string }>
  options?: Record<string, string>
}) {
  return medusaFetch<{ product: AdminProductDetail }>(
    "POST",
    `/products/${productId}/variants/${variantId}`,
    { body },
  )
}

export async function createVariant(productId: string, body: {
  title: string
  sku?: string
  manage_inventory?: boolean
  prices?: Array<{ amount: number; currency_code: string }>
  options?: Record<string, string>
}) {
  return medusaFetch<{ product: AdminProductDetail }>(
    "POST",
    `/products/${productId}/variants`,
    { body },
  )
}

export async function deleteVariant(productId: string, variantId: string) {
  return medusaFetch<{ id: string; deleted: boolean }>(
    "DELETE",
    `/products/${productId}/variants/${variantId}`,
  )
}

// ─── File uploads ────────────────────────────────────────────────────
//
// Medusa v2 expone POST /admin/uploads con multipart/form-data. El body
// es FormData con campo `files` (array). Devuelve { files: [{ id, url }] }.
//
// Lo wrappeamos en una función que recibe File objects desde el browser
// (a través de un server action que ya tenga el Buffer) o un Buffer crudo.
//

export interface AdminUploadedFile {
  id: string
  url: string
}

/**
 * Sube uno o más archivos al store de Medusa. El body debe ser un FormData
 * que ya tenga los archivos en el campo `files` (puede tener varios).
 *
 * NO usamos medusaFetch porque éste setea Content-Type:application/json,
 * y para multipart hay que dejarlo que el browser/runtime lo construya
 * con el boundary correcto.
 */
export async function uploadFiles(formData: FormData): Promise<{ files: AdminUploadedFile[] }> {
  const session = await getSession()
  if (!session) throw new MedusaError(401, "no_session")

  const url = new URL("/admin/uploads", BASE)
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.medusaToken}` },
    body: formData,
    cache: "no-store",
  })

  if (!res.ok) {
    let details: unknown
    try { details = await res.json() } catch { /* ignore */ }
    throw new MedusaError(res.status, `upload failed (${res.status})`, details)
  }
  return res.json()
}

export async function deleteUpload(fileId: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/uploads/${fileId}`)
}

// ─── Categories ─────────────────────────────────────────────────────

export interface AdminCategory {
  id: string
  name: string
  handle: string
  description?: string | null
  is_active: boolean
  is_internal: boolean
  parent_category_id?: string | null
  rank?: number
  created_at: string
  category_children?: AdminCategory[]
}

export async function listCategories(args?: { q?: string; limit?: number; offset?: number }) {
  return medusaFetch<{ product_categories: AdminCategory[]; count: number }>(
    "GET",
    "/product-categories",
    {
      query: {
        q: args?.q,
        limit: args?.limit ?? 100,
        offset: args?.offset ?? 0,
        fields: "id,name,handle,description,is_active,is_internal,parent_category_id,rank,created_at",
      },
    },
  )
}

export async function createCategory(body: {
  name: string
  handle?: string
  description?: string
  is_active?: boolean
  is_internal?: boolean
  parent_category_id?: string | null
}) {
  return medusaFetch<{ product_category: AdminCategory }>("POST", "/product-categories", { body })
}

export async function updateCategory(id: string, body: Partial<{
  name: string
  handle: string
  description: string | null
  is_active: boolean
  is_internal: boolean
  parent_category_id: string | null
}>) {
  return medusaFetch<{ product_category: AdminCategory }>("POST", `/product-categories/${id}`, { body })
}

export async function deleteCategory(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/product-categories/${id}`)
}

// ─── Collections ────────────────────────────────────────────────────

export interface AdminCollection {
  id: string
  title: string
  handle: string
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at?: string
}

export async function listCollections(args?: { q?: string; limit?: number; offset?: number }) {
  return medusaFetch<{ collections: AdminCollection[]; count: number }>("GET", "/collections", {
    query: {
      q: args?.q,
      limit: args?.limit ?? 100,
      offset: args?.offset ?? 0,
      fields: "id,title,handle,metadata,created_at,updated_at",
    },
  })
}

export async function createCollection(body: { title: string; handle?: string }) {
  return medusaFetch<{ collection: AdminCollection }>("POST", "/collections", { body })
}

export async function updateCollection(id: string, body: Partial<{ title: string; handle: string }>) {
  return medusaFetch<{ collection: AdminCollection }>("POST", `/collections/${id}`, { body })
}

export async function deleteCollection(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/collections/${id}`)
}

// ─── Domain types — Inventory + Stock Locations ──────────────────────
//
// Medusa v2 separa "inventory items" (qué se trackea) de "location levels"
// (cuánto hay en cada warehouse). Cada variante de producto está vinculada
// a un inventory_item; cada inventory_item puede tener stock en N stock
// locations.
//
// Endpoints:
//   GET  /admin/inventory-items                       → listado
//   GET  /admin/inventory-items/:id                   → detalle con location_levels
//   POST /admin/inventory-items/:id/location-levels/:loc → ajustar stock
//   GET  /admin/stock-locations                       → listado
//

export interface AdminStockLocation {
  id: string
  name: string
  address?: {
    address_1?: string | null
    city?: string | null
    country_code?: string | null
  } | null
  metadata?: Record<string, unknown> | null
  created_at: string
}

export interface AdminInventoryLocationLevel {
  id: string
  location_id: string
  stocked_quantity: number
  reserved_quantity: number
  incoming_quantity: number
  /** stocked - reserved */
  available_quantity?: number
}

export interface AdminInventoryItem {
  id: string
  sku?: string | null
  title?: string | null
  description?: string | null
  thumbnail?: string | null
  origin_country?: string | null
  hs_code?: string | null
  mid_code?: string | null
  weight?: number | null
  length?: number | null
  height?: number | null
  width?: number | null
  requires_shipping?: boolean
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at?: string
  location_levels?: AdminInventoryLocationLevel[]
  /** Calculado por Medusa: suma de stocked - reserved en todas las locations */
  stocked_quantity?: number
  reserved_quantity?: number
  variants?: Array<{
    id: string
    title?: string
    sku?: string | null
    product?: { id: string; title: string; thumbnail?: string | null } | null
  }>
}

export interface MedusaInventoryListResponse {
  inventory_items: AdminInventoryItem[]
  count: number
  offset: number
  limit: number
}

export async function listInventoryItems(args?: {
  offset?: number
  limit?: number
  q?: string
  location_id?: string
}): Promise<MedusaInventoryListResponse> {
  return medusaFetch<MedusaInventoryListResponse>("GET", "/inventory-items", {
    query: {
      offset: args?.offset ?? 0,
      limit: args?.limit ?? 50,
      q: args?.q,
      // Medusa v2 acepta el filtro plano `location_id` para limitar a items
      // que tengan al menos un level en esa location
      location_id: args?.location_id,
      fields: "id,sku,title,thumbnail,description,requires_shipping,created_at,updated_at,*location_levels,*variants,*variants.product",
    },
  })
}

export async function retrieveInventoryItem(id: string) {
  return medusaFetch<{ inventory_item: AdminInventoryItem }>("GET", `/inventory-items/${id}`, {
    query: { fields: "*location_levels,*variants,*variants.product" },
  })
}

/**
 * Ajusta el stock de un inventory item en una location dada.
 * Si la combinación no tiene level aún, lo creamos con POST.
 */
export async function setInventoryLevel(args: {
  inventoryItemId: string
  locationId: string
  stockedQuantity: number
  /** Si es la primera vez en esa location → POST, sino → POST update */
  exists: boolean
}) {
  const { inventoryItemId, locationId, stockedQuantity, exists } = args
  if (exists) {
    return medusaFetch<{ inventory_item: AdminInventoryItem }>(
      "POST",
      `/inventory-items/${inventoryItemId}/location-levels/${locationId}`,
      { body: { stocked_quantity: stockedQuantity } },
    )
  }
  return medusaFetch<{ inventory_item: AdminInventoryItem }>(
    "POST",
    `/inventory-items/${inventoryItemId}/location-levels`,
    { body: { location_id: locationId, stocked_quantity: stockedQuantity } },
  )
}

export async function createInventoryItem(body: {
  sku?: string
  title?: string
  description?: string
  requires_shipping?: boolean
  hs_code?: string
  origin_country?: string
  weight?: number
}) {
  return medusaFetch<{ inventory_item: AdminInventoryItem }>("POST", "/inventory-items", { body })
}

export async function deleteInventoryItem(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/inventory-items/${id}`)
}

export async function listStockLocations(): Promise<{ stock_locations: AdminStockLocation[]; count: number }> {
  return medusaFetch<{ stock_locations: AdminStockLocation[]; count: number }>("GET", "/stock-locations", {
    query: { fields: "id,name,*address,metadata,created_at", limit: 100 },
  })
}

export async function retrieveStockLocation(id: string) {
  return medusaFetch<{ stock_location: AdminStockLocation }>("GET", `/stock-locations/${id}`, {
    query: { fields: "id,name,*address,metadata,created_at" },
  })
}

export async function createStockLocation(body: {
  name: string
  address?: {
    address_1?: string
    address_2?: string
    city?: string
    postal_code?: string
    province?: string
    country_code: string
    phone?: string
  }
}) {
  return medusaFetch<{ stock_location: AdminStockLocation }>("POST", "/stock-locations", { body })
}

export async function updateStockLocation(id: string, body: {
  name?: string
  address?: {
    address_1?: string
    address_2?: string
    city?: string
    postal_code?: string
    province?: string
    country_code?: string
    phone?: string
  }
}) {
  return medusaFetch<{ stock_location: AdminStockLocation }>("POST", `/stock-locations/${id}`, { body })
}

export async function deleteStockLocation(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/stock-locations/${id}`)
}

// ─── Shipping (read-only) ────────────────────────────────────────────
//
// Medusa v2: shipping_profiles agrupan opciones; service_zones definen
// dónde aplica cada profile; shipping_options son los métodos concretos
// (Inmediato Valencia, MRW, Pickup, etc.) con sus precios.
//

export interface AdminShippingProfile {
  id: string
  name: string
  type: string
  metadata?: Record<string, unknown> | null
  created_at: string
}

export interface AdminShippingOption {
  id: string
  name: string
  price_type: "flat" | "calculated"
  amount?: number | null
  service_zone_id?: string
  shipping_profile_id?: string
  provider_id?: string
  data?: Record<string, unknown>
  type?: { id: string; label: string; description?: string; code?: string }
  rules?: Array<{ attribute: string; value: string | string[]; operator: string }>
}

export async function listShippingProfiles() {
  return medusaFetch<{ shipping_profiles: AdminShippingProfile[]; count: number }>(
    "GET",
    "/shipping-profiles",
    { query: { limit: 100 } },
  )
}

export async function listShippingOptions() {
  return medusaFetch<{ shipping_options: AdminShippingOption[]; count: number }>(
    "GET",
    "/shipping-options",
    {
      query: {
        limit: 100,
        fields: "id,name,price_type,amount,service_zone_id,shipping_profile_id,provider_id,*type,*rules",
      },
    },
  )
}

// ─── Service zones (sub-recurso de stock-locations) ─────────────────

export interface AdminServiceZone {
  id: string
  name: string
  fulfillment_set_id?: string
  geo_zones?: Array<{ id: string; type: string; country_code?: string; province_code?: string }>
  shipping_options?: AdminShippingOption[]
  created_at: string
}

export async function listServiceZones(stockLocationId: string) {
  // Medusa v2 — service_zones cuelgan de stock-locations vía fulfillment-sets
  return medusaFetch<{ stock_location: { fulfillment_sets?: Array<{ id: string; service_zones: AdminServiceZone[] }> } }>(
    "GET",
    `/stock-locations/${stockLocationId}`,
    { query: { fields: "id,*fulfillment_sets,*fulfillment_sets.service_zones,*fulfillment_sets.service_zones.geo_zones" } },
  )
}

// ─── Shipping options CRUD ──────────────────────────────────────────

export interface CreateShippingOptionInput {
  name: string
  service_zone_id: string
  shipping_profile_id: string
  provider_id: string
  price_type: "flat" | "calculated"
  type: { label: string; description?: string; code: string }
  prices?: Array<{ currency_code: string; amount: number }>
  rules?: Array<{ attribute: string; operator: string; value: string }>
  data?: Record<string, unknown>
}

export async function createShippingOption(body: CreateShippingOptionInput) {
  return medusaFetch<{ shipping_option: AdminShippingOption }>(
    "POST",
    "/shipping-options",
    { body },
  )
}

export async function updateShippingOption(id: string, body: Partial<{
  name: string
  price_type: "flat" | "calculated"
  prices: Array<{ id?: string; currency_code: string; amount: number }>
  rules: Array<{ attribute: string; operator: string; value: string }>
}>) {
  return medusaFetch<{ shipping_option: AdminShippingOption }>(
    "POST",
    `/shipping-options/${id}`,
    { body },
  )
}

export async function deleteShippingOption(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/shipping-options/${id}`)
}

// ─── Inventory transfer (movimiento entre locations) ────────────────
//
// Medusa v2 NO tiene endpoint nativo "transfer". Se implementa como
// dos location-level updates atómicos:
//   1. Restar X del location origen (stocked_quantity − X)
//   2. Sumar X al location destino (stocked_quantity + X)
// Si el origen no tiene suficiente stock, abortamos antes del paso 1.
//

export async function transferInventory(args: {
  inventoryItemId: string
  fromLocationId: string
  toLocationId: string
  quantity: number
}): Promise<{ from: number; to: number }> {
  if (args.quantity <= 0) throw new Error("quantity debe ser > 0")
  if (args.fromLocationId === args.toLocationId) throw new Error("origen y destino deben ser distintos")

  // Lee el item para obtener los levels actuales
  const { inventory_item } = await retrieveInventoryItem(args.inventoryItemId)
  const fromLevel = (inventory_item.location_levels ?? []).find((l) => l.location_id === args.fromLocationId)
  const toLevel = (inventory_item.location_levels ?? []).find((l) => l.location_id === args.toLocationId)

  const fromStocked = fromLevel?.stocked_quantity ?? 0
  const toStocked = toLevel?.stocked_quantity ?? 0
  if (fromStocked < args.quantity) {
    throw new Error(`Stock insuficiente en origen (tiene ${fromStocked}, pides ${args.quantity})`)
  }

  // Restar del origen
  await setInventoryLevel({
    inventoryItemId: args.inventoryItemId,
    locationId: args.fromLocationId,
    stockedQuantity: fromStocked - args.quantity,
    exists: true,
  })
  // Sumar al destino (crear level si no existía)
  await setInventoryLevel({
    inventoryItemId: args.inventoryItemId,
    locationId: args.toLocationId,
    stockedQuantity: toStocked + args.quantity,
    exists: !!toLevel,
  })
  return { from: fromStocked - args.quantity, to: toStocked + args.quantity }
}

// ─── Returns + Tracking ──────────────────────────────────────────────
//
// El flow para crear un retorno en Medusa v2 es:
//   1. POST /admin/returns                         → inicia un return
//   2. POST /admin/returns/:id/request-items       → añade items
//   3. POST /admin/returns/:id/request             → confirma
// Aquí lo simplificamos a un solo endpoint legacy-friendly:
//   POST /admin/orders/:id/returns con { items, refund_amount?, note? }
// que Medusa v2 acepta para crear return + reembolso en un paso si hay
// shipping option de retorno configurada.
//

export interface CreateReturnInput {
  orderId: string
  items: Array<{ id: string; quantity: number; reason_id?: string; note?: string }>
  refund?: { amount: number; note?: string } | null
  no_notification?: boolean
}

export async function createReturn(args: CreateReturnInput) {
  return medusaFetch<{ order: AdminOrderDetail }>("POST", `/orders/${args.orderId}/returns`, {
    body: {
      items: args.items,
      refund: args.refund ?? undefined,
      no_notification: args.no_notification,
    },
  })
}

/**
 * Añade tracking number(s) a un fulfillment existente.
 * En Medusa v2 esto se hace marcándolo como shipped con `labels`.
 */
export async function shipFulfillment(args: {
  orderId: string
  fulfillmentId: string
  labels: Array<{ tracking_number: string; tracking_url?: string; label_url?: string }>
  no_notification?: boolean
}) {
  return medusaFetch<{ order: AdminOrderDetail }>(
    "POST",
    `/orders/${args.orderId}/fulfillments/${args.fulfillmentId}/shipment`,
    {
      body: {
        labels: args.labels,
        no_notification: args.no_notification,
      },
    },
  )
}

/**
 * Marca un fulfillment como entregado al cliente.
 * Medusa v2 expone POST /admin/orders/:id/fulfillments/:fulfillment_id/mark-as-delivered
 */
export async function markFulfillmentDelivered(args: {
  orderId: string
  fulfillmentId: string
}) {
  return medusaFetch<{ order: AdminOrderDetail }>(
    "POST",
    `/orders/${args.orderId}/fulfillments/${args.fulfillmentId}/mark-as-delivered`,
  )
}

/**
 * Cierra/completa una orden.
 * Medusa v2: POST /admin/orders/:id/complete
 * Marca status="completed" — solo se permite si todos los fulfillments están delivered o canceled.
 */
export async function completeOrder(orderId: string) {
  return medusaFetch<{ order: AdminOrderDetail }>("POST", `/orders/${orderId}/complete`)
}

// ─── Returns: list + receive ─────────────────────────────────────────

export interface AdminReturn {
  id: string
  order_id: string
  status: string
  refund_amount?: number
  received_at?: string | null
  created_at: string
  items?: Array<{
    id: string
    item_id: string
    quantity: number
    received_quantity?: number
    note?: string | null
    reason_id?: string | null
  }>
}

export async function listReturns(args?: { order_id?: string; limit?: number }) {
  return medusaFetch<{ returns: AdminReturn[]; count: number }>("GET", "/returns", {
    query: {
      order_id: args?.order_id,
      limit: args?.limit ?? 50,
      fields: "id,order_id,status,refund_amount,received_at,created_at,*items",
    },
  })
}

/**
 * Marca un return como recibido. Medusa v2 acepta:
 *   POST /admin/returns/:id/receive con { items: [{id, quantity}] }
 * para confirmar qué se recibió y disparar el reembolso si corresponde.
 */
export async function receiveReturn(args: {
  returnId: string
  items: Array<{ id: string; quantity: number }>
}) {
  return medusaFetch<{ return: AdminReturn }>(
    "POST",
    `/returns/${args.returnId}/receive`,
    { body: { items: args.items } },
  )
}

export async function cancelReturn(returnId: string) {
  return medusaFetch<{ return: AdminReturn }>("POST", `/returns/${returnId}/cancel`)
}

// ─── Exchanges (cliente devuelve item X y recibe Y) ──────────────────

export interface CreateExchangeInput {
  orderId: string
  /** Items que el cliente devuelve */
  return_items: Array<{ id: string; quantity: number; reason_id?: string; note?: string }>
  /** Items que recibe en su lugar (línea nueva con variant + qty + price) */
  additional_items: Array<{ variant_id: string; quantity: number; unit_price?: number }>
  difference_due?: number
  no_notification?: boolean
}

export async function createExchange(args: CreateExchangeInput) {
  return medusaFetch<{ order: AdminOrderDetail }>(
    "POST",
    `/orders/${args.orderId}/exchanges`,
    {
      body: {
        return_items: args.return_items,
        additional_items: args.additional_items,
        difference_due: args.difference_due,
        no_notification: args.no_notification,
      },
    },
  )
}

// ─── Claims (item dañado/incorrecto — refund o replace) ──────────────

export type ClaimType = "refund" | "replace"

export interface CreateClaimInput {
  orderId: string
  type: ClaimType
  claim_items: Array<{ id: string; quantity: number; reason: "missing_item" | "wrong_item" | "production_failure" | "other"; note?: string }>
  /** Sólo si type=replace: items de reemplazo */
  additional_items?: Array<{ variant_id: string; quantity: number }>
  /** Sólo si type=refund */
  refund_amount?: number
  no_notification?: boolean
}

export async function createClaim(args: CreateClaimInput) {
  return medusaFetch<{ order: AdminOrderDetail }>(
    "POST",
    `/orders/${args.orderId}/claims`,
    {
      body: {
        type: args.type,
        claim_items: args.claim_items,
        additional_items: args.additional_items,
        refund_amount: args.refund_amount,
        no_notification: args.no_notification,
      },
    },
  )
}

// ─── Tax Regions + Tax Rates ─────────────────────────────────────────

export interface AdminTaxRegion {
  id: string
  country_code: string
  province_code?: string | null
  parent_id?: string | null
  default_tax_rate?: {
    id?: string
    name?: string
    rate?: number
    code?: string
  }
  metadata?: Record<string, unknown> | null
  created_at: string
}

export interface AdminTaxRate {
  id: string
  tax_region_id: string
  rate: number
  code?: string
  name?: string
  is_combinable?: boolean
  metadata?: Record<string, unknown> | null
  created_at: string
}

export async function listTaxRegions() {
  return medusaFetch<{ tax_regions: AdminTaxRegion[]; count: number }>("GET", "/tax-regions", {
    query: { limit: 100, fields: "id,country_code,province_code,parent_id,*default_tax_rate,metadata,created_at" },
  })
}

export async function createTaxRegion(body: {
  country_code: string
  province_code?: string
  parent_id?: string
  default_tax_rate?: { name: string; rate: number; code?: string }
}) {
  return medusaFetch<{ tax_region: AdminTaxRegion }>("POST", "/tax-regions", { body })
}

export async function deleteTaxRegion(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/tax-regions/${id}`)
}

export async function listTaxRates(taxRegionId: string) {
  return medusaFetch<{ tax_rates: AdminTaxRate[]; count: number }>("GET", "/tax-rates", {
    query: {
      tax_region_id: taxRegionId,
      limit: 100,
      fields: "id,tax_region_id,rate,code,name,is_combinable,created_at",
    },
  })
}

export async function createTaxRate(body: {
  tax_region_id: string
  rate: number
  name: string
  code?: string
  is_combinable?: boolean
}) {
  return medusaFetch<{ tax_rate: AdminTaxRate }>("POST", "/tax-rates", { body })
}

export async function updateTaxRate(id: string, body: Partial<{
  rate: number
  name: string
  code: string
  is_combinable: boolean
}>) {
  return medusaFetch<{ tax_rate: AdminTaxRate }>("POST", `/tax-rates/${id}`, { body })
}

export async function deleteTaxRate(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/tax-rates/${id}`)
}

// ─── Payment Providers ───────────────────────────────────────────────
//
// Medusa v2 exposes payment providers via /admin/payment-providers (read).
// Para asignar a una región: PATCH /admin/regions/:id con { payment_providers }.
//

export interface AdminPaymentProvider {
  id: string
  is_enabled?: boolean
}

export async function listPaymentProviders() {
  return medusaFetch<{ payment_providers: AdminPaymentProvider[]; count: number }>(
    "GET",
    "/payment-providers",
    { query: { limit: 100 } },
  )
}

// ─── Domain types — Products ──────────────────────────────────────────

export interface AdminProduct {
  id: string
  title: string
  handle?: string | null
  status: "draft" | "proposed" | "published" | "rejected"
  thumbnail?: string | null
  description?: string | null
  created_at: string
  updated_at?: string
  variants?: Array<{
    id: string
    title: string
    sku?: string | null
    inventory_quantity?: number | null
    prices?: Array<{ amount: number; currency_code: string }>
  }>
  categories?: Array<{ id: string; name: string }>
  collection?: { id: string; title: string } | null
}

export interface MedusaProductListResponse {
  products: AdminProduct[]
  count: number
  offset: number
  limit: number
}

export async function listProducts(args?: {
  offset?: number
  limit?: number
  q?: string
  status?: string[]
  category_id?: string[]
  order?: string
}): Promise<MedusaProductListResponse> {
  return medusaFetch<MedusaProductListResponse>("GET", "/products", {
    query: {
      offset: args?.offset ?? 0,
      limit: args?.limit ?? 50,
      q: args?.q,
      status: args?.status,
      category_id: args?.category_id,
      order: args?.order ?? "-created_at",
      fields: "id,title,handle,status,thumbnail,created_at,*variants,*variants.prices,*categories",
    },
  })
}

// ─── Domain types — Customers ─────────────────────────────────────────

export interface AdminCustomer {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  has_account: boolean
  created_at: string
  metadata?: Record<string, unknown> | null
}

export interface MedusaCustomerListResponse {
  customers: AdminCustomer[]
  count: number
  offset: number
  limit: number
}

export async function listCustomers(args?: {
  offset?: number
  limit?: number
  q?: string
  has_account?: boolean
  order?: string
}): Promise<MedusaCustomerListResponse> {
  return medusaFetch<MedusaCustomerListResponse>("GET", "/customers", {
    query: {
      offset: args?.offset ?? 0,
      limit: args?.limit ?? 50,
      q: args?.q,
      has_account: args?.has_account,
      order: args?.order ?? "-created_at",
      fields: "id,email,first_name,last_name,phone,has_account,created_at,metadata",
    },
  })
}

export async function createCustomer(body: {
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  metadata?: Record<string, unknown>
}) {
  return medusaFetch<{ customer: AdminCustomer }>("POST", "/customers", { body })
}

export async function updateCustomer(id: string, body: Partial<{
  email: string
  first_name: string
  last_name: string
  phone: string
  metadata: Record<string, unknown>
}>) {
  return medusaFetch<{ customer: AdminCustomer }>("POST", `/customers/${id}`, { body })
}

export async function deleteCustomer(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/customers/${id}`)
}

// ─── Customer addresses ──────────────────────────────────────────────

export async function addCustomerAddress(customerId: string, body: AddressInput & {
  is_default_shipping?: boolean
  is_default_billing?: boolean
  company?: string
  metadata?: Record<string, unknown>
}) {
  return medusaFetch<{ customer: AdminCustomerDetail }>("POST", `/customers/${customerId}/addresses`, { body })
}

export async function updateCustomerAddress(customerId: string, addressId: string, body: AddressInput & {
  is_default_shipping?: boolean
  is_default_billing?: boolean
}) {
  return medusaFetch<{ customer: AdminCustomerDetail }>(
    "POST",
    `/customers/${customerId}/addresses/${addressId}`,
    { body },
  )
}

export async function deleteCustomerAddress(customerId: string, addressId: string) {
  return medusaFetch<{ id: string; deleted: boolean }>(
    "DELETE",
    `/customers/${customerId}/addresses/${addressId}`,
  )
}

// ─── Draft orders (creación manual de pedido) ─────────────────────────

export async function createDraftOrder(body: {
  email: string
  region_id?: string
  sales_channel_id?: string
  currency_code?: string
  customer_id?: string | null
  items: Array<{
    variant_id?: string
    title: string
    quantity: number
    unit_price: number
  }>
  shipping_address?: {
    first_name?: string
    last_name?: string
    address_1?: string
    city?: string
    province?: string
    postal_code?: string
    country_code?: string
    phone?: string
  }
  metadata?: Record<string, unknown>
}) {
  return medusaFetch<{ draft_order: { id: string; display_id: number } }>(
    "POST",
    "/draft-orders",
    { body },
  )
}

// ─── Domain types — Promotions (core Medusa) ────────────────────────

export interface AdminPromotion {
  id: string
  code: string
  type: "standard" | "buyget"
  is_automatic: boolean
  status: "active" | "inactive" | "draft"
  application_method?: {
    type: "percentage" | "fixed"
    value: number
    target_type: "order" | "items" | "shipping_methods"
    allocation: "across" | "each"
  }
  rules?: Array<{
    attribute: string
    operator: string
    /** Medusa devuelve los values envueltos en `{value: string}` */
    values: Array<{ value: string } | string>
  }>
  created_at: string
}

export async function listPromotions(args?: {
  limit?: number
  offset?: number
  q?: string
  is_automatic?: boolean
}) {
  return medusaFetch<{ promotions: AdminPromotion[]; count: number; offset: number; limit: number }>("GET", "/promotions", {
    query: {
      offset: args?.offset ?? 0,
      limit: args?.limit ?? 50,
      q: args?.q,
      is_automatic: args?.is_automatic,
      fields: "id,code,type,is_automatic,status,*application_method,*rules,created_at",
    },
  })
}

export interface CreatePromotionInput {
  code: string
  type?: "standard" | "buyget"
  is_automatic?: boolean
  status?: "active" | "inactive" | "draft"
  application_method: {
    type: "percentage" | "fixed"
    value: number
    target_type: "order" | "items" | "shipping_methods"
    allocation?: "across" | "each"
    /** Currency required when type=fixed */
    currency_code?: string
  }
}

export async function createPromotion(body: CreatePromotionInput) {
  return medusaFetch<{ promotion: AdminPromotion }>("POST", "/promotions", { body })
}

export async function updatePromotion(id: string, body: Partial<{
  code: string
  is_automatic: boolean
  status: "active" | "inactive" | "draft"
  application_method: {
    type?: "percentage" | "fixed"
    value?: number
    target_type?: "order" | "items" | "shipping_methods"
    allocation?: "across" | "each"
    currency_code?: string
  }
}>) {
  return medusaFetch<{ promotion: AdminPromotion }>("POST", `/promotions/${id}`, { body })
}

export async function deletePromotion(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/promotions/${id}`)
}

// ─── Customer Groups ────────────────────────────────────────────────

export interface AdminCustomerGroup {
  id: string
  name: string
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at?: string
  customers?: Array<{ id: string; email: string }>
}

export async function listCustomerGroups(args?: { q?: string; limit?: number; offset?: number }) {
  return medusaFetch<{ customer_groups: AdminCustomerGroup[]; count: number }>(
    "GET",
    "/customer-groups",
    {
      query: {
        q: args?.q,
        limit: args?.limit ?? 100,
        offset: args?.offset ?? 0,
        fields: "id,name,metadata,created_at,updated_at,*customers",
      },
    },
  )
}

export async function retrieveCustomerGroup(id: string) {
  return medusaFetch<{ customer_group: AdminCustomerGroup }>("GET", `/customer-groups/${id}`, {
    query: { fields: "id,name,metadata,created_at,*customers" },
  })
}

export async function createCustomerGroup(body: { name: string; metadata?: Record<string, unknown> }) {
  return medusaFetch<{ customer_group: AdminCustomerGroup }>("POST", "/customer-groups", { body })
}

export async function updateCustomerGroup(id: string, body: Partial<{
  name: string
  metadata: Record<string, unknown>
}>) {
  return medusaFetch<{ customer_group: AdminCustomerGroup }>("POST", `/customer-groups/${id}`, { body })
}

export async function deleteCustomerGroup(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/customer-groups/${id}`)
}

export async function addCustomersToGroup(groupId: string, customerIds: string[]) {
  return medusaFetch<{ customer_group: AdminCustomerGroup }>(
    "POST",
    `/customer-groups/${groupId}/customers`,
    { body: { add: customerIds } },
  )
}

export async function removeCustomersFromGroup(groupId: string, customerIds: string[]) {
  return medusaFetch<{ customer_group: AdminCustomerGroup }>(
    "POST",
    `/customer-groups/${groupId}/customers`,
    { body: { remove: customerIds } },
  )
}

// ─── Stores (Medusa v2 multi-store) ──────────────────────────────────

export interface AdminStore {
  id: string
  name: string
  default_sales_channel_id?: string | null
  default_region_id?: string | null
  default_location_id?: string | null
  default_currency_code?: string | null
  supported_currencies?: Array<{ currency_code: string; is_default?: boolean; is_tax_inclusive?: boolean }>
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at?: string
}

export async function listStores() {
  return medusaFetch<{ stores: AdminStore[]; count: number }>("GET", "/stores", {
    query: { limit: 50, fields: "id,name,*supported_currencies,default_sales_channel_id,default_region_id,default_currency_code,metadata,created_at,updated_at" },
  })
}

export async function updateStore(id: string, body: Partial<{
  name: string
  default_sales_channel_id: string | null
  default_region_id: string | null
  default_location_id: string | null
  supported_currencies: Array<{ currency_code: string; is_default?: boolean; is_tax_inclusive?: boolean }>
  metadata: Record<string, unknown>
}>) {
  return medusaFetch<{ store: AdminStore }>("POST", `/stores/${id}`, { body })
}

// ─── Regions ────────────────────────────────────────────────────────

export interface AdminRegion {
  id: string
  name: string
  currency_code: string
  automatic_taxes?: boolean
  countries?: Array<{ id: string; iso_2: string; display_name: string }>
  payment_providers?: Array<{ id: string; is_enabled: boolean }>
  metadata?: Record<string, unknown> | null
  created_at: string
}

export async function listRegions() {
  return medusaFetch<{ regions: AdminRegion[]; count: number }>("GET", "/regions", {
    query: { limit: 100, fields: "id,name,currency_code,automatic_taxes,*countries,*payment_providers,metadata,created_at" },
  })
}

export async function createRegion(body: {
  name: string
  currency_code: string
  countries: string[]
  automatic_taxes?: boolean
}) {
  return medusaFetch<{ region: AdminRegion }>("POST", "/regions", { body })
}

export async function updateRegion(id: string, body: Partial<{
  name: string
  currency_code: string
  countries: string[]
  automatic_taxes: boolean
}>) {
  return medusaFetch<{ region: AdminRegion }>("POST", `/regions/${id}`, { body })
}

export async function deleteRegion(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/regions/${id}`)
}

// ─── Sales Channels ─────────────────────────────────────────────────

export interface AdminSalesChannel {
  id: string
  name: string
  description?: string | null
  is_disabled: boolean
  metadata?: Record<string, unknown> | null
  created_at: string
}

export async function listSalesChannels() {
  return medusaFetch<{ sales_channels: AdminSalesChannel[]; count: number }>(
    "GET",
    "/sales-channels",
    { query: { limit: 100, fields: "id,name,description,is_disabled,metadata,created_at" } },
  )
}

export async function createSalesChannel(body: { name: string; description?: string }) {
  return medusaFetch<{ sales_channel: AdminSalesChannel }>("POST", "/sales-channels", { body })
}

export async function updateSalesChannel(id: string, body: Partial<{
  name: string
  description: string | null
  is_disabled: boolean
}>) {
  return medusaFetch<{ sales_channel: AdminSalesChannel }>("POST", `/sales-channels/${id}`, { body })
}

export async function deleteSalesChannel(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/sales-channels/${id}`)
}

// ─── API Keys ───────────────────────────────────────────────────────

export interface AdminApiKey {
  id: string
  title: string
  type: "publishable" | "secret"
  redacted: string
  /** Solo se devuelve en el create response (NUNCA se vuelve a ver) */
  token?: string
  created_at: string
  revoked_at?: string | null
  last_used_at?: string | null
}

export async function listApiKeys() {
  return medusaFetch<{ api_keys: AdminApiKey[]; count: number }>("GET", "/api-keys", {
    query: { limit: 50, fields: "id,title,type,redacted,created_at,revoked_at,last_used_at" },
  })
}

export async function createApiKey(body: { title: string; type: "publishable" | "secret" }) {
  return medusaFetch<{ api_key: AdminApiKey }>("POST", "/api-keys", { body })
}

export async function revokeApiKey(id: string) {
  return medusaFetch<{ api_key: AdminApiKey }>("POST", `/api-keys/${id}/revoke`)
}

export async function deleteApiKey(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/api-keys/${id}`)
}

// ─── Users / Team ────────────────────────────────────────────────────

export interface AdminUser {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  avatar_url?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
}

export async function listUsers() {
  return medusaFetch<{ users: AdminUser[]; count: number }>("GET", "/users", {
    query: { limit: 100, fields: "id,email,first_name,last_name,avatar_url,metadata,created_at" },
  })
}

export interface AdminInvite {
  id: string
  email: string
  accepted: boolean
  token?: string
  expires_at: string
  created_at: string
}

export async function listInvites() {
  return medusaFetch<{ invites: AdminInvite[]; count: number }>("GET", "/invites", {
    query: { limit: 50 },
  })
}

export async function createInvite(body: { email: string }) {
  return medusaFetch<{ invite: AdminInvite }>("POST", "/invites", { body })
}

export async function deleteInvite(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/invites/${id}`)
}

// ─── Custom: Finanzas ─────────────────────────────────────────────────

export interface FinanzasPagoMovil {
  id: string
  order_id: string
  order_display_id: number
  order_email: string | null
  customer_name: string | null
  cedula: string | null
  customer_phone: string | null
  bcv_eur_rate: number
  usdt_eur_rate: number
  amount_eur_subtotal: number
  amount_eur_discount: number
  amount_eur_total: number
  amount_bs_total: number
  amount_eur_cogs: number
  amount_eur_margin: number
  bs_pending: number
  bs_converted_total: number
  status: string
  combo_tier_label: string | null
  cogs_complete: boolean
  margin_negative: boolean
  created_at: string
}

export interface FinanzasExpense {
  id: string
  category_id: string
  description: string
  amount_usdt: number
  amount_bs?: number | null
  status: "paid" | "pending_payment"
  paid_from_wallet_id?: string | null
  expense_date: string
  receipt_url?: string | null
  notes?: string | null
}

export interface FinanzasConversion {
  id: string
  pago_movil_id?: string | null
  amount_bs: number
  amount_usdt: number
  spread_pct: number
  reference?: string | null
  converted_at: string
  note?: string | null
}

export interface FinanzasComment {
  id: string
  body: string
  author_email?: string | null
  author_name?: string | null
  scope: string
  scope_id?: string | null
  resolved: boolean
  created_at: string
}

export interface FinanzasRunwayReport {
  usdt_balance: number
  monthly_burn_target_usdt: number
  monthly_burn_actual_usdt: number
  monthly_burn_used_usdt: number
  runway_months: number | null
  level: "critical" | "warning" | "ok"
  history_3m: Array<{ month: string; spent_usdt: number }>
}

export interface FinanzasPlReport {
  /** Most fields are optional so the panel renders gracefully even if the
   *  report shape evolves. */
  month: string
  revenue_eur?: number
  cogs_eur?: number
  margin_eur?: number
  expenses_eur?: number
  net_eur?: number
  splits?: Array<{ bucket: string; amount_eur: number; percentage: number }>
  [k: string]: unknown
}

// ─── Finanzas: Wallets (multi-wallet ledger) ─────────────────────────

export interface FinanzasWallet {
  id: string
  name: string
  currency: string  // "bs" | "usdt" | "eur" | "usd"
  description?: string | null
  is_active: boolean
  sort_order: number
}

export interface FinanzasWalletBalance {
  id: string
  name: string
  currency: string
  balance: number
}

export async function listFinanzasWallets() {
  return medusaFetch<{ wallets: FinanzasWallet[] }>("GET", "/finanzas/wallets")
}

export async function createFinanzasWallet(body: {
  name: string
  currency: string
  description?: string
  sort_order?: number
  is_active?: boolean
}) {
  return medusaFetch<{ wallet: FinanzasWallet }>("POST", "/finanzas/wallets", { body })
}

export async function updateFinanzasWallet(id: string, body: Partial<{
  name: string
  currency: string
  description: string | null
  sort_order: number
  is_active: boolean
}>) {
  return medusaFetch<{ wallet: FinanzasWallet }>("PATCH", `/finanzas/wallets/${id}`, { body })
}

export async function deleteFinanzasWallet(id: string) {
  return medusaFetch<{ deleted: boolean }>("DELETE", `/finanzas/wallets/${id}`)
}

// ─── Finanzas: Summary (single-call dashboard endpoint) ──────────────

export interface FinanzasSummary {
  month: string
  range: { from: string; to: string }
  totals: {
    orders: number
    revenue_eur: number
    revenue_bs: number
    revenue_usdt_theoretical: number
    cogs_eur: number
    margin_eur: number
    bs_pending: number
    pending_expenses_usdt: number
  }
  splits: {
    restock:      { eur: number; usdt: number; spent_usdt: number }
    gastos_fijos: { eur: number; usdt: number; spent_usdt: number }
    marketing:    { eur: number; usdt: number; spent_usdt: number }
    ganancia:     { eur: number; usdt: number; spent_usdt: number }
  }
  expenses_by_bucket: Record<string, { spent_usdt: number; count: number } | undefined>
  wallets: FinanzasWalletBalance[]
  alerts: {
    missing_cost: number
    negative_margin: number
    pending_expenses: number
  }
}

export async function getFinanzasSummary(month?: string) {
  return medusaFetch<FinanzasSummary>("GET", "/finanzas/summary", {
    query: month ? { month } : undefined,
  })
}

export async function listPagoMovil(args?: { limit?: number; offset?: number; status?: string }) {
  return medusaFetch<{ pago_movils: FinanzasPagoMovil[]; count: number }>("GET", "/finanzas/pago-movil", {
    query: { limit: args?.limit ?? 50, offset: args?.offset ?? 0, status: args?.status },
  })
}

export async function listFinanzasExpenses(args?: { limit?: number; status?: string; category_id?: string }) {
  return medusaFetch<{ expenses: FinanzasExpense[] }>("GET", "/finanzas/expenses", {
    query: { limit: args?.limit ?? 50, status: args?.status, category_id: args?.category_id },
  })
}

export async function listFinanzasConversions(args?: { limit?: number }) {
  return medusaFetch<{ conversions: FinanzasConversion[] }>("GET", "/finanzas/conversions", {
    query: { limit: args?.limit ?? 50 },
  })
}

export async function listFinanzasComments(args?: { limit?: number; scope?: string }) {
  return medusaFetch<{ comments: FinanzasComment[] }>("GET", "/finanzas/comments", {
    query: { limit: args?.limit ?? 20, scope: args?.scope },
  })
}

export async function getRunwayReport() {
  return medusaFetch<FinanzasRunwayReport>("GET", "/finanzas/reports/runway")
}

export async function getPlReport(month?: string) {
  return medusaFetch<{ pl: FinanzasPlReport }>("GET", "/finanzas/reports/pl", { query: { month } })
}

// ─── Finanzas mutations (custom plugin endpoints) ────────────────────

export async function createFinanzasExpense(body: {
  category_id: string
  description: string
  amount_usdt: number
  amount_bs?: number
  rate_bs_per_usdt?: number
  paid_from_wallet_id?: string
  receipt_url?: string
  expense_date?: string
  notes?: string
  status?: "paid" | "pending_payment"
}) {
  return medusaFetch<{ expense: FinanzasExpense }>("POST", "/finanzas/expenses", { body })
}

export async function updateFinanzasExpense(id: string, body: Partial<{
  category_id: string
  description: string
  amount_usdt: number
  amount_bs: number
  rate_bs_per_usdt: number
  paid_from_wallet_id: string
  receipt_url: string
  expense_date: string
  notes: string
  status: "paid" | "pending_payment"
  correction_note: string
}>) {
  return medusaFetch<{ expense: FinanzasExpense }>("PATCH", `/finanzas/expenses/${id}`, { body })
}

export async function deleteFinanzasExpense(id: string) {
  return medusaFetch<{ deleted: boolean }>("DELETE", `/finanzas/expenses/${id}`)
}

// ─── Finanzas: Expense Categories ────────────────────────────────────

export interface FinanzasExpenseCategory {
  id: string
  name: string
  bucket: string  // "restock" | "gastos_fijos" | "marketing" | "ganancia"
  description?: string | null
  is_recurring?: boolean
  recurring_amount_usdt?: number | null
  recurring_day_of_month?: number | null
  is_active: boolean
}

export async function listFinanzasExpenseCategories() {
  return medusaFetch<{ categories: FinanzasExpenseCategory[] }>("GET", "/finanzas/expense-categories")
}

export async function createFinanzasExpenseCategory(body: {
  name: string
  bucket: string
  description?: string
  is_recurring?: boolean
  recurring_amount_usdt?: number
  recurring_day_of_month?: number
  is_active?: boolean
}) {
  return medusaFetch<{ category: FinanzasExpenseCategory }>("POST", "/finanzas/expense-categories", { body })
}

export async function createFinanzasConversion(body: {
  date?: string
  amount_bs: number
  amount_usdt: number
  rate?: number
  spread_pct?: number
  reference?: string
  notes?: string
}) {
  return medusaFetch<{ conversion: FinanzasConversion }>("POST", "/finanzas/conversions", { body })
}

// ─── Custom: Loyalty ──────────────────────────────────────────────────

export interface LoyaltyReward {
  id: string
  name: string
  description?: string | null
  points_required: number
  image_url?: string | null
  is_active: boolean
  stock?: number | null
  created_at: string
}

export async function createLoyaltyReward(body: {
  name: string
  description?: string
  points_required: number
  image_url?: string
  is_active?: boolean
}) {
  return medusaFetch<{ reward: LoyaltyReward }>("POST", "/loyalty/rewards", { body })
}

export async function updateLoyaltyReward(id: string, body: Partial<{
  name: string
  description: string
  points_required: number
  image_url: string
  is_active: boolean
}>) {
  return medusaFetch<{ reward: LoyaltyReward }>("POST", `/loyalty/rewards/${id}`, { body })
}

export async function deleteLoyaltyReward(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/loyalty/rewards/${id}`)
}

export async function listLoyaltyRewards() {
  return medusaFetch<{ rewards: LoyaltyReward[] }>("GET", "/loyalty/rewards")
}

// ─── Custom: Referrals ────────────────────────────────────────────────

export interface ReferralRecord {
  id: string
  referrer_customer_id: string
  referee_customer_id: string
  referee_email: string | null
  code: string
  order_id: string | null
  status: "awarded" | "rejected" | "pending"
  rejected_reason: string | null
  referrer_points: number
  referee_points: number
  awarded_at: string | null
  created_at: string
}

export async function listReferrals(args?: { status?: "awarded" | "rejected" | "pending"; limit?: number }) {
  return medusaFetch<{ referrals: ReferralRecord[]; count: number }>("GET", "/referrals/list", {
    query: { status: args?.status, limit: args?.limit ?? 50 },
  })
}

// ─── Custom: Social ──────────────────────────────────────────────────

export interface SocialPost {
  id: string
  external_id: string
  number: string
  title: string
  pillar?: string | null
  format: string
  date_label?: string | null
  date_planned?: string | null
  caption?: string | null
  cover_url?: string | null
  media_urls?: string[] | null
  status: string  // draft | in_review | approved | scheduled | publishing | published | failed | rejected
  /** Cuándo Buffer va a publicar (después de POST /publish/:id) */
  scheduled_at?: string | null
  buffer_post_id?: string | null
  /** Cuándo se publicó realmente (Buffer webhook) */
  published_at?: string | null
  failure_reason?: string | null
  error_count?: number
  channel?: string | null
  metrics?: {
    reach?: number
    likes?: number
    comments?: number
    saves?: number
  } | null
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at?: string
}

export async function listSocialPosts() {
  return medusaFetch<{ posts: SocialPost[] }>("GET", "/social/posts")
}

export async function createSocialPost(body: {
  channel: string
  title: string
  content?: string
  date_planned?: string
  status?: string
  media_urls?: string[]
  metadata?: Record<string, unknown>
}) {
  return medusaFetch<{ post: SocialPost }>("POST", "/social/posts", { body })
}

/**
 * Update genérico de un post — el backend Medusa expone PATCH /admin/social/posts/:id
 * y acepta cualquier campo del modelo SocialPost.
 */
export async function updateSocialPost(id: string, body: Partial<{
  title: string
  caption: string
  date_planned: string | null
  status: string
  pillar: string
  format: string
  cover_url: string
  media_urls: string[]
  scheduled_at: string | null
  buffer_post_id: string | null
  failure_reason: string | null
  /** Campo libre para almacenar hashtags/comments/etc. del panel cliente */
  metadata: Record<string, unknown>
}>) {
  return medusaFetch<{ post: SocialPost }>("PATCH", `/social/posts/${id}`, { body })
}

/** Approve = update con status approved (el backend audita el cambio). */
export async function approveSocialPost(id: string) {
  return medusaFetch<{ post: SocialPost }>("PATCH", `/social/posts/${id}`, {
    body: { status: "approved" },
  })
}

/** Reject = update con status rejected. */
export async function rejectSocialPost(id: string) {
  return medusaFetch<{ post: SocialPost }>("PATCH", `/social/posts/${id}`, {
    body: { status: "rejected" },
  })
}

/**
 * Publica/programa el post en Buffer (que después lo sube a IG/TT/etc.).
 *
 * Body:
 *  - entity: "post" | "story" — qué entidad estás publicando
 *  - when?: ISO8601 — programar a futuro. Si no, sale lo más rápido posible.
 *
 * Backend POST /admin/social/publish/:id
 */
export async function publishSocialEntity(id: string, args: {
  entity: "post" | "story"
  when?: string
}) {
  return medusaFetch<{ post?: SocialPost; story?: SocialStory }>(
    "POST", `/social/publish/${id}`, { body: args },
  )
}

/**
 * Cancela un envío programado en Buffer y vuelve el post/story a "approved".
 * Backend POST /admin/social/cancel-schedule/:id
 */
export async function cancelSocialSchedule(id: string, entity: "post" | "story" = "post") {
  return medusaFetch<{ post?: SocialPost; story?: SocialStory }>(
    "POST", `/social/cancel-schedule/${id}`, { body: { entity } },
  )
}

// ─── Social: Feedback (threaded comments + timestamp-anchored notes) ──

export interface SocialFeedback {
  id: string
  entity_type: "post" | "story"
  entity_id: string
  text: string
  parent_id?: string | null
  /** Timestamp en ms para anchorar feedback a un punto del video (frame.io style) */
  timestamp_ms?: number | null
  author_id?: string | null
  author_name?: string | null
  author_email?: string | null
  resolved: boolean
  resolved_at?: string | null
  resolved_by?: string | null
  created_at: string
  updated_at?: string
}

export async function listSocialFeedback(args: { entity_type: "post" | "story"; entity_id: string }) {
  return medusaFetch<{ feedback: SocialFeedback[] }>("GET", "/social/feedback", {
    query: { entity_type: args.entity_type, entity_id: args.entity_id },
  })
}

/** Trae TODO el feedback (sin filtrar por entity) — útil para inbox global. */
export async function listAllSocialFeedback() {
  return medusaFetch<{ feedback: SocialFeedback[] }>("GET", "/social/feedback")
}

export async function createSocialFeedback(body: {
  entity_type: "post" | "story"
  entity_id: string
  text: string
  parent_id?: string | null
  timestamp_ms?: number | null
}) {
  return medusaFetch<{ feedback: SocialFeedback }>("POST", "/social/feedback", { body })
}

export async function updateSocialFeedback(id: string, body: Partial<{
  text: string
  resolved: boolean
}>) {
  return medusaFetch<{ feedback: SocialFeedback }>("PATCH", `/social/feedback/${id}`, { body })
}

export async function deleteSocialFeedback(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/social/feedback/${id}`)
}

// ─── Social: Activity timeline ───────────────────────────────────────

export interface SocialActivity {
  id: string
  entity_type: "post" | "story"
  entity_id: string
  action: string  // status_changed | feedback_added | feedback_resolved | scheduled | cancelled | etc.
  actor_id?: string | null
  actor_name?: string | null
  payload?: Record<string, unknown> | null
  created_at: string
}

export async function listSocialActivity(args: { entity_type: "post" | "story"; entity_id: string }) {
  return medusaFetch<{ activity: SocialActivity[] }>("GET", "/social/activity", {
    query: { entity_type: args.entity_type, entity_id: args.entity_id },
  })
}

/**
 * Toggle de modo mantenimiento (custom endpoint del plugin enrola-core).
 */
export async function setMaintenanceStatus(body: { enabled: boolean; message?: string | null }) {
  return medusaFetch<{ enabled: boolean; message?: string | null }>("POST", "/maintenance", { body })
}

// ─── Social: Trends (signals + AI weekly brief) ─────────────────────

export interface SocialTrendSource {
  id: string
  kind: "reddit_post" | "youtube_video" | "google_term" | "instagram_post"
  source_id: string
  source_url?: string | null
  title: string
  author?: string | null
  summary?: string | null
  media_url?: string | null
  permalink?: string | null
  score: number
  comments: number
  engagement_delta?: number | null
  keywords?: string[] | null
  region?: string | null
  posted_at?: string | null
  fetched_at: string
}

export interface SocialTrendBrief {
  id: string
  week_start: string
  generated_at: string
  content: {
    themes?: Array<{ title: string; why: string; sources?: string[] }>
    content_ideas?: string[]
    hashtag_watch?: string[]
    model?: string
    input_tokens?: number
    output_tokens?: number
  }
  model_name?: string | null
}

export async function listSocialTrends(args?: {
  kind?: "reddit_post" | "youtube_video" | "google_term" | "instagram_post"
  days?: number
  limit?: number
}) {
  return medusaFetch<{ sources: SocialTrendSource[]; brief: SocialTrendBrief | null }>(
    "GET", "/social/trends", {
      query: {
        kind: args?.kind,
        days: args?.days ?? 7,
        limit: args?.limit ?? 60,
      },
    },
  )
}

/** Re-scrape de trends + opcionalmente regenera el brief AI. */
export async function refreshSocialTrends(args?: { brief?: boolean }) {
  return medusaFetch<{
    ok: boolean
    upserted: number
    sources_total?: number
    brief_generated?: boolean
    duration_ms?: number
  }>("POST", "/social/trends/refresh", {
    body: args ?? {},
  })
}

// ─── Social: Trend subscriptions (YouTube channels para scrape) ──────

export interface SocialTrendSubscription {
  id: string
  kind: string  // "youtube_channel" | "reddit_subreddit" | etc.
  source_id: string  // UCxxx para YT, sub name para Reddit
  label: string  // friendly name
  active: boolean
  created_at: string
}

export async function listTrendSubscriptions(args?: { kind?: string }) {
  return medusaFetch<{ subscriptions: SocialTrendSubscription[] }>(
    "GET", "/social/trend-subscriptions", { query: args },
  )
}

export async function createTrendSubscription(body: {
  kind: string
  source_id: string
  label: string
  active?: boolean
}) {
  return medusaFetch<{ subscription: SocialTrendSubscription }>(
    "POST", "/social/trend-subscriptions", { body },
  )
}

export async function updateTrendSubscription(id: string, body: Partial<{
  label: string
  active: boolean
}>) {
  return medusaFetch<{ subscription: SocialTrendSubscription }>(
    "PATCH", `/social/trend-subscriptions/${id}`, { body },
  )
}

export async function deleteTrendSubscription(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>(
    "DELETE", `/social/trend-subscriptions/${id}`,
  )
}

// ─── Social: Suggestions (ideas de contenido — pipeline trend→post) ──

export interface SocialSuggestion {
  id: string
  kind: "post" | "story"
  title: string
  body?: string | null
  pillar?: string | null
  format?: string | null
  suggested_date?: string | null
  source: "manual" | "trend" | "feedback"
  source_ref?: string | null
  status: "idea" | "in_design" | "rejected" | "promoted"
  promoted_to?: string | null
  created_by?: string | null
  created_at: string
  updated_at?: string
}

export async function listSocialSuggestions(args?: {
  status?: "idea" | "in_design" | "rejected" | "promoted"
  kind?: "post" | "story"
}) {
  return medusaFetch<{ suggestions: SocialSuggestion[] }>(
    "GET", "/social/suggestions", { query: args },
  )
}

export async function createSocialSuggestion(body: {
  kind?: "post" | "story"
  title: string
  body?: string
  pillar?: string
  format?: string
  suggested_date?: string
  source?: "manual" | "trend" | "feedback"
  source_ref?: string
}) {
  return medusaFetch<{ suggestion: SocialSuggestion }>(
    "POST", "/social/suggestions", { body },
  )
}

export async function updateSocialSuggestion(id: string, body: Partial<{
  kind: "post" | "story"
  title: string
  body: string
  pillar: string
  format: string
  source: "manual" | "trend" | "feedback"
  source_ref: string
  status: "idea" | "in_design" | "rejected" | "promoted"
  suggested_date: string | null
}>) {
  return medusaFetch<{ suggestion: SocialSuggestion }>(
    "PATCH", `/social/suggestions/${id}`, { body },
  )
}

export async function deleteSocialSuggestion(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>(
    "DELETE", `/social/suggestions/${id}`,
  )
}

/**
 * Promueve una sugerencia a un social_post real (status=draft).
 * Backend POST /admin/social/suggestions/:id/promote
 */
export async function promoteSocialSuggestion(id: string, body?: {
  title?: string
  caption?: string
  pillar?: string
  format?: "Single" | "Carrusel" | "Reel"
  date_planned?: string
}) {
  return medusaFetch<{ post: SocialPost; suggestion: SocialSuggestion }>(
    "POST", `/social/suggestions/${id}/promote`, { body: body ?? {} },
  )
}

/**
 * Bulk import: convierte el brief AI (themes + content_ideas) en suggestions.
 * Idempotente — no crea duplicados.
 */
export async function importSuggestionsFromTrends(body?: {
  includeThemes?: boolean
  includeIdeas?: boolean
  fallbackRawLimit?: number
  kind?: "post" | "story"
}) {
  return medusaFetch<{
    imported: number
    skipped: number
    considered: number
    source: "brief" | "raw"
  }>("POST", "/social/suggestions/import-from-trends", { body: body ?? {} })
}

// ─── Social: Sync (refresca posts+stories desde el pipeline) ─────────

export interface SocialSyncResult {
  ok: boolean
  posts_synced: number
  stories_synced: number
  static_root: string
}

/**
 * Re-lee storefront/scripts/social/dashboard.html, copia media a /static/
 * y upsertea posts + stories. Idempotente: respeta status/feedback existente.
 */
export async function syncSocial() {
  return medusaFetch<SocialSyncResult>("POST", "/social/sync")
}

// ─── Social: Buffer quota status ─────────────────────────────────────

export interface BufferQuotaStatus {
  used_24h: number
  cap: number
  remaining: number
  rate_limited_until: string | null
  reset_at: string | null
}

export async function getBufferStatus() {
  return medusaFetch<BufferQuotaStatus>("GET", "/social/buffer-status")
}

/**
 * @deprecated usa publishSocialEntity con entity="post" — éste lo wrappea
 * para mantener compat con código viejo.
 */
export async function publishSocialPost(id: string) {
  return publishSocialEntity(id, { entity: "post" })
}

// ─── Social: Stories (separate model, separate endpoint) ────────────

export interface SocialStory {
  id: string
  external_id: string
  date: string         // "YYYY-MM-DD"
  slot: number         // 1..3
  type: string         // product | quote | poll | dyk | bts | combo | repost | mood
  media_url?: string | null
  link_url?: string | null
  link_x?: number | null
  link_y?: number | null
  link_width?: number | null
  link_height?: number | null
  link_rotation?: number | null
  status: string
  scheduled_at?: string | null
  ig_story_id?: string | null
  published_at?: string | null
  failure_reason?: string | null
  error_count?: number
}

export async function listSocialStories() {
  return medusaFetch<{ stories: SocialStory[] }>("GET", "/social/stories")
}

export async function updateSocialStory(id: string, body: Partial<{
  status: string
  media_url: string
  link_url: string
  link_x: number
  link_y: number
  link_width: number
  link_height: number
  link_rotation: number
  scheduled_at: string
}>) {
  return medusaFetch<{ story: SocialStory }>("PATCH", `/social/stories/${id}`, { body })
}

export async function deleteSocialStory(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/social/stories/${id}`)
}

export async function deleteSocialPost(id: string) {
  return medusaFetch<{ id: string; deleted: boolean }>("DELETE", `/social/posts/${id}`)
}

// ─── Custom: Maintenance toggle ──────────────────────────────────────

export async function getMaintenanceStatus() {
  return medusaFetch<{ enabled: boolean; message?: string | null }>("GET", "/maintenance")
}

// ─── Custom: Remarketing ──────────────────────────────────────────────

export type RemarketingChannel = "auto" | "email" | "whatsapp"

export interface RemarketingRuleFull {
  key: string
  name: string
  description?: string | null
  enabled: boolean
  priority: number
  cooldown_hours: number
  channel: RemarketingChannel
  match_signal_id?: string | null
  match_signal_prefix?: string | null
  min_severity?: "high" | "medium" | "low" | "info"
  email_subject_template?: string | null
  email_html_template?: string | null
  whatsapp_template?: string | null
  quiet_hours_start?: number | null
  quiet_hours_end?: number | null
  daily_cap?: number | null
  variants?: unknown | null
  city_overrides?: Record<string, unknown> | null
  // Stats populated server-side
  stats?: {
    rule_key: string
    fires_24h?: number
    fires_7d?: number
    fires_total?: number
    sent?: number
    failed?: number
    converted?: number
    skipped_cooldown?: number
    skipped_quiet_hours?: number
    skipped_cap?: number
  }
  variant_stats?: Array<{
    rule_key: string
    variant_key: string
    fires: number
    converted: number
  }>
}

export type RemarketingFireStatus =
  | "pending" | "sent" | "failed"
  | "skipped_cooldown" | "skipped_quiet_hours" | "skipped_cap" | "skipped_no_channel"
  | "dry_run" | "converted"

export interface RemarketingFire {
  id: string
  rule_key: string
  customer_id: string | null
  email: string | null
  phone: string | null
  distinct_id: string | null
  signal_id: string
  signal_severity: string
  channel: RemarketingChannel
  status: RemarketingFireStatus
  subject: string | null
  body: string | null
  error_message: string | null
  fired_at: string
  converted_order_id: string | null
  converted_at: string | null
  context: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface RemarketingStats {
  total_customers?: number
  total_subscribers?: number
  total_emails_sent?: number
  total_whatsapp_sent?: number
  conversion_rate?: number
  [k: string]: unknown
}

export interface RemarketingSetting {
  key: string
  value: { enabled?: boolean; [k: string]: unknown }
}

export interface RemarketingMain {
  stats: RemarketingStats
  settings: RemarketingSetting[]
  products: Array<{ id: string; title: string; handle: string; thumbnail?: string | null }>
}

export async function getRemarketingMain() {
  return medusaFetch<RemarketingMain>("GET", "/remarketing")
}

export async function updateRemarketingSetting(key: string, value: Record<string, unknown>) {
  return medusaFetch<{ success: boolean }>("POST", "/remarketing", {
    body: { action: "update_setting", key, value },
  })
}

export async function saveCrossSellMap(map: Record<string, string[]>) {
  return medusaFetch<{ success: boolean }>("POST", "/remarketing", {
    body: { action: "save_crosssell", map },
  })
}

export async function sendTestEmail(args: { type: string; to: string }) {
  return medusaFetch<{ success: boolean; messageId?: string }>("POST", "/remarketing", {
    body: { action: "test_email", type: args.type, to: args.to },
  })
}

// ─── Remarketing Rules (full CRUD) ──────────────────────────────────

export async function listRemarketingRulesFull() {
  return medusaFetch<{ rules: RemarketingRuleFull[] }>("GET", "/remarketing/rules")
}

export async function upsertRemarketingRule(rule: Partial<RemarketingRuleFull> & { key: string; name: string }) {
  return medusaFetch<{ success: boolean }>("POST", "/remarketing/rules", { body: rule })
}

export async function toggleRemarketingRule(key: string, enabled: boolean) {
  return medusaFetch<{ success: boolean }>("POST", "/remarketing/rules", {
    query: { action: "toggle" },
    body: { key, enabled },
  })
}

export async function deleteRemarketingRule(key: string) {
  return medusaFetch<{ success: boolean }>("POST", "/remarketing/rules", {
    query: { action: "delete" },
    body: { key },
  })
}

// ─── Remarketing Fires (sent messages log) ──────────────────────────

export async function listRemarketingFires(args?: {
  rule_key?: string
  status?: RemarketingFireStatus
  since_hours?: number
  limit?: number
}) {
  return medusaFetch<{ fires: RemarketingFire[]; count: number }>("GET", "/remarketing/fires", {
    query: args,
  })
}

// ─── Patterns + Intelligence ────────────────────────────────────────

export interface RemarketingPatternsSummary {
  total_users?: number
  buying_segments?: Array<{ segment: string; count: number; pct: number; ltv_avg?: number }>
  top_repeat_products?: Array<{ product_id: string; title: string; repeat_rate: number; median_days_between: number }>
  cross_sell_strength?: Array<{ anchor: string; partner: string; attach_pct: number }>
  funnel_global?: { sessions: number; carts: number; checkouts: number; orders: number }
  [k: string]: unknown
}

export async function getRemarketingPatterns(force = false) {
  return medusaFetch<RemarketingPatternsSummary>("GET", "/remarketing/patterns", {
    query: force ? { force: 1 } : undefined,
  })
}

export interface RemarketingIntelligence {
  replenishment_cycles: Array<{
    product_id: string
    product_title: string
    median_days: number
    sample_size: number
  }>
  attach_matrix: Array<{
    anchor_product_id: string
    anchor_title: string
    partner_product_id: string
    partner_title: string
    co_count: number
    anchor_orders: number
    attach_pct: number
  }>
}

export async function getRemarketingIntelligence() {
  return medusaFetch<RemarketingIntelligence>("GET", "/remarketing/intelligence")
}

// ─── Engine run ─────────────────────────────────────────────────────

export interface RemarketingEngineResult {
  candidates_evaluated: number
  fires_created: number
  by_status: Record<string, number>
  duration_ms: number
  dry_run: boolean
}

export async function runRemarketingEngine(args?: { dry_run?: boolean; max_candidates?: number; lookback_hours?: number }) {
  return medusaFetch<RemarketingEngineResult>("POST", "/remarketing/engine/run", {
    body: args ?? {},
  })
}

// ─── User 360 ───────────────────────────────────────────────────────

/**
 * Shape REAL devuelto por el backend `GET /admin/remarketing/user360`.
 * Mantenemos los campos en snake_case que devuelve el server — sin transformar.
 */
export interface User360Response {
  query: { email: string; customer_id: string; distinct_id: string }
  customer: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    phone: string | null
    created_at: string
    metadata: Record<string, unknown> | null
  } | null
  medusa_summary: {
    orders_count: number
    lifetime_revenue: number
    avg_order_value: number
    last_order_at: string | null
    days_since_last_order: number | null
    preferred_payment_method: string | null
    orders: Array<{
      id: string
      display_id: number
      total: number
      currency_code: string
      created_at: string
      items: Array<{ product_id: string; title: string; quantity: number; unit_price: number }>
      metadata: Record<string, unknown>
    }>
  }
  posthog_behavior: {
    person_id: string | null
    person_uuid: string | null
    distinct_ids: string[]
    sessions: number
    pageviews: number
    product_views: number
    cart_events: number
    checkout_starts: number
    orders: number
    add_to_carts: number
    whatsapp_clicks: number
    first_seen_at: string | null
    last_seen_at: string | null
    top_pages: Array<{ url: string; count: number }>
    top_products_viewed: Array<{ product_id?: string; title: string; count: number }>
    recent_events: Array<{ event: string; timestamp: string; properties?: Record<string, unknown> }>
    recent_events_count: number
    device?: string
    browser?: string
    city?: string
    country?: string
  }
  signals: Array<{
    id: string
    severity: "high" | "medium" | "low" | "info"
    icon: string
    title: string
    description: string
    detected_at: string
    suggested_action: string
    suggested_channel: "email" | "whatsapp" | "both" | "manual"
    context?: Record<string, unknown>
  }>
  fires: Array<{
    id: string
    rule_key: string
    signal_id: string
    signal_severity: string
    channel: string
    status: string
    subject: string | null
    body: string | null
    error_message: string | null
    fired_at: string
    converted_order_id: string | null
    converted_at: string | null
  }>
  fires_summary: {
    total: number
    sent: number
    converted: number
    last_fired_at: string | null
  }
  links: {
    posthog_person: string | null
    clarity_dashboard: string
    whatsapp: string | null
  }
}

export async function getUser360(args: { email?: string; customer_id?: string; distinct_id?: string }) {
  return medusaFetch<User360Response>("GET", "/remarketing/user360", { query: args })
}

// ─── PostHog admin (DEV) ────────────────────────────────────────────

export interface PosthogOverview {
  configured: boolean
  summary?: {
    total_events_7d: number
    unique_users_7d: number
    persons_total: number
    flags_count: number
    flags_active: number
    experiments_count: number
    survey_responses: number
  }
  top_events?: Array<{ event: string; count: number }>
  flags?: Array<{ id: number; key: string; name: string; active: boolean; rollout?: number }>
  experiments?: Array<{ id: number; name: string; key: string; start_date?: string }>
  posthog_url?: string
}

export async function getPosthogOverview() {
  return medusaFetch<PosthogOverview>("GET", "/dev/posthog/overview")
}

export interface PosthogFlag {
  id: number
  key: string
  name: string
  active: boolean
  rollout?: number
  filters?: unknown
  description?: string
}

export async function listPosthogFlags() {
  return medusaFetch<{ configured: boolean; flags: PosthogFlag[]; count: number; posthog_url?: string }>("GET", "/dev/posthog/flags")
}

export async function togglePosthogFlag(id: number, active: boolean) {
  return medusaFetch<{ toggle?: boolean }>("POST", "/dev/posthog/flags", { body: { id, active } })
}

export async function updatePosthogFlagRollout(id: number, rollout: number) {
  return medusaFetch<{ rollout?: boolean }>("POST", "/dev/posthog/flags", { body: { id, rollout } })
}

export interface PosthogError {
  fingerprint: string
  message: string
  type: string
  count: number
  affected_users: number
  first_seen: string
  last_seen: string
}

export async function getPosthogErrors(days = 7) {
  return medusaFetch<{ configured: boolean; days: number; errors: PosthogError[]; posthog_url?: string }>("GET", "/dev/posthog/errors", {
    query: { days },
  })
}

export interface PosthogLlmOverview {
  configured: boolean
  days: number
  summary?: {
    calls: number
    total_cost_usd: number
    total_tokens: number
    avg_latency_s: number
    errors: number
  }
  by_model?: Array<{ model: string; calls: number; input_tokens: number; output_tokens: number; cost_usd: number }>
  posthog_url?: string
}

export async function getPosthogLlm(days = 7) {
  return medusaFetch<PosthogLlmOverview>("GET", "/dev/posthog/llm", { query: { days } })
}

// ─── PostHog: Session Recordings (replays) ─────────────────────────

export interface PosthogRecording {
  id: string
  distinct_id: string
  start_time: string
  end_time: string
  duration: number
  click_count?: number
  keypress_count?: number
  console_error_count?: number
  start_url?: string
  person_email: string | null
  person_name: string | null
  url: string  // link directo al replay player
}

export async function listPosthogRecordings(args?: {
  days?: number
  limit?: number
  search?: string
  distinct_id?: string
}) {
  return medusaFetch<{
    configured: boolean
    days: number
    count: number
    recordings: PosthogRecording[]
    posthog_url: string
  }>("GET", "/dev/posthog/recordings", { query: args })
}

// ─── PostHog: Heatmap (top clicks + pages) ─────────────────────────

export interface PosthogHeatmapClick {
  page: string
  selector: string
  text: string
  click_count: number
  rage_count: number
  dead_count: number
  unique_users: number
}

export async function getPosthogHeatmap(args?: { days?: number; limit?: number; page?: string }) {
  return medusaFetch<{
    configured: boolean
    days: number
    page: string | null
    clicks: PosthogHeatmapClick[]
    pages: Array<{ page: string; views: number; users: number }>
    posthog_url: string
  }>("GET", "/dev/posthog/heatmap", { query: args })
}

// Backward-compat: legacy listRemarketingRules helper
export interface RemarketingRule {
  id: string
  rule_key: string
  name: string
  description?: string | null
  channel: "email" | "whatsapp" | "telegram"
  is_active: boolean
  cooldown_hours?: number
  fired_count?: number
  converted_count?: number
}

export async function listRemarketingRules() {
  // Legacy adapter: convert RemarketingRuleFull[] to old shape
  const r = await listRemarketingRulesFull()
  const rules: RemarketingRule[] = r.rules.map((rr) => ({
    id: rr.key,
    rule_key: rr.key,
    name: rr.name,
    description: rr.description ?? null,
    channel: (rr.channel === "auto" ? "email" : rr.channel) as RemarketingRule["channel"],
    is_active: rr.enabled,
    cooldown_hours: rr.cooldown_hours,
    fired_count: rr.stats?.fires_total,
    converted_count: rr.stats?.converted,
  }))
  return { rules, count: rules.length }
}

// ─── Helpers para agregaciones del dashboard ──────────────────────────

export type DashboardPeriod = 7 | 30 | 90 | 365

export interface DashboardTopSku {
  productId: string | null
  productTitle: string
  variantTitle: string | null
  sku: string | null
  thumbnail: string | null
  unitsSold: number
  revenue: number
}

export interface DashboardTopCustomer {
  customerId: string | null
  email: string
  name: string
  ordersCount: number
  totalSpent: number
}

export interface DashboardStats {
  // Window selector (días)
  period: DashboardPeriod
  // Total del periodo seleccionado
  revenue: number
  ordersCount: number
  // Periodo previo (mismo tamaño) — para comparación %
  revenuePrev: number
  ordersCountPrev: number
  // Today (since midnight VE)
  revenueToday: number
  ordersToday: number
  // Daily series para chart (oldest → newest), longitud = period
  daily: Array<{ date: string; revenue: number; orders: number }>
  recent: AdminOrderListItem[]
  topSkus: DashboardTopSku[]
  topCustomers: DashboardTopCustomer[]
  currency: string
  // ─── retro-compat (alias para el dashboard antiguo) ────────────────
  /** @deprecated usa `revenue` */
  revenue30d: number
  /** @deprecated usa `ordersCount` */
  ordersCount30d: number
}

/**
 * Fetcha los pedidos del período seleccionado + el período previo
 * (para comparación), y deriva todas las métricas del dashboard
 * client-side en una sola pasada.
 *
 * El cap de listOrders es 500 — para periodos largos con mucho volumen
 * habría que paginar. Para Enrola hoy (~150/mes) cabe holgadamente
 * incluso en 365d.
 */
export async function getDashboardStats(period: DashboardPeriod = 30): Promise<DashboardStats> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayMs = todayStart.getTime()

  const since = new Date(todayStart)
  since.setDate(since.getDate() - (period - 1))
  const sincePrev = new Date(since)
  sincePrev.setDate(sincePrev.getDate() - period)

  // Una sola llamada que cubra los dos periodos (current + prev)
  const { orders } = await listOrders({
    limit: 500,
    created_at_gte: sincePrev.toISOString(),
    order: "-created_at",
  })

  const sinceMs = since.getTime()

  let revenue = 0
  let ordersCount = 0
  let revenuePrev = 0
  let ordersCountPrev = 0
  let revenueToday = 0
  let ordersToday = 0

  const daily = new Map<string, { revenue: number; orders: number }>()
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(todayStart)
    d.setDate(d.getDate() - i)
    daily.set(d.toISOString().slice(0, 10), { revenue: 0, orders: 0 })
  }

  // Para top SKUs y customers (solo del periodo actual)
  const skuAgg = new Map<string, DashboardTopSku>()
  const custAgg = new Map<string, DashboardTopCustomer>()

  for (const o of orders) {
    const total = Number(o.total) || 0
    const created = new Date(o.created_at).getTime()
    const inCurrent = created >= sinceMs
    if (inCurrent) {
      revenue += total
      ordersCount += 1
    } else {
      revenuePrev += total
      ordersCountPrev += 1
    }
    if (created >= todayMs) {
      revenueToday += total
      ordersToday += 1
    }

    if (inCurrent) {
      // Daily bucket
      const dayKey = new Date(o.created_at).toISOString().slice(0, 10)
      const bucket = daily.get(dayKey)
      if (bucket) {
        bucket.revenue += total
        bucket.orders += 1
      }

      // Top customers
      const custKey = o.customer?.id ?? `email:${o.email ?? "anon"}`
      const custName =
        [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" ") ||
        [o.shipping_address?.first_name, o.shipping_address?.last_name].filter(Boolean).join(" ") ||
        o.email || "Cliente sin nombre"
      const cur = custAgg.get(custKey)
      if (cur) {
        cur.ordersCount += 1
        cur.totalSpent += total
      } else {
        custAgg.set(custKey, {
          customerId: o.customer?.id ?? null,
          email: o.email ?? "—",
          name: custName,
          ordersCount: 1,
          totalSpent: total,
        })
      }

      // Top SKUs
      for (const it of o.items ?? []) {
        const variantTitle = it.variant?.title && it.variant.title !== "Default Title" ? it.variant.title : null
        const skuKey = it.variant?.id ?? `title:${it.title}`
        const lineRevenue = Number(it.subtotal ?? Number(it.unit_price) * it.quantity) || 0
        const cur = skuAgg.get(skuKey)
        if (cur) {
          cur.unitsSold += it.quantity
          cur.revenue += lineRevenue
        } else {
          skuAgg.set(skuKey, {
            productId: it.variant?.product?.id ?? it.product_id ?? null,
            productTitle: it.variant?.product?.title ?? it.title,
            variantTitle,
            sku: it.variant?.sku ?? null,
            thumbnail: it.thumbnail ?? null,
            unitsSold: it.quantity,
            revenue: lineRevenue,
          })
        }
      }
    }
  }

  const topSkus = Array.from(skuAgg.values())
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 10)
  const topCustomers = Array.from(custAgg.values())
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10)

  return {
    period,
    revenue,
    ordersCount,
    revenuePrev,
    ordersCountPrev,
    revenueToday,
    ordersToday,
    daily: Array.from(daily.entries()).map(([date, b]) => ({ date, ...b })),
    recent: orders.filter((o) => new Date(o.created_at).getTime() >= sinceMs).slice(0, 6),
    topSkus,
    topCustomers,
    currency: orders[0]?.currency_code ?? "eur",
    // alias retro-compat
    revenue30d: revenue,
    ordersCount30d: ordersCount,
  }
}
