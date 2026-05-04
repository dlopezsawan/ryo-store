#!/usr/bin/env node
/**
 * Create the ENROLAWELCOME promotion against PRODUCTION via the Medusa Admin HTTP API.
 *
 * Usage:
 *   MEDUSA_ADMIN_EMAIL=tu@email.com \
 *   MEDUSA_ADMIN_PASSWORD=tu-password \
 *   node backend/src/scripts/create-enrolawelcome-promo-http.mjs
 *
 * (Optional) override target backend:
 *   MEDUSA_BACKEND_URL=https://api.enrola.shop
 */

const BACKEND = process.env.MEDUSA_BACKEND_URL ?? "https://api.enrola.shop";
const EMAIL = process.env.MEDUSA_ADMIN_EMAIL;
const PASSWORD = process.env.MEDUSA_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("❌ Missing MEDUSA_ADMIN_EMAIL or MEDUSA_ADMIN_PASSWORD env vars.");
  process.exit(1);
}

async function main() {
  // 1) Login — get JWT
  console.log(`→ Logging in to ${BACKEND} as ${EMAIL}…`);
  const loginRes = await fetch(`${BACKEND}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!loginRes.ok) {
    const err = await loginRes.text();
    console.error(`❌ Login failed (${loginRes.status}):`, err);
    process.exit(1);
  }
  const { token } = await loginRes.json();
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  console.log("✓ Logged in.");

  // 2) Find the Alien Puff Sabores product
  console.log("→ Searching for product 'Alien Puff Sabores'…");
  const prodRes = await fetch(
    `${BACKEND}/admin/products?q=alien&limit=50`,
    { headers: authHeaders }
  );
  if (!prodRes.ok) {
    console.error(`❌ Product list failed (${prodRes.status}):`, await prodRes.text());
    process.exit(1);
  }
  const { products } = await prodRes.json();
  const alien = products.find((p) => {
    const t = (p.title ?? "").toLowerCase();
    return t.includes("alien puff") && t.includes("sabores");
  });
  if (!alien) {
    console.error("❌ Could not find 'Alien Puff' + 'Sabores' product. Found:");
    products.forEach((p) => console.error(`   - ${p.title}  [${p.id}]`));
    process.exit(1);
  }
  console.log(`✓ Found: "${alien.title}" (id: ${alien.id}, handle: ${alien.handle})`);

  // 3) Check if ENROLAWELCOME already exists
  console.log("→ Checking existing promotions…");
  const checkRes = await fetch(
    `${BACKEND}/admin/promotions?code=ENROLAWELCOME`,
    { headers: authHeaders }
  );
  if (checkRes.ok) {
    const { promotions } = await checkRes.json();
    if (promotions?.length > 0) {
      console.warn(
        `⚠️  Promotion 'ENROLAWELCOME' already exists (id: ${promotions[0].id}).\n` +
        `   Delete or update it from ${BACKEND.replace("api.", "")}/dashboard/promotions/${promotions[0].id}`
      );
      process.exit(0);
    }
  }

  // 4) Create the promotion
  console.log("→ Creating promotion ENROLAWELCOME…");
  const payload = {
    code: "ENROLAWELCOME",
    type: "standard",
    status: "active",
    is_automatic: false,
    application_method: {
      type: "fixed",
      target_type: "items",
      allocation: "each",
      value: 2.5,
      currency_code: "eur",
      apply_to_quantity: 1,
      max_quantity: 1,
      target_rules: [
        {
          attribute: "product.id",
          operator: "eq",
          values: [alien.id],
        },
      ],
    },
    rules: [
      {
        attribute: "customer.id",
        operator: "ne",
        values: ["null"],
      },
    ],
  };

  const createRes = await fetch(`${BACKEND}/admin/promotions`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(payload),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    console.error(`❌ Creation failed (${createRes.status}):`, err);
    process.exit(1);
  }
  const { promotion } = await createRes.json();

  console.log("\n✅ Promotion created successfully:");
  console.log(`   Code:    ${promotion.code}`);
  console.log(`   ID:      ${promotion.id}`);
  console.log(`   Status:  ${promotion.status}`);
  console.log(`   Product: "${alien.title}"`);
  console.log(`   Discount: €2.50 off (fixed, max 1 unit/cart)`);
  console.log(`   Rule:    requires registered customer`);
  console.log(
    `\n   Admin UI: ${BACKEND.replace("api.", "")}/dashboard/promotions/${promotion.id}\n`
  );
}

main().catch((e) => {
  console.error("❌ Unexpected error:", e);
  process.exit(1);
});
